import { describe, expect, it } from 'vitest';
import en from './locales/en.json';
import itLocale from './locales/it.json';
import { createI18n } from './index';

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

describe('plural forms', () => {
  // protects=singular/plural wording of counted strings; fails_when=a count of 1 renders a plural noun or nested counts are not resolved; no_claim=languages other than en/it
  it('picks the singular for one and the plural otherwise, including nested counts', () => {
    const en = createI18n('en');
    expect(en.t('circuits.targets', { count: 1 })).toBe('1 target');
    expect(en.t('circuits.targets', { count: 3 })).toBe('3 targets');
    expect(en.t('editor.deleteConfirm.body', { nodes: 1, segments: 2 })).toBe(
      'This removes 1 element and 2 conduit segments.',
    );
    const itI18n = createI18n('it');
    expect(itI18n.t('panel.deleteUsed', { count: 1 })).toBe(
      'Elimina (1 circuito resta senza protezione)',
    );
    expect(itI18n.t('pdf.summary', { floors: 1, circuits: 2, segments: 1, warnings: 0 })).toBe(
      '1 piano · 2 circuiti · 1 tratto di tubo · 0 avvisi aperti',
    );
  });

  it('defines _other for every _one key', () => {
    for (const locale of [en, itLocale]) {
      const all = keys(locale);
      for (const k of all.filter((key) => key.endsWith('_one'))) {
        expect(all).toContain(k.replace(/_one$/, '_other'));
      }
    }
  });
});
