#!/usr/bin/env python3
"""
Image Processing Pipeline — Batch analysis for queued images.

Runs YOLO object detection, MediaPipe face detection, basic classification,
and perceptual hashing on all pending images in the processing queue.
"""

import logging
import sys
import os
import hashlib
import argparse
import json
from io import BytesIO
from datetime import datetime

import requests
from PIL import Image
import imagehash

from db_config import get_connection_context

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger(__name__)

CACHE_DIR = os.environ.get('IMAGE_CACHE_DIR', '/tmp/image_cache')
os.makedirs(CACHE_DIR, exist_ok=True)


def download_image(url, max_size_mb=10):
    """Download image from URL, cache locally, return PIL Image + bytes."""
    url_hash = hashlib.md5(url.encode()).hexdigest()
    cache_path = os.path.join(CACHE_DIR, f"{url_hash}.jpg")

    if os.path.exists(cache_path):
        with open(cache_path, 'rb') as f:
            img_bytes = f.read()
    else:
        try:
            resp = requests.get(url, timeout=30, headers={'User-Agent': 'SocialExplorer/1.0'}, allow_redirects=True)
            resp.raise_for_status()
            img_bytes = resp.content
            if len(img_bytes) > max_size_mb * 1024 * 1024:
                logger.warning(f"Image too large: {len(img_bytes)} bytes")
                return None, None
            with open(cache_path, 'wb') as f:
                f.write(img_bytes)
        except Exception as e:
            logger.warning(f"Failed to download {url}: {e}")
            return None, None

    try:
        # Check for SVG (not supported by Pillow)
        if img_bytes[:5] == b'<?xml' or img_bytes[:4] == b'<svg' or b'<svg' in img_bytes[:200]:
            logger.warning(f"SVG format not supported — only raster images (JPEG, PNG, WebP)")
            return None, None
        img = Image.open(BytesIO(img_bytes)).convert('RGB')
        return img, img_bytes
    except Exception as e:
        logger.warning(f"Failed to open image ({type(e).__name__}): {e}")
        return None, None


# ── YOLO Object Detection ────────────────────────────────────────────────────

_yolo_models = {}

def get_yolo_model(variant='yolov8n'):
    global _yolo_models
    if variant not in _yolo_models:
        from ultralytics import YOLO
        _yolo_models[variant] = YOLO(f'{variant}.pt')
        logger.info(f"{variant} model loaded")
    return _yolo_models[variant]


def detect_objects(img, tier='fast'):
    """Run YOLO object detection with tier-based model selection."""
    variant = {'fast': 'yolov8n', 'standard': 'yolov8s', 'accurate': 'yolov8m'}.get(tier, 'yolov8n')
    model = get_yolo_model(variant)
    results = model(img, verbose=False, conf=0.3)

    objects = []
    for r in results:
        for box in r.boxes:
            cls_id = int(box.cls[0])
            cls_name = model.names[cls_id]
            conf = float(box.conf[0])
            x, y, w, h = box.xywhn[0].tolist()  # normalized xywh
            objects.append({
                'class': cls_name,
                'confidence': round(conf, 3),
                'bbox': [round(x, 4), round(y, 4), round(w, 4), round(h, 4)]
            })

    return objects


# ── MediaPipe Face Detection ─────────────────────────────────────────────────

_face_net = None
_face_net_loaded = False

def get_face_net():
    """Load OpenCV DNN face detector (Caffe model, ships with opencv)."""
    global _face_net, _face_net_loaded
    if _face_net_loaded:
        return _face_net
    _face_net_loaded = True
    try:
        import cv2
        # OpenCV's built-in DNN face detector (ResNet-10 SSD)
        proto_path = cv2.data.haarcascades.replace('haarcascades/', '') + 'deploy.prototxt'
        # Use Haar cascade as reliable fallback — always available
        _face_net = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
        logger.info("OpenCV Haar face detector loaded")
    except Exception as e:
        logger.warning(f"Face detector load failed: {e}")
        _face_net = None
    return _face_net


_retinaface_app = None

def get_retinaface():
    global _retinaface_app
    if _retinaface_app is None:
        try:
            from insightface.app import FaceAnalysis
            _retinaface_app = FaceAnalysis(allowed_modules=['detection'], providers=['CPUExecutionProvider'])
            _retinaface_app.prepare(ctx_id=0, det_size=(640, 640))
            logger.info("RetinaFace (InsightFace) detector loaded")
        except Exception as e:
            logger.warning(f"RetinaFace not available: {e}")
            _retinaface_app = False  # Mark as failed, don't retry
    return _retinaface_app if _retinaface_app is not False else None


