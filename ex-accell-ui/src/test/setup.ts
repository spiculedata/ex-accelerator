import '@testing-library/jest-dom/vitest';
import { vi, beforeEach } from 'vitest';

// Reset fetch mock between tests
beforeEach(() => {
  vi.restoreAllMocks();
});
