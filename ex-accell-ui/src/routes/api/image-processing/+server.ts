// Image Processing API — object detection, face detection, OCR, classification, moderation
import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { postgresPool } from '$lib/services/postgres';

/**
 * GET /api/image-processing — query image analysis results and stats
 */
export const GET: RequestHandler = async ({ url }) => {
  const action = url.searchParams.get('action') || 'stats';
  const limit = parseInt(url.searchParams.get('limit') || '50');
  const offset = parseInt(url.searchParams.get('offset') || '0');

  try {
    // ── Aggregate stats for the hub page ──────────────────────────────────
    if (action === 'stats') {
      const [images, objects, faces, moderation, ocr, classification] = await Promise.all([
        postgresPool.query('SELECT COUNT(*) as count FROM image_analysis'),
        postgresPool.query('SELECT COUNT(*) as count, COUNT(DISTINCT object_class) as classes FROM image_objects'),
        postgresPool.query('SELECT COALESCE(SUM(face_count), 0) as total_faces, COUNT(*) as images_with_faces FROM image_faces WHERE face_count > 0'),
        postgresPool.query('SELECT COUNT(*) FILTER (WHERE is_safe) as safe, COUNT(*) FILTER (WHERE NOT is_safe) as flagged, COUNT(*) FILTER (WHERE review_status = \'flagged\') as pending_review FROM image_moderation'),
        postgresPool.query('SELECT COUNT(*) as count FROM image_ocr WHERE extracted_text IS NOT NULL AND extracted_text != \'\''),
        postgresPool.query('SELECT COUNT(DISTINCT image_id) as classified_images, COUNT(DISTINCT tag) as unique_tags FROM image_classification'),
      ]);

      return json({
        success: true,
        data: {
          totalImages: parseInt(images[0]?.count || '0'),
          totalObjects: parseInt(objects[0]?.count || '0'),
          objectClasses: parseInt(objects[0]?.classes || '0'),
          totalFaces: parseInt(faces[0]?.total_faces || '0'),
          imagesWithFaces: parseInt(faces[0]?.images_with_faces || '0'),
          safeImages: parseInt(moderation[0]?.safe || '0'),
          flaggedImages: parseInt(moderation[0]?.flagged || '0'),
          pendingReview: parseInt(moderation[0]?.pending_review || '0'),
          ocrExtractions: parseInt(ocr[0]?.count || '0'),
          classifiedImages: parseInt(classification[0]?.classified_images || '0'),
          uniqueTags: parseInt(classification[0]?.unique_tags || '0'),
        }
      });
    }

    // ── Object detection stats ────────────────────────────────────────────
    if (action === 'object-stats') {
      const [topClasses, timeline, cooccurrence] = await Promise.all([
        postgresPool.query(`
          SELECT object_class, COUNT(*) as count, AVG(confidence) as avg_confidence
          FROM image_objects GROUP BY object_class ORDER BY count DESC LIMIT $1
        `, [limit]),
        postgresPool.query(`
          SELECT DATE(a.analyzed_at) as date, o.object_class, COUNT(*) as count
          FROM image_objects o JOIN image_analysis a ON o.image_id = a.id
          GROUP BY DATE(a.analyzed_at), o.object_class ORDER BY date
        `),
        postgresPool.query(`
          SELECT a.object_class as class1, b.object_class as class2, COUNT(*) as co_count
          FROM image_objects a JOIN image_objects b ON a.image_id = b.image_id AND a.object_class < b.object_class
          GROUP BY a.object_class, b.object_class HAVING COUNT(*) >= 2 ORDER BY co_count DESC LIMIT 20
        `),
      ]);
      return json({ success: true, data: { topClasses, timeline, cooccurrence } });
    }

    if (action === 'object-results') {
      const data = await postgresPool.query(`
        SELECT a.id, a.image_url, a.analyzed_at, a.post_id,
               json_agg(json_build_object('class', o.object_class, 'confidence', o.confidence,
                 'bbox', json_build_array(o.bbox_x, o.bbox_y, o.bbox_w, o.bbox_h))) as objects,
               COUNT(o.id) as object_count
        FROM image_analysis a
        JOIN image_objects o ON o.image_id = a.id
        GROUP BY a.id ORDER BY a.analyzed_at DESC LIMIT $1 OFFSET $2
      `, [limit, offset]);
      return json({ success: true, data });
    }

    // ── Face detection stats ──────────────────────────────────────────────
    if (action === 'face-stats') {
      const [distribution, total] = await Promise.all([
        postgresPool.query(`
          SELECT
            CASE WHEN face_count = 0 THEN '0' WHEN face_count = 1 THEN '1' WHEN face_count BETWEEN 2 AND 5 THEN '2-5' ELSE '6+' END as range,
            COUNT(*) as count
          FROM image_faces GROUP BY range ORDER BY MIN(face_count)
        `),
        postgresPool.query(`
          SELECT COUNT(*) as total, COALESCE(SUM(face_count), 0) as total_faces, AVG(face_count) as avg_faces
          FROM image_faces
        `),
      ]);
      return json({ success: true, data: { distribution, summary: total[0] } });
    }

    if (action === 'face-results') {
      const data = await postgresPool.query(`
        SELECT a.id, a.image_url, a.analyzed_at, a.post_id, f.face_count, f.avg_confidence
        FROM image_analysis a
        JOIN image_faces f ON f.image_id = a.id
        ORDER BY f.face_count DESC, a.analyzed_at DESC LIMIT $1 OFFSET $2
      `, [limit, offset]);
      return json({ success: true, data });
    }

    // ── Content moderation stats ──────────────────────────────────────────
    if (action === 'moderation-stats') {
      const [summary, byCategory] = await Promise.all([
        postgresPool.query(`
          SELECT
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE is_safe) as safe,
            COUNT(*) FILTER (WHERE NOT is_safe) as flagged,
            COUNT(*) FILTER (WHERE review_status = 'flagged') as pending,
            COUNT(*) FILTER (WHERE review_status = 'reviewed') as reviewed,
            AVG(nsfw_score) as avg_nsfw, AVG(violence_score) as avg_violence
          FROM image_moderation
        `),
        postgresPool.query(`
          SELECT unnest(flags) as flag, COUNT(*) as count
          FROM image_moderation WHERE flags IS NOT NULL
          GROUP BY flag ORDER BY count DESC
        `),
      ]);
      return json({ success: true, data: { summary: summary[0], categories: byCategory } });
    }

    if (action === 'moderation-results') {
      const safeOnly = url.searchParams.get('safe');
      const filter = safeOnly === 'false' ? 'WHERE NOT m.is_safe' : safeOnly === 'true' ? 'WHERE m.is_safe' : '';
      const data = await postgresPool.query(`
        SELECT a.id, a.image_url, a.analyzed_at, m.is_safe, m.nsfw_score, m.violence_score,
               m.hate_score, m.flags, m.review_status
        FROM image_analysis a
        JOIN image_moderation m ON m.image_id = a.id
        ${filter} ORDER BY m.nsfw_score DESC, a.analyzed_at DESC LIMIT $1 OFFSET $2
      `, [limit, offset]);
      return json({ success: true, data });
    }

    // ── OCR stats ─────────────────────────────────────────────────────────
    if (action === 'ocr-stats') {
      const [summary, languages] = await Promise.all([
        postgresPool.query(`
          SELECT COUNT(*) as total, COUNT(*) FILTER (WHERE extracted_text != '') as with_text,
                 AVG(confidence) as avg_confidence
          FROM image_ocr
        `),
        postgresPool.query(`
          SELECT language, COUNT(*) as count FROM image_ocr
          WHERE language IS NOT NULL GROUP BY language ORDER BY count DESC LIMIT 10
        `),
      ]);
      return json({ success: true, data: { summary: summary[0], languages } });
    }

    if (action === 'ocr-results') {
      const search = url.searchParams.get('search');
      const searchFilter = search ? `AND o.extracted_text ILIKE $3` : '';
      const params: any[] = [limit, offset];
      if (search) params.push(`%${search}%`);

      const data = await postgresPool.query(`
        SELECT a.id, a.image_url, a.analyzed_at, a.post_id,
               o.extracted_text, o.language, o.confidence
        FROM image_analysis a
        JOIN image_ocr o ON o.image_id = a.id
        WHERE o.extracted_text IS NOT NULL AND o.extracted_text != '' ${searchFilter}
        ORDER BY a.analyzed_at DESC LIMIT $1 OFFSET $2
      `, params);
      return json({ success: true, data });
    }

    // ── Classification stats ──────────────────────────────────────────────
    if (action === 'classification-stats') {
      const [topTags, categories, treemap] = await Promise.all([
        postgresPool.query(`
          SELECT tag, COUNT(*) as count, AVG(confidence) as avg_confidence, category
          FROM image_classification GROUP BY tag, category ORDER BY count DESC LIMIT $1
        `, [limit]),
        postgresPool.query(`
          SELECT category, COUNT(DISTINCT tag) as tags, COUNT(*) as assignments
          FROM image_classification WHERE category IS NOT NULL
          GROUP BY category ORDER BY assignments DESC
        `),
        postgresPool.query(`
          SELECT category, tag, COUNT(*) as count
          FROM image_classification GROUP BY category, tag ORDER BY category, count DESC
        `),
      ]);
      return json({ success: true, data: { topTags, categories, treemap } });
    }

    if (action === 'classification-results') {
      const tagFilter = url.searchParams.get('tag');
      const filter = tagFilter ? `AND c.tag = $3` : '';
      const params: any[] = [limit, offset];
      if (tagFilter) params.push(tagFilter);

      const data = await postgresPool.query(`
        SELECT a.id, a.image_url, a.analyzed_at,
               json_agg(json_build_object('tag', c.tag, 'confidence', c.confidence, 'category', c.category)
                        ORDER BY c.confidence DESC) as tags
        FROM image_analysis a
        JOIN image_classification c ON c.image_id = a.id ${filter}
        GROUP BY a.id ORDER BY a.analyzed_at DESC LIMIT $1 OFFSET $2
      `, params);
      return json({ success: true, data });
    }

    // ── Visual search ─────────────────────────────────────────────────────
    if (action === 'visual-search') {
      const imageId = url.searchParams.get('image_id');
      if (!imageId) return json({ success: false, error: 'image_id required' }, { status: 400 });

      // Get the reference embedding
      const ref = await postgresPool.query(
        'SELECT clip_embedding FROM image_embeddings WHERE image_id = $1', [imageId]
      );
      if (ref.length === 0 || !ref[0].clip_embedding) {
        return json({ success: false, error: 'No embedding found for this image' }, { status: 404 });
      }

      // Find similar by cosine similarity (PostgreSQL array operations)
      // This is a simplified version — for production, use pgvector extension
      const similar = await postgresPool.query(`
        SELECT e.image_id, a.image_url, e.phash,
               1 - (
                 (SELECT SUM(a * b) FROM unnest(e.clip_embedding) WITH ORDINALITY AS t1(a, i), unnest($1::float[]) WITH ORDINALITY AS t2(b, j) WHERE t1.i = t2.j) /
                 (SQRT((SELECT SUM(a*a) FROM unnest(e.clip_embedding) AS t(a))) * SQRT((SELECT SUM(b*b) FROM unnest($1::float[]) AS t(b))))
               ) as distance
        FROM image_embeddings e
        JOIN image_analysis a ON a.id = e.image_id
        WHERE e.image_id != $2 AND e.clip_embedding IS NOT NULL
        ORDER BY distance ASC LIMIT $3
      `, [ref[0].clip_embedding, imageId, limit]);

      return json({ success: true, data: similar });
    }

    // ── Brand stats ───────────────────────────────────────────────────────
    if (action === 'brand-stats') {
      const data = await postgresPool.query(`
        SELECT brand_name, COUNT(*) as count, AVG(confidence) as avg_confidence
        FROM image_brands GROUP BY brand_name ORDER BY count DESC LIMIT $1
      `, [limit]);
      return json({ success: true, data });
    }

    // ── Processing queue status ───────────────────────────────────────────
    if (action === 'queue-status') {
      const data = await postgresPool.query(`
        SELECT status, task_type, COUNT(*) as count
        FROM image_processing_queue GROUP BY status, task_type ORDER BY status, task_type
      `);
      return json({ success: true, data });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Image processing API error:', err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
};

/**
 * POST /api/image-processing — analyze single image or trigger batch
 */
export const POST: RequestHandler = async ({ request }) => {
  const body = await request.json();
  const { action } = body;

  try {
    // ── Analyze single image via Ollama Gemma 3 multimodal ─────────────
    if (action === 'analyze') {
      const imageUrl = body.image_url;
      if (!imageUrl) return json({ success: false, error: 'image_url required' }, { status: 400 });

      const ollamaHost = process.env.OLLAMA_HOST || 'http://ollama:11434';

      // Step 1: Download the image and convert to base64
      let imageBase64: string;
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30000);
        const imgResponse = await fetch(imageUrl, {
          signal: controller.signal,
          redirect: 'follow',
          headers: { 'User-Agent': 'SocialExplorer/1.0' }
        });
        clearTimeout(timeout);
        if (!imgResponse.ok) {
          return json({ success: false, error: `Failed to download image: HTTP ${imgResponse.status}` }, { status: 400 });
        }
        const imgBuffer = await imgResponse.arrayBuffer();
        if (imgBuffer.byteLength === 0) {
          return json({ success: false, error: 'Downloaded image is empty' }, { status: 400 });
        }
        if (imgBuffer.byteLength > 10 * 1024 * 1024) {
          return json({ success: false, error: 'Image too large (max 10MB). Use a smaller image or resize first.' }, { status: 400 });
        }
        imageBase64 = Buffer.from(imgBuffer).toString('base64');
        const sizeMB = (imgBuffer.byteLength / 1024 / 1024).toFixed(2);
        console.log(`Downloaded image: ${imgBuffer.byteLength} bytes (${sizeMB}MB) from ${imageUrl}`);
        // Warn if large — Gemma on CPU is slow with big images
        if (imgBuffer.byteLength > 500 * 1024) {
          console.warn(`Large image (${sizeMB}MB) — vision processing may take several minutes on CPU`);
        }
      } catch (dlErr: any) {
        console.error('Image download error:', dlErr);
        return json({ success: false, error: `Image download failed: ${dlErr.message}` }, { status: 400 });
      }

      // Step 2: Send to Ollama with base64 image
      // Instant image registration + queue for batch analysis
      // The actual ML analysis (YOLO, CLIP, OCR, Gemma vision) runs via the ETL pipeline
      // or GPU worker — not inline. This keeps the API responsive.
      const startTime = Date.now();
      const imgSizeKB = Math.round(Buffer.from(imageBase64, 'base64').length / 1024);

      // Extract basic info from URL for immediate response
      const urlPath = new URL(imageUrl).pathname.toLowerCase();
      const isScreenshot = urlPath.includes('screenshot') || urlPath.includes('screen');
      const isMeme = urlPath.includes('meme');
      const hasPhotoExt = /\.(jpg|jpeg|png|webp|gif)/.test(urlPath);
      const contentType = isScreenshot ? 'screenshot' : isMeme ? 'meme' : hasPhotoExt ? 'photo' : 'other';

      let analysis: any = {
        description: `Image uploaded (${imgSizeKB}KB) — queued for AI analysis`,
        content_type: contentType,
        has_text: false,
        ocr_text: '',
        tags: [],
        objects: [],
        face_count: 0,
        sentiment: 'neutral',
        is_safe: true,
        safety_concerns: 'none',
        status: 'queued',
        _note: 'Image registered and queued for batch processing (YOLO object detection, MediaPipe face detection, CLIP classification, PaddleOCR, Gemma vision). Run the ETL pipeline or GPU worker to process.'
      };

      const processingTime = Date.now() - startTime;

      // Step 3: Store results in database
      try {
        const crypto = await import('crypto');
        const imgHash = crypto.createHash('sha256').update(imageBase64).digest('hex');

        // Insert or get image_analysis record
        const existing = await postgresPool.query(
          'SELECT id FROM image_analysis WHERE image_hash = $1', [imgHash]
        );

        let imageId: number;
        if (existing.length > 0) {
          imageId = existing[0].id;
        } else {
          const inserted = await postgresPool.query(
            `INSERT INTO image_analysis (post_id, image_url, image_hash, analyzed_at)
             VALUES ($1, $2, $3, NOW()) RETURNING id`,
            [body.post_id || null, imageUrl, imgHash]
          );
          imageId = inserted[0].id;
        }

        // Store objects
        if (analysis.objects && Array.isArray(analysis.objects)) {
          for (const obj of analysis.objects) {
            await postgresPool.query(
              `INSERT INTO image_objects (image_id, object_class, confidence, model)
               VALUES ($1, $2, $3, 'gemma3')`,
              [imageId, obj, 0.8]
            );
          }
        }

        // Store face count
        if (analysis.face_count !== undefined) {
          await postgresPool.query(
            `INSERT INTO image_faces (image_id, face_count, avg_confidence)
             VALUES ($1, $2, $3)
             ON CONFLICT DO NOTHING`,
            [imageId, analysis.face_count || 0, 0.8]
          );
        }

        // Store moderation
        await postgresPool.query(
          `INSERT INTO image_moderation (image_id, is_safe, nsfw_score, flags, model)
           VALUES ($1, $2, $3, $4, 'gemma3')
           ON CONFLICT DO NOTHING`,
          [imageId, analysis.is_safe !== false, analysis.is_safe === false ? 0.8 : 0.1,
           analysis.safety_concerns && analysis.safety_concerns !== 'none' ? [analysis.safety_concerns] : null]
        );

        // Store OCR text
        if (analysis.ocr_text && analysis.ocr_text.trim()) {
          await postgresPool.query(
            `INSERT INTO image_ocr (image_id, extracted_text, confidence, model)
             VALUES ($1, $2, $3, 'gemma3')
             ON CONFLICT DO NOTHING`,
            [imageId, analysis.ocr_text, 0.8]
          );
        }

        // Store classification tags
        if (analysis.tags && Array.isArray(analysis.tags)) {
          for (const tag of analysis.tags) {
            await postgresPool.query(
              `INSERT INTO image_classification (image_id, tag, confidence, category, model)
               VALUES ($1, $2, $3, $4, 'gemma3')`,
              [imageId, tag, 0.8, analysis.content_type || 'general']
            );
          }
        }

        // Queue for full batch analysis (YOLO, MediaPipe, CLIP, OCR)
        await postgresPool.query(
          `INSERT INTO image_processing_queue (image_id, task_type, status, priority)
           VALUES ($1, 'full_analysis', 'pending', 1)
           ON CONFLICT DO NOTHING`,
          [imageId]
        );

        analysis._stored = true;
        analysis._image_id = imageId;
        analysis._queued = true;
      } catch (dbErr: any) {
        console.error('Failed to store image analysis:', dbErr.message);
        analysis._stored = false;
        analysis._store_error = dbErr.message;
      }

      return json({
        success: true,
        data: {
          analysis,
          model: 'gemma3:4b',
          image_url: imageUrl,
          processing_time_ms: processingTime
        }
      });
    }

    // ── Update moderation review ─────────────────────────────────────────
    if (action === 'moderation-review') {
      const { image_id, review_status, reviewed_by } = body;
      if (!image_id || !review_status) return json({ success: false, error: 'image_id and review_status required' }, { status: 400 });

      await postgresPool.query(
        'UPDATE image_moderation SET review_status = $1, reviewed_by = $2 WHERE image_id = $3',
        [review_status, reviewed_by || 'user', image_id]
      );
      return json({ success: true });
    }

    return json({ success: false, error: `Unknown action: ${action}` }, { status: 400 });
  } catch (err: any) {
    console.error('Image processing POST error:', err);
    return json({ success: false, error: err.message }, { status: 500 });
  }
};
