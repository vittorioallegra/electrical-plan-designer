import { FileSpreadsheet, FileText } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  QuoteStatusError,
  setQuoteNote,
  setQuoteStatus,
  type StatusOptions,
} from '@epd/domain/issuedQuotes';
import { CommandError } from '@/stores/editor/editorStore';
import { quoteStatusSchema } from '@epd/domain/schema';
import type { IssuedQuote, QuoteStatus } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { Select } from '@/components/ui/Select';
import { Table } from '@/components/ui/Table';
import { fieldBox } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { cn } from '@/lib/cn';
import { formatMoney, type Locale } from '@/lib/format';
import { useEditorContext } from '@/stores/editor/EditorContext';

const statusTone: Record<QuoteStatus, string> = {
  issued: '',
  approved: 'text-success',
  rejected: 'text-error',
  superseded: 'text-text-muted',
};

/**
 * Issued quotes, newest first: number, date, total, status, note and downloads. Only the
 * status and the note of an issued quote change; at most one quote is approved.
 */
export function IssuedQuotes({
  issued,
  locale,
  readOnly,
  exportCsv,
  exportPdf,
}: {
  issued: IssuedQuote[];
  locale: Locale;
  readOnly: boolean;
  exportCsv: (q: IssuedQuote) => void;
  exportPdf: (q: IssuedQuote) => Promise<void>;
}) {
  const { t, i18n } = useTranslation();
  const { store } = useEditorContext();
  const toast = useToast();
  const [approving, setApproving] = useState<number | null>(null);
  const money = (cents: number) => formatMoney(cents, locale);
  const dateFormat = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium' });

  function changeStatus(number: number, status: QuoteStatus, options: StatusOptions = {}) {
    const result = store.getState().applyCommand('quote status', (d) => {
      try {
        d.quote = setQuoteStatus(d.quote, number, status, new Date(), options);
      } catch (e) {
        if (e instanceof QuoteStatusError) throw new CommandError(e.code);
        throw e;
      }
    });
    if (!result.ok && result.reason === 'already_approved') {
      const approved = issued.find((q) => q.status === 'approved');
      toast(t('quote.alreadyApproved', { number: approved?.number }), 'error');
    }
  }

  function pickStatus(q: IssuedQuote, status: QuoteStatus) {
    const othersPending = issued.some((o) => o.number !== q.number && o.status === 'issued');
    if (status === 'approved' && othersPending && !issued.some((o) => o.status === 'approved'))
      setApproving(q.number);
    else changeStatus(q.number, status);
  }

  return (
    <section aria-label={t('quote.issuedTitle')}>
      <h2 className="mb-2 text-label font-semibold tracking-wide text-text-muted uppercase">
        {t('quote.issuedTitle')}
      </h2>
      <Table<IssuedQuote>
        rowKey={(q) => String(q.number)}
        rows={[...issued].reverse()}
        empty={<EmptyState message={t('quote.noIssued')} />}
        columns={[
          {
            key: 'number',
            header: t('quote.numberColumn'),
            cell: (q) => (
              <span className="font-mono font-medium tabular-nums">
                {t('quote.number', { number: q.number })}
              </span>
            ),
          },
          {
            key: 'date',
            header: t('quote.dateColumn'),
            cell: (q) => (
              <span className="text-text-muted">{dateFormat.format(new Date(q.issuedAt))}</span>
            ),
          },
          {
            key: 'total',
            header: t('quote.totals.total'),
            align: 'right',
            cell: (q) => money(q.totals.total),
          },
          {
            key: 'status',
            header: t('quote.statusColumn'),
            cell: (q) => (
              <Select
                aria-label={t('quote.statusFor', { number: q.number })}
                className={cn('w-36', statusTone[q.status])}
                value={q.status}
                disabled={readOnly}
                onValueChange={(v) => pickStatus(q, v as QuoteStatus)}
                options={quoteStatusSchema.options.map((s) => ({
                  value: s,
                  label: t(`quote.status.${s}`),
                }))}
              />
            ),
          },
          {
            key: 'note',
            header: t('quote.noteColumn'),
            cell: (q) => (
              <NoteField
                number={q.number}
                note={q.note}
                disabled={readOnly}
                onCommit={(note) =>
                  store.getState().applyCommand('quote note', (d) => {
                    d.quote = setQuoteNote(d.quote, q.number, note);
                  })
                }
              />
            ),
          },
          {
            key: 'downloads',
            header: <span className="sr-only">{t('quote.downloadsColumn')}</span>,
            cell: (q) => (
              <span className="flex justify-end gap-1">
                <Button
                  variant="ghost"
                  aria-label={t('quote.exportCsvOf', { number: q.number })}
                  onClick={() => exportCsv(q)}
                >
                  <FileSpreadsheet size={14} />
                  {t('quote.exportCsv')}
                </Button>
                <Button
                  variant="ghost"
                  aria-label={t('quote.exportPdfOf', { number: q.number })}
                  onClick={() => void exportPdf(q)}
                >
                  <FileText size={14} />
                  {t('quote.exportPdf')}
                </Button>
              </span>
            ),
          },
        ]}
      />
      <Dialog
        open={approving !== null}
        onOpenChange={(open) => !open && setApproving(null)}
        title={t('quote.approveTitle', { number: approving ?? '' })}
        description={t('quote.approveBody')}
        footer={
          <>
            <Button
              onClick={() => {
                if (approving !== null) changeStatus(approving, 'approved');
                setApproving(null);
              }}
            >
              {t('quote.approveKeepPending')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (approving !== null)
                  changeStatus(approving, 'approved', { rejectPending: true });
                setApproving(null);
              }}
            >
              {t('quote.approveRejectOthers')}
            </Button>
          </>
        }
      />
    </section>
  );
}

/** The note of an issued quote: its own copy while typing, committed on blur. */
function NoteField({
  number,
  note,
  disabled,
  onCommit,
}: {
  number: number;
  note: string;
  disabled: boolean;
  onCommit: (note: string) => void;
}) {
  const { t } = useTranslation();
  const [text, setText] = useState(note);
  const [shown, setShown] = useState(note);
  if (note !== shown) {
    setShown(note);
    setText(note);
  }
  return (
    <input
      aria-label={t('quote.noteFor', { number })}
      placeholder={t('quote.notePlaceholder')}
      className={cn(fieldBox, 'w-full min-w-48 border-border outline-none')}
      value={text}
      disabled={disabled}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => {
        if (text.trim() !== note) onCommit(text.trim());
      }}
    />
  );
}
