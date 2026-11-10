// Checking what an administrator types when creating or changing an account.
import { USER_ROLES, type UserRole } from './session';

export const MAX_EMAIL_LENGTH = 254;
export const MAX_NAME_LENGTH = 100;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isEmail = (value: unknown): value is string => typeof value === 'string' && value.length <= MAX_EMAIL_LENGTH && EMAIL.test(value);
export const isUuid = (value: unknown): value is string => typeof value === 'string' && UUID.test(value);
export const isRole = (value: unknown): value is UserRole => typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);
export const isName = (value: unknown): value is string => typeof value === 'string' && value.trim().length > 0 && value.trim().length <= MAX_NAME_LENGTH;

/** The access guard already limits user management to admins; handlers check again so a guard change cannot expose them. */
export const isAdmin = (user: { role?: string } | null | undefined): boolean => user?.role === 'admin';
