import type { CrawlerConfig, StepValidation } from './types';

const TELEGRAM_URL_PATTERNS = [
  // Public username links: t.me/<username>
  /^https?:\/\/t\.me\/[a-zA-Z][a-zA-Z0-9_]{4,31}$/,
  // Public username with parameters: t.me/<username>?text=...&profile
  /^https?:\/\/t\.me\/[a-zA-Z][a-zA-Z0-9_]{4,31}\?.*$/,
  // Message links public: t.me/<username>/<id>
  /^https?:\/\/t\.me\/[a-zA-Z][a-zA-Z0-9_]{4,31}\/\d+$/,
  // Message links private: t.me/c/<channel>/<id>
  /^https?:\/\/t\.me\/c\/\d+\/\d+$/,
  // Phone number links: t.me/+<phone_number>
  /^https?:\/\/t\.me\/\+\d+$/,
  // Chat invite links: t.me/+<hash>
  /^https?:\/\/t\.me\/\+[a-zA-Z0-9_-]+$/,
  // Story links: t.me/<username>/s/<story_id>
  /^https?:\/\/t\.me\/[a-zA-Z][a-zA-Z0-9_]{4,31}\/s\/\d+$/,
  // tg:// protocol links
  /^tg:\/\/resolve\?domain=[a-zA-Z][a-zA-Z0-9_]{4,31}.*$/
];

const RESERVED_TELEGRAM_NAMES = ['www', 'auth', 'login', 'addemoji', 'joinchat'];

/** Valid Telegram URL patterns follow https://core.telegram.org/api/links */
export function validateTelegramUrl(url: string): boolean {
  if (!url.trim()) return false;

  const cleanUrl = url.trim().replace(/\/+$/, '');

  const usernameMatch = cleanUrl.match(/t\.me\/([^\/\?]+)/);
  if (usernameMatch && RESERVED_TELEGRAM_NAMES.includes(usernameMatch[1].toLowerCase())) {
    return false;
  }

  return TELEGRAM_URL_PATTERNS.some((pattern) => pattern.test(cleanUrl));
}

/** TDLib URLs must end in .tgz or .tar.gz */
export function validateTdlibUrl(url: string): boolean {
  if (!url.trim()) return false;

  const cleanUrl = url.trim();
  return cleanUrl.endsWith('.tgz') || cleanUrl.endsWith('.tar.gz');
}

export function getUrlValidationErrors(config: CrawlerConfig): string[] {
  const errors: string[] = [];
  if (config.platform !== 'telegram') return errors;

  for (const url of config.urls) {
    if (url.trim() && !validateTelegramUrl(url)) {
      errors.push(`Invalid Telegram URL: ${url}`);
    }
  }

  for (const url of config.tdlibDatabaseURLs) {
    if (url.trim() && !validateTdlibUrl(url)) {
      errors.push(`TDLib URL must end with .tgz or .tar.gz: ${url}`);
    }
  }

  return errors;
}

/** Whether no existing job (from any source) already uses this name, ignoring case. */
export function isJobNameUnique(name: string, existingJobs: Array<{ name: string }>): boolean {
  if (!name.trim()) return true; // Empty names are handled by required validation

  const trimmedName = name.trim().toLowerCase();
  return !existingJobs.map((job) => job.name.toLowerCase()).includes(trimmedName);
}

export function validateBasicStep(config: CrawlerConfig, existingJobs: Array<{ name: string }>): StepValidation {
  const errors: string[] = [];

  if (!config.name.trim()) {
    errors.push('Job name is required');
  } else if (!isJobNameUnique(config.name, existingJobs)) {
    errors.push('Job name already exists. Please choose a unique name.');
  }

  return { isValid: errors.length === 0, errors };
}

export function validatePlatformStep(config: CrawlerConfig): StepValidation {
  const errors: string[] = [];

  if (config.urls.length === 0 && !config.urlFileURL.trim()) {
    errors.push('At least one URL or URL file is required');
  }

  errors.push(...getUrlValidationErrors(config));

  if (config.platform === 'telegram') {
    if (config.tdlibDatabaseURLs.length === 0 || !config.tdlibDatabaseURLs.some((u) => u.trim())) {
      errors.push('At least one TDLib database URL is required for Telegram crawling');
    }
  }

  return { isValid: errors.length === 0, errors };
}

/** The advanced step has no required fields. */
export function validateAdvancedStep(): StepValidation {
  return { isValid: true, errors: [] };
}

export function validateCurrentStep(
  step: string,
  config: CrawlerConfig,
  existingJobs: Array<{ name: string }>
): StepValidation {
  switch (step) {
    case 'basic':
      return validateBasicStep(config, existingJobs);
    case 'platform':
      return validatePlatformStep(config);
    case 'advanced':
      return validateAdvancedStep();
    default:
      return { isValid: true, errors: [] }; // Review needs no validation
  }
}

/** Whether the whole crawler form may be saved. */
export function validateForm(config: CrawlerConfig): boolean {
  if (!config.name.trim()) return false;
  if (config.urls.length === 0 && !config.urlFileURL.trim()) return false;
  if (config.platform === 'telegram' && config.tdlibDatabaseURLs.length === 0) return false;
  if (getUrlValidationErrors(config).length > 0) return false;
  return true;
}
