import { json } from '@sveltejs/kit';

/** The reply for a `type` no handler serves: an empty 200 envelope that lists a few endpoints. */
export function unsupportedTypeResponse(type: string | null): Response {
  return json({
    success: true,
    data: [],
    message: `Query type '${type}' not implemented yet`,
    endpoints: {
      test: '/api/unified-analytics?type=test',
      'cross-platform-sentiment': '/api/unified-analytics?type=cross-platform-sentiment',
      'sentiment-trends': '/api/unified-analytics?type=sentiment-trends',
      'radio-overview': '/api/unified-analytics?type=radio-overview',
      'radio-sentiment': '/api/unified-analytics?type=radio-sentiment',
      'radio-by-station': '/api/unified-analytics?type=radio-by-station',
      'radio-trends': '/api/unified-analytics?type=radio-trends',
      'radio-topics': '/api/unified-analytics?type=radio-topics',
      'radio-political': '/api/unified-analytics?type=radio-political',
      'radio-transcripts': '/api/unified-analytics?type=radio-transcripts',
      'radio-wordcloud': '/api/unified-analytics?type=radio-wordcloud',
      'investigation-timeline': '/api/unified-analytics?type=investigation-timeline&keywords=...&date_start=...&date_end=...',
      'investigation-gdelt-events': '/api/unified-analytics?type=investigation-gdelt-events&keywords=...&date_start=...&date_end=...',
      'investigation-radio-segments': '/api/unified-analytics?type=investigation-radio-segments&keywords=...&date_start=...&date_end=...',
      'investigation-social-posts': '/api/unified-analytics?type=investigation-social-posts&keywords=...&date_start=...&date_end=...',
      'investigation-keyword-overlap': '/api/unified-analytics?type=investigation-keyword-overlap&keywords=...&date_start=...&date_end=...'
    }
  });
}
