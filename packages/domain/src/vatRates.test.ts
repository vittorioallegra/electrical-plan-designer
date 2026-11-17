import { describe, expect, it } from 'vitest';
import { companyCountrySchema, euroCountries, isEuroCountry, standardVatRates } from './vatRates';

describe('VAT rates', () => {
  // protects=the standard VAT rates removed from store prices; fails_when=a rate or the list of euro-area countries changes without this test changing too; no_claim=that the rates are still current law
  it('pins the euro-area standard rates', () => {
    expect(standardVatRates).toEqual({
      AT: 2000,
      BE: 2100,
      BG: 2000,
      CY: 1900,
      DE: 1900,
      EE: 2400,
      ES: 2100,
      FI: 2550,
      FR: 2000,
      GR: 2400,
      HR: 2500,
      IE: 2300,
      IT: 2200,
      LT: 2100,
      LU: 1700,
      LV: 2100,
      MT: 1800,
      NL: 2100,
      PT: 2300,
      SI: 2200,
      SK: 2300,
    });
    expect(euroCountries).toHaveLength(21);
  });

  // protects=company country values; fails_when=a non-euro code or a prototype key passes as a euro country, or `other` is refused; no_claim=the Company page
  it('accepts euro-area codes and other only', () => {
    expect(isEuroCountry('IT')).toBe(true);
    expect(isEuroCountry('CH')).toBe(false);
    expect(isEuroCountry('toString')).toBe(false);
    expect(companyCountrySchema.safeParse('other').success).toBe(true);
    expect(companyCountrySchema.safeParse('US').success).toBe(false);
  });
});
