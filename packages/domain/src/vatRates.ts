// The countries a company can buy in, and the standard VAT rate of each. Only euro-area
// countries: the app's money is EUR. Rates change by law, so a change here is a new release.
import { z } from 'zod';

/**
 * Standard VAT rate of each euro-area country, in basis points (2200 = 22%). Checked on
 * 2026-11-17 against several published tables (Bulgaria joined the euro on 2026-01-01).
 */
export const standardVatRates = {
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
} as const;

export type EuroCountry = keyof typeof standardVatRates;
export const euroCountries = Object.keys(standardVatRates) as EuroCountry[];

/** A company's country: a euro-area ISO 3166-1 alpha-2 code, or `other`. */
export const companyCountrySchema = z.union([
  z.enum(euroCountries as [EuroCountry, ...EuroCountry[]]),
  z.literal('other'),
]);
export type CompanyCountry = z.infer<typeof companyCountrySchema>;

export const DEFAULT_COMPANY_COUNTRY: CompanyCountry = 'IT';

export function isEuroCountry(value: unknown): value is EuroCountry {
  return typeof value === 'string' && Object.hasOwn(standardVatRates, value);
}
