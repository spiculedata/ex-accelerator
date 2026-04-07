// Structured logger with environment-based log levels
// Redacts sensitive fields, provides consistent formatting

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVELS: Record<LogLevel, number> = { debug: 0, info: 1, warn: 2, error: 3 };

const currentLevel: LogLevel = (
  (typeof process !== 'undefined' ? process.env?.LOG_LEVEL : undefined) as LogLevel
) || 'info';

const REDACT_KEYS = new Set(['password', 'secret', 'token', 'key', 'authorization', 'cookie']);

function redact(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;
  const result: any = {};
  for (const [k, v] of Object.entries(obj)) {
    if (REDACT_KEYS.has(k.toLowerCase())) {
      result[k] = '[REDACTED]';
    } else if (typeof v === 'object' && v !== null) {
      result[k] = redact(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function formatMessage(level: LogLevel, context: string, message: string, data?: any): string {
  const ts = new Date().toISOString();
  const base = `[${ts}] ${level.toUpperCase()} [${context}] ${message}`;
  if (data) return `${base} ${JSON.stringify(redact(data))}`;
  return base;
}

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[currentLevel];
}

export function createLogger(context: string) {
  return {
    debug(message: string, data?: any) {
      if (shouldLog('debug')) console.debug(formatMessage('debug', context, message, data));
    },
    info(message: string, data?: any) {
      if (shouldLog('info')) console.log(formatMessage('info', context, message, data));
    },
    warn(message: string, data?: any) {
      if (shouldLog('warn')) console.warn(formatMessage('warn', context, message, data));
    },
    error(message: string, data?: any) {
      if (shouldLog('error')) console.error(formatMessage('error', context, message, data));
    }
  };
}
