import { describe, expect, it } from 'vitest';
import { formatLength, formatMoney, formatNumber, parseNumber } from './format';

describe('parseNumber', () => {
  // protects=locale decimal input; fails_when="4,20" in Italian is not 4.2; no_claim=every locale
  it.each([
    ['4,20', 'it', 4.2],
    ['4.20', 'it', 4.2],
    ['1.234,56', 'it', 1234.56],
    ['1.234', 'it', 1234],
    ['4.20', 'en', 4.2],
    ['4,20', 'en', 4.2],
    ['1,234.56', 'en', 1234.56],
    ['  -0,5 ', 'it', -0.5],
    ['12', 'en', 12],
  ] as const)('parses %s in %s as %d', (text, locale, expected) => {
    expect(parseNumber(text, locale)).toBeCloseTo(expected, 10);
  });

  // protects=invalid input rejection; fails_when=garbage parses to a number; no_claim=error message text
  it.each(['', 'abc', '4,2,0,1', '1..2', '--1'])('rejects %j', (text) => {
    expect(parseNumber(text, 'it')).toBeNull();
  });
});

describe('formatting', () => {
  // protects=locale display of numbers and money; fails_when=Italian shows dot decimals; no_claim=other currencies
  it('formats numbers, lengths and money per locale', () => {
    expect(formatNumber(1234.5, 'it')).toBe('1.234,5');
    expect(formatNumber(1234.5, 'en')).toBe('1,234.5');
    expect(formatLength(4.2, 'it')).toBe('4,20 m');
    expect(formatLength(4.2, 'en')).toBe('4.20 m');
    expect(formatMoney(123456, 'it')).toBe('1.234,56 €');
    expect(formatMoney(123456, 'en')).toBe('€1,234.56');
  });
});
