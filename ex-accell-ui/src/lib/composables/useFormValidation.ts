/**
 * Form Validation Composable
 *
 * Provides a flexible, reusable form validation system with built-in
 * validation rules and custom rule support.
 *
 * Features:
 * - Field-level validation
 * - Form-level validation
 * - Built-in validation rules (required, email, minLength, etc.)
 * - Custom validation rules
 * - Real-time vs. submit validation modes
 * - Type-safe error messages
 *
 * @example
 * ```typescript
 * const validator = createFormValidator({
 *   email: [required(), email()],
 *   password: [required(), minLength(8)],
 *   age: [required(), min(18), max(120)]
 * });
 *
 * const form = { email: '', password: '', age: 0 };
 *
 * // Validate entire form
 * if (validator.validate(form)) {
 *   // Submit form
 * }
 *
 * // Validate single field
 * validator.validateField('email', form);
 *
 * // Check if has errors
 * if (validator.hasError('email')) {
 *   console.log(validator.getError('email'));
 * }
 * ```
 */

export type ValidationRule<T = any> = (value: T, formData?: Record<string, any>) => string | null;

export interface ValidatorState<T extends Record<string, any>> {
  /**
   * Error messages by field
   */
  errors: Partial<Record<keyof T, string[]>>;

  /**
   * Whether the form is valid
   */
  isValid: boolean;

  /**
   * Validate entire form
   */
  validate: (form: T) => boolean;

  /**
   * Validate a single field
   */
  validateField: (field: keyof T, form: T) => boolean;

  /**
   * Clear all errors
   */
  clearErrors: () => void;

  /**
   * Clear error for specific field
   */
  clearError: (field: keyof T) => void;

  /**
   * Check if field has error
   */
  hasError: (field: keyof T) => boolean;

  /**
   * Get error message for field
   */
  getError: (field: keyof T) => string | null;

  /**
   * Get all errors for field
   */
  getErrors: (field: keyof T) => string[];

  /**
   * Set custom error for field
   */
  setError: (field: keyof T, message: string) => void;
}

/**
 * Create a form validator
 */
export function createFormValidator<T extends Record<string, any>>(
  rules: Partial<Record<keyof T, ValidationRule<any>[]>>
): ValidatorState<T> {
  let errors = $state<Partial<Record<keyof T, string[]>>>({});
  let isValid = $state(false);

  /**
   * Validate entire form
   */
  function validate(form: T): boolean {
    const newErrors: Partial<Record<keyof T, string[]>> = {};

    for (const [field, fieldRules] of Object.entries(rules) as [keyof T, ValidationRule[]][]) {
      const fieldErrors = fieldRules
        .map(rule => rule(form[field], form))
        .filter(Boolean) as string[];

      if (fieldErrors.length > 0) {
        newErrors[field] = fieldErrors;
      }
    }

    errors = newErrors;
    isValid = Object.keys(newErrors).length === 0;
    return isValid;
  }

  /**
   * Validate a single field
   */
  function validateField(field: keyof T, form: T): boolean {
    const fieldRules = rules[field];
    if (!fieldRules) {
      clearError(field);
      return true;
    }

    const fieldErrors = fieldRules
      .map(rule => rule(form[field], form))
      .filter(Boolean) as string[];

    if (fieldErrors.length > 0) {
      errors = { ...errors, [field]: fieldErrors };
      return false;
    } else {
      clearError(field);
      return true;
    }
  }

  /**
   * Clear all errors
   */
  function clearErrors(): void {
    errors = {};
    isValid = false;
  }

  /**
   * Clear error for specific field
   */
  function clearError(field: keyof T): void {
    const newErrors = { ...errors };
    delete newErrors[field];
    errors = newErrors;
  }

  /**
   * Check if field has error
   */
  function hasError(field: keyof T): boolean {
    return errors[field] !== undefined && errors[field]!.length > 0;
  }

  /**
   * Get first error message for field
   */
  function getError(field: keyof T): string | null {
    const fieldErrors = errors[field];
    return fieldErrors && fieldErrors.length > 0 ? fieldErrors[0] : null;
  }

  /**
   * Get all errors for field
   */
  function getErrors(field: keyof T): string[] {
    return errors[field] || [];
  }

  /**
   * Set custom error for field
   */
  function setError(field: keyof T, message: string): void {
    errors = { ...errors, [field]: [message] };
    isValid = false;
  }

  return {
    get errors() { return errors; },
    get isValid() { return isValid; },
    validate,
    validateField,
    clearErrors,
    clearError,
    hasError,
    getError,
    getErrors,
    setError
  };
}

