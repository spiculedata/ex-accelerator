import { describe, expect, it } from 'vitest';
import { tierDescription } from './tierDescriptions';

describe('tierDescription', () => {
  it('describes only what the tool actually uses in each mode', () => {
    expect(tierDescription('objects', 'fast')).toContain('YOLOv8n');
    expect(tierDescription('objects', 'fast')).not.toContain('Haar');
    expect(tierDescription('faces', 'fast')).toContain('Haar');
    expect(tierDescription('faces', 'accurate')).toContain('RetinaFace');
    expect(tierDescription('classification', 'standard')).toContain('CLIP ViT-B/32');
  });

  it('says text extraction is the same in every mode', () => {
    for (const tier of ['fast', 'standard', 'accurate']) expect(tierDescription('ocr', tier)).toContain('PaddleOCR');
  });

  it('is different for different tools, so the blurb is no longer the same on every page', () => {
    const blurbs = ['objects', 'faces', 'ocr', 'classification'].map((tool) => tierDescription(tool as any, 'fast'));
    expect(new Set(blurbs).size).toBe(4);
  });

  it('falls back to the general description', () => {
    expect(tierDescription('general', 'fast')).toContain('YOLOv8n');
  });
});
