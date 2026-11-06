import { mkdir, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createSessionToken } from '../src/lib/server/auth/session';
import { E2E_SESSION_SECRET, E2E_STORAGE_STATE } from './e2e-auth';

const SESSION_TTL_SECONDS = 60 * 60;

/** Writes a storageState holding a signed admin session, so tests need no database or login flow. */
export default async function globalSetup(): Promise<void> {
  const token = createSessionToken(
    { id: 'e2e-admin', email: 'e2e@example.com', name: 'E2E Admin', role: 'admin' },
    E2E_SESSION_SECRET,
    SESSION_TTL_SECONDS
  );

  const state = {
    cookies: [
      {
        name: 'ex_session',
        value: token,
        domain: 'localhost',
        path: '/',
        httpOnly: true,
        secure: false,
        sameSite: 'Lax',
        expires: Math.floor(Date.now() / 1000) + SESSION_TTL_SECONDS
      }
    ],
    origins: []
  };

  await mkdir(dirname(E2E_STORAGE_STATE), { recursive: true });
  await writeFile(E2E_STORAGE_STATE, JSON.stringify(state, null, 2));
}