def detect_faces(img, tier='fast'):
    """Detect faces — fast: Haar cascade, standard: Haar, accurate: RetinaFace."""
    import numpy as np

    # Accurate tier: use RetinaFace
    if tier == 'accurate':
        retinaface = get_retinaface()
        if retinaface:
            img_array = np.array(img)
            # RetinaFace expects BGR
            import cv2
            img_bgr = cv2.cvtColor(img_array, cv2.COLOR_RGB2BGR)
            faces = retinaface.get(img_bgr)
            h_img, w_img = img_array.shape[:2]
            bboxes = []
            for face in faces:
                x1, y1, x2, y2 = face.bbox.astype(int)
                conf = float(face.det_score)
                bboxes.append({
                    'x': round((x1 + x2) / 2 / w_img, 4),
                    'y': round((y1 + y2) / 2 / h_img, 4),
                    'w': round((x2 - x1) / w_img, 4),
                    'h': round((y2 - y1) / h_img, 4),
                    'confidence': round(conf, 3),
                    'type': 'face'
                })
            face_count = len(bboxes)
            avg_conf = sum(b['confidence'] for b in bboxes) / max(face_count, 1)
            return face_count, bboxes, round(avg_conf, 3), 'face (RetinaFace)'

    # Fast/standard: Haar cascade
    face_cascade = get_face_net()
    if face_cascade is None:
        model = get_yolo_model()
        results = model(img, verbose=False, conf=0.3)
        person_count = sum(1 for r in results for box in r.boxes if model.names[int(box.cls[0])] == 'person')
        return person_count, [], 0.5 if person_count > 0 else 0.0, 'person'

    import cv2
    img_array = np.array(img)
    gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)

    # Detect faces with Haar cascade
    faces = face_cascade.detectMultiScale(
        gray,
        scaleFactor=1.1,
        minNeighbors=5,
        minSize=(30, 30),
        flags=cv2.CASCADE_SCALE_IMAGE
    )

    h_img, w_img = gray.shape
    bboxes = []
    for (x, y, w, h) in faces:
        # Convert to normalized coordinates
        bboxes.append({
            'x': round((x + w / 2) / w_img, 4),
            'y': round((y + h / 2) / h_img, 4),
            'w': round(w / w_img, 4),
            'h': round(h / h_img, 4),
            'confidence': 0.85,  # Haar doesn't give confidence per detection
            'type': 'face'
        })

    face_count = len(bboxes)
    avg_conf = 0.85 if face_count > 0 else 0.0
    return face_count, bboxes, avg_conf, 'face'


# ── Basic Classification (heuristic + image properties) ──────────────────────

# ── CLIP Classification (Standard Tier) ──────────────────────────────────────

_clip_model = None

def get_clip_model():
    global _clip_model
    if _clip_model is None:
        try:
            import open_clip
            import torch
            model, _, preprocess = open_clip.create_model_and_transforms('ViT-B-32', pretrained='openai')
            tokenizer = open_clip.get_tokenizer('ViT-B-32')
            model.eval()
            _clip_model = (model, preprocess, tokenizer)
            logger.info("CLIP ViT-B/32 model loaded")
        except ImportError:
            logger.warning("open-clip-torch not installed — CLIP classification unavailable")
            return None
    return _clip_model


def classify_with_clip(img, detected_objects=None):
    """Zero-shot classification using CLIP ViT-B/32."""
    import torch
    clip = get_clip_model()
    if clip is None:
        # Fall back to heuristic
        return classify_image_heuristic(img, '', detected_objects)

    model, preprocess, tokenizer = clip
    labels = [
        'photograph', 'screenshot', 'meme', 'infographic', 'artwork', 'diagram',
        'logo', 'nature landscape', 'people portrait', 'food', 'vehicle',
        'building architecture', 'animal', 'technology', 'sports', 'text document'
    ]

    image_input = preprocess(img).unsqueeze(0)
    text_inputs = tokenizer(labels)

    with torch.no_grad():
        image_features = model.encode_image(image_input)
        text_features = model.encode_text(text_inputs)
        similarity = (image_features @ text_features.T).softmax(dim=-1)

    tags = []
    for label, score in zip(labels, similarity[0]):
        s = float(score)
        if s > 0.05:  # Only include tags with >5% confidence
            tags.append((label, round(s, 3)))

    # Add YOLO object tags too
    if detected_objects:
        seen = set()
        for obj in detected_objects:
            if obj['class'] not in seen:
                tags.append((obj['class'], obj['confidence']))
                seen.add(obj['class'])

    tags.sort(key=lambda x: x[1], reverse=True)
    content_type = tags[0][0] if tags else 'photo'
    return tags[:15], content_type


