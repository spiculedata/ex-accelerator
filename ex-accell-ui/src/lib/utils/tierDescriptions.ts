// What each analysis mode does for the tool you are on. The same three modes exist everywhere, but each tool uses
// only some of the models, so one shared sentence read as wrong on most pages.

export type TierTool = 'general' | 'objects' | 'faces' | 'ocr' | 'classification';
type Tier = 'fast' | 'standard' | 'accurate' | string;

const DESCRIPTIONS: Record<TierTool, Record<'fast' | 'standard' | 'accurate', string>> = {
  general: {
    fast: 'YOLOv8n object detection + Haar face detection + heuristic classification',
    standard: 'CLIP ViT-B/32 classification + YOLOv8s detection + CLIP NSFW moderation',
    accurate: 'YOLOv8m detection + RetinaFace + Gemma vision analysis (requires a GPU for acceptable speed)'
  },
  objects: {
    fast: 'YOLOv8n finds and counts objects. Fastest, least precise.',
    standard: 'YOLOv8s finds and counts objects. More accurate on small or crowded scenes.',
    accurate: 'YOLOv8m finds and counts objects, with a Gemma vision description. Slow without a GPU.'
  },
  faces: {
    fast: 'Haar cascade counts faces. Fast, but misses faces that are small, turned or partly covered.',
    standard: 'Faces are counted with the Standard pipeline, alongside CLIP checks on the image.',
    accurate: 'RetinaFace counts faces more reliably, including small or turned ones. Slow without a GPU.'
  },
  ocr: {
    fast: 'Text is read with PaddleOCR in every mode; Quick Scan adds no further analysis of the image.',
    standard: 'Text is read with PaddleOCR in every mode; Standard also classifies the image with CLIP.',
    accurate: 'Text is read with PaddleOCR in every mode; Deep Analysis also describes the image with Gemma vision.'
  },
  classification: {
    fast: 'A quick heuristic assigns broad tags. Fastest, least specific.',
    standard: 'CLIP ViT-B/32 scores the image against your categories (zero-shot).',
    accurate: 'Gemma vision describes the image and assigns tags. Slow without a GPU.'
  }
};

export function tierDescription(tool: TierTool, tier: Tier): string {
  const set = DESCRIPTIONS[tool] ?? DESCRIPTIONS.general;
  return set[tier as keyof typeof set] ?? DESCRIPTIONS.general.accurate;
}
