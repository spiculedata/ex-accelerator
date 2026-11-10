import { describe, expect, it } from 'vitest';
import { tierDescription } from './tierDescriptions';

// These mirror etl/image_pipeline.py: objects use YOLOv8n/s/m, faces use Haar until the Deep tier (RetinaFace),
// text is read (PaddleOCR) only above Quick Scan, classification is a heuristic until CLIP, and no Gemma step exists.
describe('tierDescription', () => {
  it('names the object model of each mode', () => {
    expect(tierDescription('objects', 'fast')).toContain('YOLOv8n');
    expect(tierDescription('objects', 'standard')).toContain('YOLOv8s');
    expect(tierDescription('objects', 'accurate')).toContain('YOLOv8m');
  });

  it('says Standard counts faces exactly as Quick Scan does, and only Deep Analysis changes the method', () => {
    expect(tierDescription('faces', 'fast')).toContain('Haar');
    expect(tierDescription('faces', 'standard')).toContain('Haar');
    expect(tierDescription('faces', 'standard')).toMatch(/same as Quick Scan/i);
    expect(tierDescription('faces', 'accurate')).toContain('RetinaFace');
  });

  it('says Quick Scan does not read text, and that the other modes use PaddleOCR', () => {
    expect(tierDescription('ocr', 'fast')).toMatch(/does not read text/i);
    expect(tierDescription('ocr', 'standard')).toContain('PaddleOCR');
    expect(tierDescription('ocr', 'accurate')).toContain('PaddleOCR');
  });

  it('uses CLIP for classification from Standard up, a heuristic before that', () => {
    expect(tierDescription('classification', 'fast')).toMatch(/heuristic/i);
    expect(tierDescription('classification', 'standard')).toContain('CLIP ViT-B/32');
    expect(tierDescription('classification', 'accurate')).toContain('CLIP ViT-B/32');
  });

  it('never claims a model the pipeline does not run', () => {
    for (const tool of ['general', 'objects', 'faces', 'ocr', 'classification'] as const) {
      for (const tier of ['fast', 'standard', 'accurate']) expect(tierDescription(tool, tier)).not.toMatch(/gemma/i);
    }
  });

  it('is different for different tools, and general falls back sensibly', () => {
    const blurbs = ['objects', 'faces', 'ocr', 'classification'].map((tool) => tierDescription(tool as any, 'fast'));
    expect(new Set(blurbs).size).toBe(4);
    expect(tierDescription('general', 'fast')).toContain('YOLOv8n');
  });
});