def moderate_with_clip(img):
    """NSFW screening using CLIP with safety-related text prompts."""
    import torch
    clip = get_clip_model()
    if clip is None:
        return {'is_safe': True, 'nsfw_score': 0, 'violence_score': 0, 'hate_score': 0, 'flags': []}

    model, preprocess, tokenizer = clip
    labels = ['safe appropriate content', 'nudity explicit content', 'violence graphic content',
              'gore disturbing imagery', 'hate symbols extremism', 'drugs illegal substances']

    image_input = preprocess(img).unsqueeze(0)
    text_inputs = tokenizer(labels)

    with torch.no_grad():
        image_features = model.encode_image(image_input)
        text_features = model.encode_text(text_inputs)
        similarity = (image_features @ text_features.T).softmax(dim=-1)

    scores = {label: float(s) for label, s in zip(labels, similarity[0])}
    nsfw = scores.get('nudity explicit content', 0)
    violence = scores.get('violence graphic content', 0) + scores.get('gore disturbing imagery', 0)
    hate = scores.get('hate symbols extremism', 0)

    flags = []
    if nsfw > 0.15: flags.append('nudity')
    if violence > 0.15: flags.append('violence')
    if hate > 0.1: flags.append('hate_symbols')

    return {
        'is_safe': nsfw < 0.3 and violence < 0.3 and hate < 0.2,
        'nsfw_score': round(nsfw, 3),
        'violence_score': round(violence, 3),
        'hate_score': round(hate, 3),
        'flags': flags
    }


# ── PaddleOCR (Standard/Accurate Tier) ───────────────────────────────────────

_paddleocr = None

def get_paddleocr():
    global _paddleocr
    if _paddleocr is None:
        try:
            from paddleocr import PaddleOCR
            _paddleocr = PaddleOCR(use_angle_cls=True, lang='en', show_log=False)
            logger.info("PaddleOCR loaded")
        except ImportError:
            logger.warning("PaddleOCR not installed — OCR unavailable")
            _paddleocr = False
    return _paddleocr if _paddleocr is not False else None


def extract_text_ocr(img, tier='fast'):
    """Extract text from image — standard/accurate uses PaddleOCR."""
    if tier == 'fast':
        return '', [], 0.0  # Fast tier doesn't do OCR

    import numpy as np
    ocr = get_paddleocr()
    if ocr is None:
        return '', [], 0.0

    img_array = np.array(img)

    result = ocr.ocr(img_array, cls=True)

    if not result or not result[0]:
        return '', [], 0.0

    text_regions = []
    all_text = []
    total_conf = 0.0
    count = 0

    for line in result[0]:
        if not line or len(line) < 2:
            continue
        bbox_points = line[0]
        text_conf = line[1]
        if isinstance(text_conf, (list, tuple)) and len(text_conf) == 2:
            text, conf = text_conf
        else:
            continue
        if text and str(text).strip():
            all_text.append(str(text).strip())
            text_regions.append({
                'text': str(text).strip(),
                'confidence': round(float(conf), 3),
                'bbox': [[round(float(p[0]), 1), round(float(p[1]), 1)] for p in bbox_points] if bbox_points else []
            })
            total_conf += float(conf)
            count += 1

    extracted_text = ' '.join(all_text)
    avg_conf = total_conf / max(count, 1)
    return extracted_text, text_regions, round(avg_conf, 3)


# ── Heuristic Classification (Fast Tier) ─────────────────────────────────────

def classify_image_heuristic(img, url='', detected_objects=None):
    """Fast heuristic classification using YOLO + image properties."""
    return _classify_image_impl(img, url, detected_objects)


def classify_image(img, url='', detected_objects=None, tier='fast'):
    """Classify image — fast uses heuristics, standard uses CLIP, accurate uses Gemma."""
    if tier in ('standard', 'accurate'):
        return classify_with_clip(img, detected_objects)
    return _classify_image_impl(img, url, detected_objects)


