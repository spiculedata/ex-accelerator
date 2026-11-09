// What each image-processing GET action returns when the image tables have not been provisioned yet.
// The shapes match the real responses, so a page can render them as an ordinary empty result.

const EMPTY: Record<string, unknown> = {
  stats: {
    totalImages: 0, totalObjects: 0, objectClasses: 0, totalFaces: 0, imagesWithFaces: 0,
    safeImages: 0, flaggedImages: 0, pendingReview: 0, ocrExtractions: 0, classifiedImages: 0, uniqueTags: 0
  },
  'object-stats': { topClasses: [], timeline: [], cooccurrence: [] },
  'face-stats': { distribution: [], summary: { total: 0, total_faces: 0, avg_faces: 0 } },
  'moderation-stats': { summary: { safe: 0, flagged: 0, pending_review: 0 }, categories: [] },
  'ocr-stats': { summary: { total: 0 }, languages: [] },
  'classification-stats': { topTags: [], categories: [], treemap: [] }
};

/** Empty data for an action: the matching stats shape, or an empty list for result and other actions. */
export function emptyImageData(action: string): unknown {
  return EMPTY[action] ?? [];
}
