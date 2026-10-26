import { describe, expect, it } from 'vitest';
import { defaultQuoteSettings } from './defaults';
import {
  addIssuedQuote,
  nextQuoteNumber,
  QuoteStatusError,
  setQuoteNote,
  setQuoteStatus,
} from './issuedQuotes';
import { projectQuoteSchema } from './schema';
import type { IssuedQuote, ProjectQuote } from './types';

const t0 = new Date('2026-10-26T10:00:00.000Z');
const t1 = new Date('2026-10-27T10:00:00.000Z');

function snapshot(number: number): IssuedQuote {
  return {
    number,
    issuedAt: t0.toISOString(),
    language: 'en',
    lines: [{ key: 'k', description: 'd', quantity: 1, unit: 'pcs', unitPrice: 100, total: 100 }],
    settings: defaultQuoteSettings(),
    totals: {
      materialsBeforeAdjustment: 100,
      adjustment: 0,
      materials: 100,
      labor: 0,
      taxable: 100,
      vat: 22,
      total: 122,
      unpricedCount: 0,
    },
    status: 'issued',
    note: '',
  };
}

function quoteWith(...numbers: number[]): ProjectQuote {
  return { settings: defaultQuoteSettings(), issued: numbers.map(snapshot) };
}

const statuses = (q: ProjectQuote) => q.issued.map((i) => i.status);

function codeOf(fn: () => unknown): string | undefined {
  try {
    fn();
  } catch (e) {
    return e instanceof QuoteStatusError ? e.code : 'other';
  }
  return undefined;
}

describe('issued quotes', () => {
  // protects=per-project numbering; fails_when=numbers do not start at 1 or reuse a number after gaps; no_claim=formatting
  it('numbers quotes per project', () => {
    expect(nextQuoteNumber([])).toBe(1);
    expect(nextQuoteNumber(quoteWith(1, 2).issued)).toBe(3);
    expect(nextQuoteNumber(quoteWith(4, 2).issued)).toBe(5);
  });

  // protects=AC 17c supersede on issue; fails_when=issuing leaves earlier pending quotes pending or touches approved/rejected ones; no_claim=UI
  it('supersedes pending quotes when a new one is issued', () => {
    let q = quoteWith(1, 2);
    q = setQuoteStatus(q, 1, 'rejected', t0);
    q = addIssuedQuote(q, snapshot(3), t1);
    expect(statuses(q)).toEqual(['rejected', 'superseded', 'issued']);
    expect(q.issued[1]!.statusChangedAt).toBe(t1.toISOString());
    expect(q.issued[0]!.statusChangedAt).toBe(t0.toISOString());
  });

  // protects=AC 17c one approved quote; fails_when=a second approval is accepted or rejectPending misses pending quotes; no_claim=confirmation dialog
  it('approves at most one quote and can reject the pending ones', () => {
    let q = addIssuedQuote(quoteWith(1), snapshot(2), t0);
    q = { ...q, issued: [...q.issued, { ...snapshot(3) }] };
    const approved = setQuoteStatus(q, 2, 'approved', t1, { rejectPending: true });
    expect(statuses(approved)).toEqual(['superseded', 'approved', 'rejected']);
    expect(projectQuoteSchema.safeParse(approved).success).toBe(true);
    expect(codeOf(() => setQuoteStatus(approved, 3, 'approved', t1))).toBe('already_approved');
    expect(statuses(setQuoteStatus(approved, 2, 'approved', t1))).toEqual(statuses(approved));
    const reopened = setQuoteStatus(approved, 2, 'issued', t1);
    expect(statuses(setQuoteStatus(reopened, 3, 'approved', t1))).toEqual([
      'superseded',
      'issued',
      'approved',
    ]);
  });

  // protects=AC 17c snapshots immutable but status and note; fails_when=a status or note change alters lines, totals or other quotes; no_claim=persistence
  it('changes only status and note', () => {
    const q = quoteWith(1, 2);
    const noted = setQuoteNote(setQuoteStatus(q, 1, 'approved', t1), 1, 'Signed');
    const { status, statusChangedAt, note, ...rest } = noted.issued[0]!;
    const { status: _s, note: _n, ...original } = q.issued[0]!;
    expect({ status, statusChangedAt, note }).toEqual({
      status: 'approved',
      statusChangedAt: t1.toISOString(),
      note: 'Signed',
    });
    expect(rest).toEqual(original);
    expect(noted.issued[1]).toBe(q.issued[1]);
    expect(q.issued[0]!.status).toBe('issued');
    expect(codeOf(() => setQuoteNote(q, 9, 'x'))).toBe('unknown_quote');
    expect(codeOf(() => setQuoteStatus(q, 9, 'rejected', t1))).toBe('unknown_quote');
  });
});