// ===================================================================
// Built-in Validation Rules
// ===================================================================

/**
 * Required field validation
 */
export function required(message = 'This field is required'): ValidationRule {
  return (value: any) => {
    if (value === null || value === undefined || value === '') {
      return message;
    }
    if (typeof value === 'string' && value.trim() === '') {
      return message;
    }
    if (Array.isArray(value) && value.length === 0) {
      return message;
    }
    return null;
  };
}

/**
 * Minimum length validation
 */
export function minLength(min: number, message?: string): ValidationRule<string> {
  return (value: string) => {
    if (!value) return null; // Use with required() for required fields
    if (value.length < min) {
      return message || `Minimum length is ${min} characters`;
    }
    return null;
  };
}

/**
 * Maximum length validation
 */
export function maxLength(max: number, message?: string): ValidationRule<string> {
  return (value: string) => {
    if (!value) return null;
    if (value.length > max) {
      return message || `Maximum length is ${max} characters`;
    }
    return null;
  };
}

/**
 * Minimum value validation
 */
export function min(minValue: number, message?: string): ValidationRule<number> {
  return (value: number) => {
    if (value === null || value === undefined) return null;
    if (value < minValue) {
      return message || `Minimum value is ${minValue}`;
    }
    return null;
  };
}

/**
 * Maximum value validation
 */
export function max(maxValue: number, message?: string): ValidationRule<number> {
  return (value: number) => {
    if (value === null || value === undefined) return null;
    if (value > maxValue) {
      return message || `Maximum value is ${maxValue}`;
    }
    return null;
  };
}

/**
 * Email format validation
 */
export function email(message = 'Invalid email address'): ValidationRule<string> {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return (value: string) => {
    if (!value) return null;
    if (!emailRegex.test(value)) {
      return message;
    }
    return null;
  };
}

/**
 * URL format validation
 */
export function url(message = 'Invalid URL'): ValidationRule<string> {
  return (value: string) => {
    if (!value) return null;
    try {
      new URL(value);
      return null;
    } catch {
      return message;
    }
  };
}

/**
 * Pattern (regex) validation
 */
export function pattern(regex: RegExp, message = 'Invalid format'): ValidationRule<string> {
  return (value: string) => {
    if (!value) return null;
    if (!regex.test(value)) {
      return message;
    }
    return null;
  };
}

/**
 * Numeric value validation
 */
export function numeric(message = 'Must be a number'): ValidationRule<any> {
  return (value: any) => {
    if (value === null || value === undefined || value === '') return null;
    if (isNaN(Number(value))) {
      return message;
    }
    return null;
  };
}

/**
 * Integer value validation
 */
export function integer(message = 'Must be an integer'): ValidationRule<any> {
  return (value: any) => {
    if (value === null || value === undefined || value === '') return null;
    const num = Number(value);
    if (isNaN(num) || !Number.isInteger(num)) {
      return message;
    }
    return null;
  };
}

/**
 * Match field validation (e.g., password confirmation)
 */
export function matchField<T extends Record<string, any>>(
  fieldName: keyof T,
  message?: string
): ValidationRule<any> {
  return (value: any, formData?: Record<string, any>) => {
    if (!value || !formData) return null;
    if (value !== formData[fieldName as string]) {
      return message || `Must match ${String(fieldName)}`;
    }
    return null;
  };
}

/**
 * One of (whitelist) validation
 */
export function oneOf<T>(allowed: T[], message?: string): ValidationRule<T> {
  return (value: T) => {
    if (!value) return null;
    if (!allowed.includes(value)) {
      return message || `Must be one of: ${allowed.join(', ')}`;
    }
    return null;
  };
}

/**
 * Custom validation rule
 */
export function custom<T>(
  validator: (value: T, formData?: Record<string, any>) => boolean,
  message: string
): ValidationRule<T> {
  return (value: T, formData?: Record<string, any>) => {
    return validator(value, formData) ? null : message;
  };
}

/**
 * Async validation rule (for API checks, etc.)
 */
export function asyncValidator<T>(
  validator: (value: T) => Promise<boolean>,
  message: string
): ValidationRule<T> {
  return (value: T) => {
    // Note: This is a simple sync wrapper
    // For true async validation, you'd need a different approach
    // This is a placeholder that always returns null (valid)
    // Real async validation should be handled separately in the component
    return null;
  };
}
