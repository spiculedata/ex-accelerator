import { describe, expect, it } from 'vitest';
import { noSourcesMessage } from './sourceLabels';

describe('noSourcesMessage', () => {
  it('names the kind of data in words and says what to do', () => {
    expect(noSourcesMessage(['radio'])).toBe('No radio data yet. Link a radio dataset to this workspace to see results here.');
    expect(noSourcesMessage(['social_media'])).toBe('No social media data yet. Link a social media dataset to this workspace to see results here.');
  });

  it('joins several kinds and never shows the internal type names', () => {
    expect(noSourcesMessage(['gdelt_events', 'gdelt_gkg'])).toBe('No GDELT events or GDELT knowledge graph data yet. Link a matching dataset to this workspace to see results here.');
  });

  it('is general when no kind is asked for', () => {
    expect(noSourcesMessage([])).toBe('No data sources yet. Link a dataset to this workspace to see results here.');
  });
});
