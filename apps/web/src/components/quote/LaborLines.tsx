import { Plus, Trash2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type { QuoteSettings } from '@epd/domain/types';
import { Button } from '@/components/ui/Button';
import { NumberInput } from '@/components/ui/NumberInput';

type LaborLine = QuoteSettings['laborLines'][number];

/** Lump-sum and hourly labor lines of the quote. */
export function LaborLines({
  lines,
  readOnly,
  edit,
}: {
  lines: LaborLine[];
  readOnly: boolean;
  edit: (label: string, fn: (s: QuoteSettings) => void) => unknown;
}) {
  const { t } = useTranslation();
  const update = (i: number, fn: (l: LaborLine) => void) =>
    edit('edit labor line', (s) => fn(s.laborLines[i]!));
  return (
    <section aria-label={t('quote.labor')} className="flex flex-col gap-2">
      <h2 className="font-medium">{t('quote.labor')}</h2>
      {lines.length === 0 ? <p className="text-text-muted">{t('quote.noLabor')}</p> : null}
      {lines.map((line, i) => (
        <div
          key={`${i}:${line.kind}:${line.description}`}
          className="flex flex-wrap items-center gap-2"
          data-testid="labor-line"
        >
          <input
            aria-label={t('quote.laborDescription')}
            className="h-[var(--control-height)] min-w-48 flex-1 rounded border border-border px-2"
            defaultValue={line.description}
            disabled={readOnly}
            onBlur={(e) => {
              const description = e.target.value.trim();
              if (description !== line.description)
                update(i, (l) => void (l.description = description));
            }}
          />
          {line.kind === 'lump' ? (
            <NumberInput
              aria-label={t('quote.amount')}
              className="w-32"
              value={line.amount}
              unit="€"
              min={0}
              disabled={readOnly}
              onValueChange={(v) => update(i, (l) => void (l.kind === 'lump' && (l.amount = v)))}
            />
          ) : (
            <>
              <NumberInput
                aria-label={t('quote.hours')}
                className="w-24"
                value={line.hours}
                unit="h"
                min={0}
                disabled={readOnly}
                onValueChange={(v) => update(i, (l) => void (l.kind === 'hourly' && (l.hours = v)))}
              />
              <NumberInput
                aria-label={t('quote.hourlyRate')}
                className="w-32"
                value={line.hourlyRate}
                unit="€/h"
                min={0}
                disabled={readOnly}
                onValueChange={(v) =>
                  update(i, (l) => void (l.kind === 'hourly' && (l.hourlyRate = v)))
                }
              />
            </>
          )}
          <Button
            variant="ghost"
            aria-label={t('quote.removeLabor')}
            disabled={readOnly}
            onClick={() => edit('remove labor line', (s) => void s.laborLines.splice(i, 1))}
          >
            <Trash2 size={14} />
          </Button>
        </div>
      ))}
      <div className="flex gap-2">
        <Button
          disabled={readOnly}
          onClick={() =>
            edit('add labor line', (s) =>
              s.laborLines.push({ kind: 'lump', description: t('quote.defaultLump'), amount: 0 }),
            )
          }
        >
          <Plus size={14} />
          {t('quote.addLump')}
        </Button>
        <Button
          disabled={readOnly}
          onClick={() =>
            edit('add labor line', (s) =>
              s.laborLines.push({
                kind: 'hourly',
                description: t('quote.defaultHourly'),
                hours: 0,
                hourlyRate: 0,
              }),
            )
          }
        >
          <Plus size={14} />
          {t('quote.addHourly')}
        </Button>
      </div>
    </section>
  );
}
