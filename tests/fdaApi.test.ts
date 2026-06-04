import { describe, it, expect, vi, afterEach } from 'vitest';
import { searchOpenFDA } from '@/utils/api/fdaApi';

afterEach(() => vi.restoreAllMocks());

describe('searchOpenFDA', () => {
  it('maps OpenFDA label results to MedicineResult[]', async () => {
    const payload = {
      results: [
        {
          openfda: {
            brand_name: ['Tylenol', 'Tylenol Extra'],
            generic_name: ['acetaminophen'],
            manufacturer_name: ['Acme Pharma'],
          },
        },
      ],
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => payload,
    } as Response));

    const results = await searchOpenFDA('acetaminophen');
    expect(results).toHaveLength(2);
    expect(results[0]).toMatchObject({
      brandName: 'Tylenol',
      activeIngredient: 'acetaminophen',
      country: 'United States',
      manufacturer: 'Acme Pharma',
      source: 'ai',
    });
    expect(results[1].brandName).toBe('Tylenol Extra');
  });

  it('returns [] on a non-ok response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500 } as Response));
    expect(await searchOpenFDA('whatever')).toEqual([]);
  });

  it('returns [] when no results present', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) } as Response));
    expect(await searchOpenFDA('whatever')).toEqual([]);
  });
});
