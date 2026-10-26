// Issued quotes of a project: per-project numbering and the status rules.
// Snapshots are immutable except for their status and note.
import type { IssuedQuote, ProjectQuote, QuoteStatus } from './types';

export type QuoteStatusErrorCode = 'unknown_quote' | 'already_approved';

export class QuoteStatusError extends Error {
  override name = 'QuoteStatusError';
  constructor(readonly code: QuoteStatusErrorCode) {
    super(code);
  }
}

/** 1 for the first quote, then one more than the highest number issued. */
export function nextQuoteNumber(issued: readonly Pick<IssuedQuote, 'number'>[]): number {
  return issued.reduce((max, q) => Math.max(max, q.number), 0) + 1;
}

function withStatus(q: IssuedQuote, status: QuoteStatus, now: Date): IssuedQuote {
  return { ...q, status, statusChangedAt: now.toISOString() };
}

/** Appends a snapshot; every pending (`issued`) quote before it becomes `superseded`. */
export function addIssuedQuote(
  quote: ProjectQuote,
  snapshot: IssuedQuote,
  now: Date,
): ProjectQuote {
  return {
    ...quote,
    issued: [
      ...quote.issued.map((q) => (q.status === 'issued' ? withStatus(q, 'superseded', now) : q)),
      snapshot,
    ],
  };
}

export interface StatusOptions {
  /** When approving: also mark the other pending quotes `rejected`. */
  rejectPending?: boolean;
}

/**
 * Sets the status of quote `number`. At most one quote is approved: approving while another
 * one is approved throws `already_approved` (set that one back first).
 */
export function setQuoteStatus(
  quote: ProjectQuote,
  number: number,
  status: QuoteStatus,
  now: Date,
  options: StatusOptions = {},
): ProjectQuote {
  const target = quote.issued.find((q) => q.number === number);
  if (!target) throw new QuoteStatusError('unknown_quote');
  if (status === 'approved' && quote.issued.some((q) => q.status === 'approved' && q !== target))
    throw new QuoteStatusError('already_approved');
  const rejectOthers = status === 'approved' && options.rejectPending === true;
  return {
    ...quote,
    issued: quote.issued.map((q) => {
      if (q === target) return q.status === status ? q : withStatus(q, status, now);
      if (rejectOthers && q.status === 'issued') return withStatus(q, 'rejected', now);
      return q;
    }),
  };
}

export function setQuoteNote(quote: ProjectQuote, number: number, note: string): ProjectQuote {
  if (!quote.issued.some((q) => q.number === number)) throw new QuoteStatusError('unknown_quote');
  return {
    ...quote,
    issued: quote.issued.map((q) => (q.number === number ? { ...q, note } : q)),
  };
}