def _classify_image_impl(img, url='', detected_objects=None):
    """Fast heuristic classification."""
    w, h = img.size
    aspect = w / max(h, 1)
    tags = []

    # Use YOLO detected objects as primary tags
    if detected_objects:
        seen = set()
        for obj in detected_objects:
            cls = obj['class']
            if cls not in seen:
                tags.append((cls, obj['confidence']))
                seen.add(cls)

    # Content type from detected objects
    obj_classes = set(o['class'] for o in (detected_objects or []))
    has_person = 'person' in obj_classes
    has_animal = bool(obj_classes & {'dog', 'cat', 'bird', 'horse', 'cow', 'sheep', 'bear', 'elephant'})
    has_vehicle = bool(obj_classes & {'car', 'truck', 'bus', 'motorcycle', 'bicycle', 'boat', 'airplane'})
    has_electronics = bool(obj_classes & {'laptop', 'cell phone', 'tv', 'keyboard', 'mouse'})
    has_furniture = bool(obj_classes & {'chair', 'couch', 'bed', 'dining table', 'desk'})

    # Content type inference
    content_type = 'photo'
    url_lower = url.lower()
    if '.svg' in url_lower:
        content_type = 'graphic'
        tags.append(('vector_graphic', 0.9))
    elif 'logo' in url_lower:
        content_type = 'logo'
        tags.append(('logo', 0.9))
    elif 'screenshot' in url_lower:
        content_type = 'screenshot'
    elif 'meme' in url_lower:
        content_type = 'meme'
    elif has_person and has_furniture:
        content_type = 'indoor_scene'
    elif has_person and not detected_objects:
        content_type = 'portrait'
    elif has_animal:
        content_type = 'animal'
    elif has_vehicle:
        content_type = 'outdoor_scene'
    elif has_electronics:
        content_type = 'technology'

    # Scene tags from properties
    if aspect > 1.8:
        tags.append(('panoramic', 0.7))
    elif 0.9 < aspect < 1.1:
        tags.append(('square_format', 0.6))

    # Color analysis for scene understanding
    small = img.resize((50, 50))
    pixels = list(small.getdata())
    avg_r = sum(p[0] for p in pixels) / len(pixels)
    avg_g = sum(p[1] for p in pixels) / len(pixels)
    avg_b = sum(p[2] for p in pixels) / len(pixels)

    if avg_g > avg_r * 1.3 and avg_g > avg_b * 1.2:
        tags.append(('nature', 0.6))
    if avg_b > avg_r * 1.2 and avg_b > avg_g * 1.1:
        tags.append(('sky', 0.5))
    if avg_r > 200 and avg_g > 200 and avg_b > 200:
        tags.append(('bright_background', 0.5))

    tags.append((content_type, 0.85))
    return tags, content_type


# ── Perceptual Hashing ───────────────────────────────────────────────────────

def compute_hashes(img):
    """Compute perceptual hash for similarity detection."""
    phash = str(imagehash.phash(img))
    return phash


# ── Content Moderation (basic heuristic) ─────────────────────────────────────

def moderate_image(img, objects, face_count, tier='fast'):
    """Content moderation — fast uses heuristics, standard uses CLIP NSFW."""
    if tier in ('standard', 'accurate'):
        return moderate_with_clip(img)
    # Fast tier: heuristic
    flags = []
    nsfw_score = 0.0
    violence_score = 0.0
    hate_score = 0.0

    obj_classes = set(o['class'] for o in objects)

    # Weapon detection
    weapon_classes = {'knife', 'scissors', 'baseball bat'}
    if weapon_classes & obj_classes:
        violence_score = max(violence_score, 0.5)
        flags.append('potential_weapon')

    # Large crowd detection
    person_count = sum(1 for o in objects if o['class'] == 'person')
    if person_count > 10:
        flags.append('large_crowd')
    elif person_count > 5:
        flags.append('group')

    # Skin tone analysis for NSFW screening (very basic — percentage of skin-toned pixels)
    try:
        small = img.resize((100, 100))
        pixels = list(small.getdata())
        skin_count = 0
        for r, g, b in pixels:
            # Simple skin tone detection (HSV-based heuristic)
            if r > 95 and g > 40 and b > 20 and r > g and r > b and abs(r - g) > 15 and r - b > 15:
                skin_count += 1
        skin_ratio = skin_count / len(pixels)
        if skin_ratio > 0.6 and person_count > 0:
            nsfw_score = max(nsfw_score, 0.3)
            flags.append('high_skin_exposure')
        if skin_ratio > 0.8 and person_count > 0:
            nsfw_score = max(nsfw_score, 0.6)
            flags.append('excessive_skin_exposure')
    except Exception:
        pass

    # Dark/violent imagery heuristic
    try:
        small = img.resize((50, 50))
        pixels = list(small.getdata())
        avg_r = sum(p[0] for p in pixels) / len(pixels)
        avg_brightness = sum(sum(p) / 3 for p in pixels) / len(pixels)

        # Very dark with red tones
        if avg_brightness < 40 and avg_r > 80:
            violence_score = max(violence_score, 0.2)
            flags.append('dark_red_imagery')
    except Exception:
        pass

    is_safe = nsfw_score < 0.5 and violence_score < 0.5 and hate_score < 0.5

    return {
        'is_safe': is_safe,
        'nsfw_score': round(nsfw_score, 3),
        'violence_score': round(violence_score, 3),
        'hate_score': round(hate_score, 3),
        'flags': flags
    }


