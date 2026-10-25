// Locale-aware number parsing and formatting for inputs and displays.

export type Locale = 'en' | 'it';

const intlLocale: Record<Locale, string> = { en: 'en-GB', it: 'it-IT' };

function separators(locale: Locale): { decimal: string; group: string } {
  return locale === 'it' ? { decimal: ',', group: '.' } : { decimal: '.', group: ',' };
}

/**
 * Parses a user-typed number. Accepts the locale decimal separator and, as a fallback,
 * the other one ("4,20" and "4.20" both mean 4.2 in Italian). With both separators the
 * last one is the decimal. Returns null when the text is not a number.
 */
export function parseNumber(text: string, locale: Locale): number | null {
  let s = text.trim().replace(/[\s\u00a0\u202f']/g, '');
  if (s === '') return null;
  const { decimal, group } = separators(locale);
  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  if (lastDot >= 0 && lastComma >= 0) {
    const dec = lastDot > lastComma ? '.' : ',';
    const grp = dec === '.' ? ',' : '.';
    s = s.split(grp).join('').replace(dec, '.');
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const parts = s.split(sep);
    if (parts.slice(1).some((part) => part === '')) return null;
    const isGrouping =
      parts.length > 2 || (sep === group && parts.length === 2 && parts[1]!.length === 3);
    s = isGrouping ? parts.join('') : parts.join('.');
    if (sep === decimal && parts.length > 2) return null;
  }
  if (!/^[-+]?\d*\.?\d+$/.test(s) && !/^[-+]?\d+\.$/.test(s)) return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

export function formatNumber(
  value: number,
  locale: Locale,
  options: { decimals?: number; minDecimals?: number } = {},
): string {
  const max = options.decimals ?? 2;
  return new Intl.NumberFormat(intlLocale[locale], {
    minimumFractionDigits: options.minDecimals ?? 0,
    maximumFractionDigits: max,
    useGrouping: 'always',
  }).format(value);
}

/** Lengths on screen: always two decimals ("4.20 m"). */
export function formatLength(meters: number, locale: Locale): string {
  return `${formatNumber(meters, locale, { decimals: 2, minDecimals: 2 })} m`;
}

/** Money from integer cents ("€ 1.234,56" in Italian, "€1,234.56" in English). */
export function formatMoney(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale[locale], {
    style: 'currency',
    currency: 'EUR',
    useGrouping: 'always',
  }).format(cents / 100);
}
