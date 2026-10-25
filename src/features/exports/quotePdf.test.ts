// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { createI18n } from '@/i18n';
import { pdfText } from '@/testing/pdfText';
import { buildQuotePdf } from './quotePdf';
import type { QuoteDocument } from './quoteCsv';

const live: QuoteDocument = {
  lines: [
    {
      key: 'cable:2.5:brown',
      description: 'Cavo H07V-K 2,5 mm² marrone',
      quantity: 52,
      unit: 'm',
      unitPrice: 45,
      total: 2340,
    },
    {
      key: 'builtin:box_503',
      description: 'Scatola 503',
      quantity: 4,
      unit: 'pcs',
      unitPrice: null,
      total: null,
    },
  ],
  settings: {
    materialAdjustmentPercent: 0,
    vatPercent: 10,
    laborLines: [{ kind: 'lump', description: 'Cablaggio quadro', amount: 150 }],
  },
  totals: {
    materialsBeforeAdjustment: 2340,
    adjustment: 0,
    materials: 2340,
    labor: 15000,
    taxable: 17340,
    vat: 1734,
    total: 19074,
    unpricedCount: 1,
  },
};

const profile = {
  businessName: 'Elettricità Rossi',
  vatNumber: 'IT01234567890',
  address: 'Via Garibaldi 3, Torino',
  phone: '',
  email: 'info@rossi.example',
};
const meta = { name: 'Casa Bianchi', clientName: 'Mario Bianchi', address: 'Via Po 1' };

describe('quote PDF', () => {
  // protects=AC 15 quote PDF with business header; fails_when=header fields, € amounts or accented text are missing or garbled; no_claim=visual layout
  it('renders the business header, lines and totals in Italian', async () => {
    const pdf = buildQuotePdf({
      quote: { ...live, number: 7, issuedAt: '2026-10-25T09:00:00.000Z', language: 'it' },
      profile,
      meta,
      t: createI18n('it').t,
      locale: 'it',
      now: new Date('2026-10-26T00:00:00Z'),
    });
    const { pages, text } = await pdfText(pdf.bytes());
    expect(pages).toBe(1);
    const page = text[0]!;
    expect(page).toContain('Elettricità Rossi');
    expect(page).toContain('P. IVA IT01234567890');
    expect(page).toContain('info@rossi.example');
    expect(page).not.toContain(' · ');
    expect(page).toContain('Preventivo 2026-007');
    expect(page).toContain('Cliente: Mario Bianchi');
    expect(page).toContain('Cavo H07V-K 2,5 mm² marrone');
    expect(page).toContain('Scatola 503 (Senza prezzo)');
    expect(page).toContain('Cablaggio quadro');
    expect(page).toContain('IVA 10%');
    expect(page).toMatch(/190,74\s€/);
  });

  // protects=long quotes; fails_when=lines overflow the page instead of continuing on a new one; no_claim=—
  it('continues long quotes on more pages', async () => {
    const lines = Array.from({ length: 80 }, (_, i) => ({ ...live.lines[0]!, key: `k${i}` }));
    const pdf = buildQuotePdf({
      quote: { ...live, lines },
      profile: { ...profile, businessName: '' },
      meta,
      t: createI18n('en').t,
      locale: 'en',
      now: new Date('2026-10-26T00:00:00Z'),
    });
    const { pages, text } = await pdfText(pdf.bytes());
    expect(pages).toBeGreaterThan(1);
    expect(text[0]).toContain('Quote (draft)');
    expect(text[1]).toContain('Description');
  });
});
