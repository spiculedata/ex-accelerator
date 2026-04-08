import { describe, it, expect } from 'vitest';
import {
  required,
  minLength,
  maxLength,
  min,
  max,
  email,
  url,
  pattern,
  numeric,
  integer,
  matchField,
  oneOf,
  custom,
  asyncValidator
} from './useFormValidation';

describe('useFormValidation - validation rules', () => {
  describe('required()', () => {
    const rule = required();

    it('fails on null', () => {
      expect(rule(null)).toBe('This field is required');
    });

    it('fails on undefined', () => {
      expect(rule(undefined)).toBe('This field is required');
    });

    it('fails on empty string', () => {
      expect(rule('')).toBe('This field is required');
    });

    it('fails on whitespace-only string', () => {
      expect(rule('   ')).toBe('This field is required');
    });

    it('fails on empty array', () => {
      expect(rule([])).toBe('This field is required');
    });

    it('passes on non-empty string', () => {
      expect(rule('hello')).toBeNull();
    });

    it('passes on number 0', () => {
      expect(rule(0)).toBeNull();
    });

    it('passes on non-empty array', () => {
      expect(rule([1])).toBeNull();
    });

    it('uses custom message', () => {
      const r = required('Name is required');
      expect(r('')).toBe('Name is required');
    });
  });

  describe('minLength()', () => {
    const rule = minLength(3);

    it('passes when value is empty (use with required for mandatory)', () => {
      expect(rule('')).toBeNull();
    });

    it('fails when too short', () => {
      expect(rule('ab')).toBe('Minimum length is 3 characters');
    });

    it('passes when exactly min length', () => {
      expect(rule('abc')).toBeNull();
    });

    it('passes when longer than min', () => {
      expect(rule('abcdef')).toBeNull();
    });

    it('uses custom message', () => {
      expect(minLength(5, 'Too short!')('abc')).toBe('Too short!');
    });
  });

  describe('maxLength()', () => {
    const rule = maxLength(5);

    it('passes on empty value', () => {
      expect(rule('')).toBeNull();
    });

    it('passes when under max', () => {
      expect(rule('abc')).toBeNull();
    });

    it('passes when exactly max', () => {
      expect(rule('abcde')).toBeNull();
    });

    it('fails when over max', () => {
      expect(rule('abcdef')).toBe('Maximum length is 5 characters');
    });
  });

  describe('min()', () => {
    const rule = min(10);

    it('passes on null', () => {
      expect(rule(null as any)).toBeNull();
    });

    it('passes on undefined', () => {
      expect(rule(undefined as any)).toBeNull();
    });

    it('fails when below minimum', () => {
      expect(rule(5)).toBe('Minimum value is 10');
    });

    it('passes when equal to minimum', () => {
      expect(rule(10)).toBeNull();
    });

    it('passes when above minimum', () => {
      expect(rule(20)).toBeNull();
    });
  });

  describe('max()', () => {
    const rule = max(100);

    it('passes on null', () => {
      expect(rule(null as any)).toBeNull();
    });

    it('fails when above maximum', () => {
      expect(rule(101)).toBe('Maximum value is 100');
    });

    it('passes when equal to maximum', () => {
      expect(rule(100)).toBeNull();
    });

    it('passes when below maximum', () => {
      expect(rule(50)).toBeNull();
    });
  });

  describe('email()', () => {
    const rule = email();

    it('passes on empty value', () => {
      expect(rule('')).toBeNull();
    });

    it('passes on valid email', () => {
      expect(rule('test@example.com')).toBeNull();
    });

    it('fails on missing @', () => {
      expect(rule('testexample.com')).toBe('Invalid email address');
    });

    it('fails on missing domain', () => {
      expect(rule('test@')).toBe('Invalid email address');
    });

    it('fails on missing TLD', () => {
      expect(rule('test@example')).toBe('Invalid email address');
    });

    it('uses custom message', () => {
      expect(email('Bad email')('nope')).toBe('Bad email');
    });
  });

  describe('url()', () => {
    const rule = url();

    it('passes on empty value', () => {
      expect(rule('')).toBeNull();
    });

    it('passes on valid URL', () => {
      expect(rule('https://example.com')).toBeNull();
    });

    it('fails on invalid URL', () => {
      expect(rule('not-a-url')).toBe('Invalid URL');
    });

    it('passes on URL with path', () => {
      expect(rule('http://example.com/path?q=1')).toBeNull();
    });
  });

  describe('pattern()', () => {
    const rule = pattern(/^\d{3}-\d{4}$/, 'Must be XXX-XXXX');

    it('passes on empty value', () => {
      expect(rule('')).toBeNull();
    });

    it('passes when matching', () => {
      expect(rule('123-4567')).toBeNull();
    });

    it('fails when not matching', () => {
      expect(rule('12-456')).toBe('Must be XXX-XXXX');
    });
  });

  describe('numeric()', () => {
    const rule = numeric();

    it('passes on null', () => {
      expect(rule(null)).toBeNull();
    });

    it('passes on empty string', () => {
      expect(rule('')).toBeNull();
    });

    it('passes on number', () => {
      expect(rule(42)).toBeNull();
    });

    it('passes on numeric string', () => {
      expect(rule('3.14')).toBeNull();
    });

    it('fails on non-numeric string', () => {
      expect(rule('abc')).toBe('Must be a number');
    });
  });

  describe('integer()', () => {
    const rule = integer();

    it('passes on null', () => {
      expect(rule(null)).toBeNull();
    });

    it('passes on empty string', () => {
      expect(rule('')).toBeNull();
    });

    it('passes on integer', () => {
      expect(rule(10)).toBeNull();
    });

    it('passes on integer string', () => {
      expect(rule('10')).toBeNull();
    });

    it('fails on float', () => {
      expect(rule(3.5)).toBe('Must be an integer');
    });

    it('fails on non-numeric', () => {
      expect(rule('abc')).toBe('Must be an integer');
    });
  });

  describe('matchField()', () => {
    const rule = matchField('password');

    it('passes when values match', () => {
      expect(rule('secret', { password: 'secret' })).toBeNull();
    });

    it('fails when values differ', () => {
      expect(rule('secret', { password: 'other' })).toBe('Must match password');
    });

    it('passes on empty value (use with required)', () => {
      expect(rule('', { password: 'secret' })).toBeNull();
    });

    it('passes when no formData provided', () => {
      expect(rule('val')).toBeNull();
    });

    it('uses custom message', () => {
      const r = matchField('password', 'Passwords must match');
      expect(r('a', { password: 'b' })).toBe('Passwords must match');
    });
  });

  describe('oneOf()', () => {
    const rule = oneOf(['red', 'green', 'blue']);

    it('passes on empty value', () => {
      expect(rule('')).toBeNull();
    });

    it('passes when value is in list', () => {
      expect(rule('red')).toBeNull();
    });

    it('fails when value not in list', () => {
      expect(rule('yellow')).toBe('Must be one of: red, green, blue');
    });
  });

  describe('custom()', () => {
    it('returns null when validator returns true', () => {
      const rule = custom((v: number) => v % 2 === 0, 'Must be even');
      expect(rule(4)).toBeNull();
    });

    it('returns message when validator returns false', () => {
      const rule = custom((v: number) => v % 2 === 0, 'Must be even');
      expect(rule(3)).toBe('Must be even');
    });

    it('receives formData as second argument', () => {
      const rule = custom(
        (v: string, form?: Record<string, any>) => v !== form?.other,
        'Must differ'
      );
      expect(rule('same', { other: 'same' })).toBe('Must differ');
      expect(rule('diff', { other: 'same' })).toBeNull();
    });
  });

  describe('asyncValidator()', () => {
    it('always returns null (sync placeholder)', () => {
      const rule = asyncValidator(async (v: string) => v === 'ok', 'Not ok');
      expect(rule('anything')).toBeNull();
    });
  });
});
