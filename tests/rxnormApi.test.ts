import { describe, it, expect, vi, afterEach } from 'vitest';

// Mock the security wrapper that rxnormApi uses for fetching/sanitizing.
vi.mock('@/utils/security/apiSecurity', () => ({
  ApiSecurity: {
    secureApiRequest: vi.fn(),
    sanitizeApiResponse: (d: unknown) => d,
    logSecurityEvent: vi.fn(),
  },
}));

import { searchRxNorm } from '@/utils/api/rxnormApi';
import { ApiSecurity } from '@/utils/security/apiSecurity';

afterEach(() => vi.clearAllMocks());

describe('searchRxNorm', () => {
  it('maps RxNorm drug concepts to MedicineResult[], skipping ingredient ttys', async () => {
    const data = {
      drugGroup: {
        conceptGroup: [
          { tty: 'SBD', conceptProperties: [{ rxcui: '1', name: 'Brand A', tty: 'SBD' }] },
          { tty: 'IN', conceptProperties: [{ rxcui: '2', name: 'Ingredient', tty: 'IN' }] },
        ],
      },
    };
    (ApiSecurity.secureApiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => data,
    });

    const results = await searchRxNorm('ibuprofen');
    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      id: 'rxnorm-1',
      brandName: 'Brand A',
      activeIngredient: 'ibuprofen',
      country: 'United States',
      source: 'rxnorm',
    });
  });

  it('returns [] on a non-ok response', async () => {
    (ApiSecurity.secureApiRequest as ReturnType<typeof vi.fn>).mockResolvedValue({ ok: false, status: 429 });
    expect(await searchRxNorm('x')).toEqual([]);
  });
});
