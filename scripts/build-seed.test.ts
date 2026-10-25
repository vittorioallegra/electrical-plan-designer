import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { defaultProjectSettings, defaultQuoteSettings } from '@/domain/defaults';
import demo from '../tests/fixtures/demo-project.json';
// @ts-expect-error plain JS module without types
import { buildSeed, seedQuote, seedSettings } from './build-seed.mjs';

describe('seed', () => {
  // protects=seed drift; fails_when=seed.sql or its settings differ from the fixture/defaults; no_claim=SQL validity
  it('seed.sql is generated from the fixture and the domain defaults', () => {
    expect(seedSettings).toEqual(defaultProjectSettings());
    expect(seedQuote).toEqual({ settings: defaultQuoteSettings(), issued: [] });
    expect(readFileSync('supabase/seed.sql', 'utf8')).toBe(buildSeed(demo));
  });
});
