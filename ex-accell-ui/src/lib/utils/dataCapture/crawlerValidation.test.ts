import { describe, it, expect } from 'vitest';
import {
  getUrlValidationErrors,
  isJobNameUnique,
  validateAdvancedStep,
  validateBasicStep,
  validateCurrentStep,
  validateForm,
  validatePlatformStep,
  validateTdlibUrl,
  validateTelegramUrl
} from './crawlerValidation';
import { createDefaultCrawlerConfig } from './configDefaults';
import type { CrawlerConfig } from './types';

const configWith = (overrides: Partial<CrawlerConfig>): CrawlerConfig => ({
  ...createDefaultCrawlerConfig(),
  ...overrides
});

describe('validateTelegramUrl', () => {
  it.each([
    'https://t.me/channel_name',
    'http://t.me/channel_name/',
    'https://t.me/channel_name?profile',
    'https://t.me/channel_name/123',
    'https://t.me/c/1234/56',
    'https://t.me/+441234567890',
    'https://t.me/+AbC_d-12',
    'https://t.me/channel_name/s/9',
    'tg://resolve?domain=channel_name'
  ])('accepts %s', (url) => {
    expect(validateTelegramUrl(url)).toBe(true);
  });

  it.each(['', '   ', 'https://t.me/abc', 'https://example.com/channel_name', 'channel_name', 'https://t.me/joinchat', 'https://t.me/Login'])(
    'rejects %j',
    (url) => {
      expect(validateTelegramUrl(url)).toBe(false);
    }
  );
});

describe('validateTdlibUrl', () => {
  it('accepts .tgz and .tar.gz archives', () => {
    expect(validateTdlibUrl('https://x.test/db.tgz')).toBe(true);
    expect(validateTdlibUrl('  https://x.test/db.tar.gz  ')).toBe(true);
  });

  it('rejects other endings and blanks', () => {
    expect(validateTdlibUrl('https://x.test/db.zip')).toBe(false);
    expect(validateTdlibUrl('  ')).toBe(false);
  });
});

describe('getUrlValidationErrors', () => {
  it('reports invalid Telegram and TDLib URLs', () => {
    const errors = getUrlValidationErrors(
      configWith({ urls: ['https://t.me/channel_name', 'nope', ' '], tdlibDatabaseURLs: ['bad.zip'] })
    );
    expect(errors).toEqual(['Invalid Telegram URL: nope', 'TDLib URL must end with .tgz or .tar.gz: bad.zip']);
  });

  it('does not validate URLs for other platforms', () => {
    expect(getUrlValidationErrors(configWith({ platform: 'youtube', urls: ['nope'] }))).toEqual([]);
  });
});

describe('isJobNameUnique', () => {
  const jobs = [{ name: 'Existing Job' }];

  it('treats blank names as unique so the required rule reports them', () => {
    expect(isJobNameUnique('   ', jobs)).toBe(true);
  });

  it('compares trimmed and case-insensitively', () => {
    expect(isJobNameUnique('  existing job ', jobs)).toBe(false);
    expect(isJobNameUnique('other', jobs)).toBe(true);
  });
});

describe('step validation', () => {
  const jobs = [{ name: 'taken' }];

  it('requires a unique job name on the basic step', () => {
    expect(validateBasicStep(configWith({ name: '' }), jobs).errors).toEqual(['Job name is required']);
    expect(validateBasicStep(configWith({ name: 'Taken' }), jobs).errors).toEqual([
      'Job name already exists. Please choose a unique name.'
    ]);
    expect(validateBasicStep(configWith({ name: 'fresh' }), jobs).isValid).toBe(true);
  });

  it('requires URLs and a TDLib database for Telegram on the platform step', () => {
    expect(validatePlatformStep(configWith({})).errors).toEqual([
      'At least one URL or URL file is required',
      'At least one TDLib database URL is required for Telegram crawling'
    ]);
    const ok = configWith({ urls: ['https://t.me/channel_name'], tdlibDatabaseURLs: ['db.tgz'] });
    expect(validatePlatformStep(ok)).toEqual({ isValid: true, errors: [] });
  });

  it('accepts a URL file instead of direct URLs and skips TDLib for YouTube', () => {
    const yt = configWith({ platform: 'youtube', urlFileURL: 'https://x.test/urls.txt' });
    expect(validatePlatformStep(yt).isValid).toBe(true);
  });

  it('has no required fields on the advanced step', () => {
    expect(validateAdvancedStep()).toEqual({ isValid: true, errors: [] });
  });

  it('dispatches by step and passes unknown or review steps', () => {
    expect(validateCurrentStep('basic', configWith({}), jobs).isValid).toBe(false);
    expect(validateCurrentStep('platform', configWith({}), jobs).isValid).toBe(false);
    expect(validateCurrentStep('advanced', configWith({}), jobs).isValid).toBe(true);
    expect(validateCurrentStep('review', configWith({}), jobs).isValid).toBe(true);
    expect(validateCurrentStep('other', configWith({}), jobs).isValid).toBe(true);
  });
});

describe('validateForm', () => {
  const valid = configWith({ name: 'a', urls: ['https://t.me/channel_name'], tdlibDatabaseURLs: ['db.tgz'] });

  it('accepts a complete form', () => {
    expect(validateForm(valid)).toBe(true);
  });

  it('rejects a missing name, missing URLs, missing TDLib list, and bad URLs', () => {
    expect(validateForm({ ...valid, name: ' ' })).toBe(false);
    expect(validateForm({ ...valid, urls: [] })).toBe(false);
    expect(validateForm({ ...valid, tdlibDatabaseURLs: [] })).toBe(false);
    expect(validateForm({ ...valid, urls: ['nope'] })).toBe(false);
  });
});
