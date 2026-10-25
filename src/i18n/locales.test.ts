import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import itLocale from './locales/it.json';

function keys(obj: object, prefix = ''): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    v && typeof v === 'object' ? keys(v as object, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

describe('locales', () => {
  // protects=AC 16 translation completeness; fails_when=a key exists in en but not in it (or vice versa); no_claim=translation quality
  it('it.json has exactly the keys of en.json', () => {
    expect(keys(itLocale).sort()).toEqual(keys(en).sort());
  });
});
