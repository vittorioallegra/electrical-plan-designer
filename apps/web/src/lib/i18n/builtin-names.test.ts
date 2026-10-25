import { describe, expect, it } from 'vitest';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import { createI18n } from '.';

describe('built-in catalog names', () => {
  // protects=built-in item names render; fails_when=a built-in slug has no locale entry; no_claim=wording
  it.each(['en', 'it'] as const)('every built-in name key resolves in %s', (lng) => {
    const i18n = createI18n(lng);
    const missing = builtinCatalog.filter((item) => !i18n.exists(item.name)).map((i) => i.id);
    expect(missing).toEqual([]);
  });
});
