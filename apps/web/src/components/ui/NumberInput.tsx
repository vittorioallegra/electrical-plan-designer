import { useId, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/cn';
import { formatNumber, parseNumber, type Locale } from '@/lib/format';

export interface NumberInputProps extends Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'onChange' | 'type'
> {
  value: number | null;
  onValueChange: (value: number) => void;
  unit?: string;
  decimals?: number;
  min?: number;
  max?: number;
  /** Report every valid value while typing (dialog fields), not only on blur/Enter. */
  live?: boolean;
}

/**
 * Text input that accepts the locale decimal separator ("4,20") and commits a number on
 * blur or Enter. Invalid or out-of-range text is flagged and never committed.
 */
export function NumberInput({
  value,
  onValueChange,
  unit,
  decimals = 2,
  min,
  max,
  live = false,
  className,
  id,
  ...props
}: NumberInputProps) {
  const { i18n } = useTranslation();
  const locale: Locale = i18n.language === 'it' ? 'it' : 'en';
  const fallbackId = useId();
  const show = (v: number | null) => (v === null ? '' : formatNumber(v, locale, { decimals }));
  // Draft text while the user edits; null shows the formatted committed value.
  const [draft, setDraft] = useState<string | null>(null);
  const [invalid, setInvalid] = useState(false);

  const valid = (n: number | null): n is number =>
    n !== null && (min === undefined || n >= min) && (max === undefined || n <= max);

  function commit() {
    if (draft === null) return;
    const n = parseNumber(draft, locale);
    const ok = valid(n);
    setInvalid(!ok);
    if (!ok) return;
    setDraft(null);
    if (n !== value) onValueChange(n);
  }

  return (
    <span
      className={cn(
        'inline-flex h-[var(--control-height,2rem)] items-center rounded border bg-surface px-2',
        invalid ? 'border-error' : 'border-border',
        className,
      )}
    >
      <input
        {...props}
        id={id ?? fallbackId}
        type="text"
        inputMode="decimal"
        aria-invalid={invalid || undefined}
        className="w-full min-w-0 bg-transparent text-right tabular-nums outline-none"
        value={draft ?? show(value)}
        onFocus={() => setDraft((d) => d ?? show(value))}
        onChange={(e) => {
          setDraft(e.target.value);
          if (live) {
            const n = parseNumber(e.target.value, locale);
            if (valid(n) && n !== value) onValueChange(n);
          }
        }}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit();
        }}
      />
      {unit ? <span className="ml-1 text-text-muted">{unit}</span> : null}
    </span>
  );
}