# ── Pipeline Orchestrator ────────────────────────────────────────────────────

def process_single_image(image_id, image_url, conn, model_config=None):
    """Process a single image through all analysis steps."""
    config = model_config or {}
    tier = config.get('tier', 'fast') if isinstance(config, dict) else 'fast'
    logger.info(f"  Tier: {tier}")
    cur = conn.cursor()

    # Download
    img, img_bytes = download_image(image_url)
    if img is None:
        cur.execute(
            "UPDATE image_processing_queue SET status='failed', error='Download failed' WHERE image_id=%s AND status='pending'",
            (image_id,)
        )
        conn.commit()
        return False

    # Update image dimensions
    w, h = img.size
    cur.execute(
        "UPDATE image_analysis SET width=%s, height=%s, file_size_bytes=%s WHERE id=%s",
        (w, h, len(img_bytes), image_id)
    )

    # 1. Object Detection (YOLO)
    objects = []
    try:
        objects = detect_objects(img, tier=tier)
        cur.execute("DELETE FROM image_objects WHERE image_id=%s", (image_id,))
        for obj in objects:
            cur.execute(
                "INSERT INTO image_objects (image_id, object_class, confidence, bbox_x, bbox_y, bbox_w, bbox_h, model) VALUES (%s,%s,%s,%s,%s,%s,%s,'yolov8n')",
                (image_id, obj['class'], obj['confidence'], *obj['bbox'])
            )
        logger.info(f"  Objects: {len(objects)} detected ({', '.join(o['class'] for o in objects[:5])})")
    except Exception as e:
        logger.error(f"  YOLO failed: {e}")

    # 2. Face/Person Detection
    face_count = 0
    try:
        face_count, bboxes, avg_conf, det_type = detect_faces(img, tier=tier)
        cur.execute("DELETE FROM image_faces WHERE image_id=%s", (image_id,))
        cur.execute(
            "INSERT INTO image_faces (image_id, face_count, avg_confidence, bbox_data) VALUES (%s,%s,%s,%s)",
            (image_id, face_count, avg_conf if avg_conf > 0 else 0.0, json.dumps(bboxes))
        )
        logger.info(f"  {det_type.title()}s: {face_count} detected (confidence: {avg_conf})")
    except Exception as e:
        logger.error(f"  Face detection failed: {e}")

    # 3. Classification (YOLO objects + image properties)
    try:
        tags, content_type = classify_image(img, image_url, detected_objects=objects, tier=tier)
        cur.execute("DELETE FROM image_classification WHERE image_id=%s", (image_id,))
        for tag, conf in tags:
            cur.execute(
                "INSERT INTO image_classification (image_id, tag, confidence, category, model) VALUES (%s,%s,%s,%s,%s)",
                (image_id, tag, conf, content_type, 'clip' if tier in ('standard', 'accurate') else 'heuristic')
            )
        logger.info(f"  Classification: {content_type}, {len(tags)} tags (model: {'clip' if tier in ('standard', 'accurate') else 'heuristic'})")
    except Exception as e:
        logger.error(f"  Classification failed: {e}")

    # 4. OCR Text Extraction (standard/accurate tier)
    try:
        extracted_text, text_regions, ocr_conf = extract_text_ocr(img, tier=tier)
        if extracted_text:
            cur.execute("DELETE FROM image_ocr WHERE image_id=%s", (image_id,))
            cur.execute(
                "INSERT INTO image_ocr (image_id, extracted_text, confidence, text_regions, model) VALUES (%s,%s,%s,%s,%s)",
                (image_id, extracted_text, ocr_conf, json.dumps(text_regions),
                 'paddleocr' if tier != 'fast' else 'none')
            )
            logger.info(f"  OCR: {len(extracted_text)} chars extracted ({len(text_regions)} regions)")
        else:
            logger.info(f"  OCR: no text found" + (" (fast tier skips OCR)" if tier == 'fast' else ""))
    except Exception as e:
        logger.error(f"  OCR failed: {e}")

    # 5. Perceptual Hash
    try:
        phash = compute_hashes(img)
        cur.execute("DELETE FROM image_embeddings WHERE image_id=%s", (image_id,))
        cur.execute(
            "INSERT INTO image_embeddings (image_id, phash) VALUES (%s,%s)",
            (image_id, phash)
        )
        logger.info(f"  Hash: {phash}")
    except Exception as e:
        logger.error(f"  Hashing failed: {e}")

    # 6. Content Moderation
    try:
        mod = moderate_image(img, objects, face_count, tier=tier)
        cur.execute("DELETE FROM image_moderation WHERE image_id=%s", (image_id,))
        model_name = 'clip' if tier in ('standard', 'accurate') else 'heuristic'
        cur.execute(
            "INSERT INTO image_moderation (image_id, is_safe, nsfw_score, violence_score, hate_score, flags, model) VALUES (%s,%s,%s,%s,%s,%s,%s)",
            (image_id, mod['is_safe'], mod['nsfw_score'], mod['violence_score'],
             mod.get('hate_score', 0), mod['flags'] if mod['flags'] else None, model_name)
        )
        logger.info(f"  Moderation: safe={mod['is_safe']}, flags={mod['flags']}")
    except Exception as e:
        logger.error(f"  Moderation failed: {e}")

    # Mark queue task as completed
    cur.execute(
        "UPDATE image_processing_queue SET status='completed', completed_at=NOW() WHERE image_id=%s AND status IN ('pending','processing')",
        (image_id,)
    )
    conn.commit()
    return True


