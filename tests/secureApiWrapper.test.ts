import { describe, it, expect, vi, afterEach } from 'vitest';

// Avoid initializing the real Supabase client at import time.
vi.mock('@/integrations/supabase/client', () => ({ supabase: { functions: { invoke: vi.fn() } } }));

import { SecureApiWrapper } from '@/utils/api/secureApiWrapper';

afterEach(() => vi.unstubAllEnvs());

describe('SecureApiWrapper.isSecureApiAvailable (VITE_USE_SECURE_API toggle)', () => {
  it('defaults to false (client-side) when the flag is unset', () => {
    expect(SecureApiWrapper.isSecureApiAvailable()).toBe(false);
  });

  it('is false for any value other than the string "true"', () => {
    vi.stubEnv('VITE_USE_SECURE_API', 'false');
    expect(SecureApiWrapper.isSecureApiAvailable()).toBe(false);
    vi.stubEnv('VITE_USE_SECURE_API', '1');
    expect(SecureApiWrapper.isSecureApiAvailable()).toBe(false);
  });

  it('is true only when set to "true"', () => {
    vi.stubEnv('VITE_USE_SECURE_API', 'true');
    expect(SecureApiWrapper.isSecureApiAvailable()).toBe(true);
  });

  it('getApiStatus reflects the toggle', () => {
    vi.stubEnv('VITE_USE_SECURE_API', 'true');
    const status = SecureApiWrapper.getApiStatus();
    expect(status.openai).toEqual({ available: true, secure: true });

    vi.stubEnv('VITE_USE_SECURE_API', 'false');
    expect(SecureApiWrapper.getApiStatus().openai).toEqual({ available: false, secure: false });
  });
});
