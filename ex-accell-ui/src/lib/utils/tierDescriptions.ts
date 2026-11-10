// What each analysis mode does for the tool you are on, as etl/image_pipeline.py runs it. The same three modes exist
// everywhere, but each tool uses only some of the models, so one shared sentence read as wrong on most pages.

export type TierTool = 'general' | 'objects' | 'faces' | 'ocr' | 'classification';
type Tier = 'fast' | 'standard' | 'accurate' | string;

const DESCRIPTIONS: Record<TierTool, Record<'fast' | 'standard' | 'accurate', string>> = {
  general: {
    fast: 'YOLOv8n finds objects, a Haar cascade counts faces, and heuristics classify and screen the image. No text is read.',
    standard: 'YOLOv8s finds objects, a Haar cascade counts faces, CLIP classifies and screens the image, and PaddleOCR reads text.',
    accurate: 'YOLOv8m finds objects, RetinaFace counts faces, CLIP classifies and screens the image, and PaddleOCR reads text. Slowest.'
  },
  objects: {
    fast: 'YOLOv8n finds and counts objects. Fastest, least precise.',
    standard: 'YOLOv8s finds and counts objects. More accurate on small or crowded scenes.',
    accurate: 'YOLOv8m finds and counts objects. Most accurate, and the slowest without a GPU.'
  },
  faces: {
    fast: 'A Haar cascade counts faces. Fast, but it misses faces that are small, turned or partly covered.',
    standard: 'A Haar cascade counts faces, the same as Quick Scan. Only Deep Analysis changes how faces are found.',
    accurate: 'RetinaFace counts faces more reliably, including small or turned ones. Slowest without a GPU.'
  },
  ocr: {
    fast: 'Quick Scan does not read text. Choose Standard or Deep Analysis to extract it.',
    standard: 'PaddleOCR reads the text in the image.',
    accurate: 'PaddleOCR reads the text in the image, the same as Standard.'
  },
  classification: {
    fast: 'A heuristic assigns broad tags. Fastest, least specific.',
    standard: 'CLIP ViT-B/32 scores the image against your categories (zero-shot).',
    accurate: 'CLIP ViT-B/32 scores the image against your categories, the same as Standard.'
  }
};

export function tierDescription(tool: TierTool, tier: Tier): string {
  const set = DESCRIPTIONS[tool] ?? DESCRIPTIONS.general;
  return set[tier as keyof typeof set] ?? DESCRIPTIONS.general.accurate;
}