def run_pipeline(limit=100):
    """Process all pending images in the queue."""
    with get_connection_context() as conn:
        cur = conn.cursor()

        # Get pending images
        cur.execute("""
            SELECT q.image_id, a.image_url, MIN(q.priority) as priority, MIN(q.created_at) as created,
                   (array_agg(q.model_config ORDER BY q.created_at DESC))[1] as model_config
            FROM image_processing_queue q
            JOIN image_analysis a ON a.id = q.image_id
            WHERE q.status = 'pending'
            GROUP BY q.image_id, a.image_url
            ORDER BY MIN(q.priority) DESC, MIN(q.created_at) ASC
            LIMIT %s
        """, (limit,))
        pending = cur.fetchall()

        if not pending:
            logger.info("No pending images to process")
            return 0

        logger.info(f"Processing {len(pending)} images...")

        # Claim tasks
        image_ids = [row[0] for row in pending]
        cur.execute(
            "UPDATE image_processing_queue SET status='processing', claimed_at=NOW(), claimed_by='etl-worker' WHERE image_id = ANY(%s) AND status='pending'",
            (image_ids,)
        )
        conn.commit()

        success = 0
        for i, row in enumerate(pending):
            image_id, image_url = row[0], row[1]
            model_config = row[4] if len(row) > 4 else None
            logger.info(f"[{i+1}/{len(pending)}] Processing image {image_id}: {image_url[:60]}...")
            try:
                if process_single_image(image_id, image_url, conn, model_config=model_config):
                    success += 1
            except Exception as e:
                logger.error(f"  Failed: {e}")
                cur.execute(
                    "UPDATE image_processing_queue SET status='failed', error=%s WHERE image_id=%s",
                    (str(e)[:500], image_id)
                )
                conn.commit()

        logger.info(f"Completed: {success}/{len(pending)} images processed successfully")
        return success


def main():
    parser = argparse.ArgumentParser(description="Image Processing Pipeline")
    parser.add_argument("--limit", type=int, default=100, help="Max images to process")
    args = parser.parse_args()

    processed = run_pipeline(limit=args.limit)
    if processed == 0:
        logger.info("Nothing to process")
    else:
        logger.info(f"Pipeline complete: {processed} images analyzed")


if __name__ == "__main__":
    main()
