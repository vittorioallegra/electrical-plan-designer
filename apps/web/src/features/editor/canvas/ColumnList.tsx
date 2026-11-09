import { TriangleAlert } from 'lucide-react';
import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { PlanNode, Point } from '@epd/domain/types';
import { ElectricalSymbol } from '@/components/symbols/ElectricalSymbol';
import { ListRow } from '@/components/ui/ListRow';
import { formatLength } from '@/lib/format';
import { symbolOf } from './planScene';

/** Matches `w-64`. */
const LIST_WIDTH_PX = 256;
/** Distance from the column's point, clear of its plates and badge. */
const LIST_GAP_PX = 40;

export interface ColumnListProps {
  /** Boxes of the column, top to bottom. */
  members: readonly PlanNode[];
  heightM: (nodeId: string) => number;
  /** Screen point of the column; the list opens beside it. */
  anchor: Point;
  /** Width of the plan: the list opens on the column's left when its right has no room. */
  boundsWidth: number;
  selected: ReadonlySet<string>;
  /** Boxes that cannot be picked (e.g. the start of the conduit being drawn). */
  disabled?: ReadonlySet<string> | undefined;
  warned: ReadonlySet<string>;
  onPick: (nodeId: string) => void;
  onHover: (nodeId: string | null) => void;
  onClose: () => void;
}

/**
 * An exploded box column: its boxes top to bottom (symbol, label, height), next to the column on
 * the plan. A row picks that box; arrows move between rows, Escape closes.
 */
export function ColumnList({
  members,
  heightM,
  anchor,
  boundsWidth,
  selected,
  disabled,
  warned,
  onPick,
  onHover,
  onClose,
}: ColumnListProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === 'it' ? 'it' : 'en';
  const list = useRef<HTMLDivElement>(null);

  // Focus the selected row (or the first) when the list opens, for the keyboard.
  useEffect(() => {
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])];
    (rows.find((r) => r.getAttribute('aria-pressed') === 'true') ?? rows[0])?.focus();
  }, []);

  function onKeyDown(e: KeyboardEvent<HTMLDivElement>) {
    const rows = [...(list.current?.querySelectorAll<HTMLButtonElement>('button:enabled') ?? [])];
    const index = rows.indexOf(document.activeElement as HTMLButtonElement);
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault();
      const next = (index + (e.key === 'ArrowDown' ? 1 : -1) + rows.length) % rows.length;
      rows[next]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      onClose();
    }
  }

  return (
    <div
      ref={list}
      role="group"
      aria-label={t('editor.column.list', { count: members.length })}
      data-testid="column-list"
      className="absolute z-10 w-64 rounded-md border border-border-strong bg-raised p-1 shadow-pop"
      style={{
        left:
          anchor.x + LIST_GAP_PX + LIST_WIDTH_PX <= boundsWidth
            ? anchor.x + LIST_GAP_PX
            : Math.max(0, anchor.x - LIST_GAP_PX - LIST_WIDTH_PX),
        top: Math.max(0, anchor.y - 28),
      }}
      onKeyDown={onKeyDown}
      onMouseLeave={() => onHover(null)}
    >
      <div className="px-2 pt-1 pb-1.5 text-small text-text-muted">
        {t('editor.column.list', { count: members.length })}
      </div>
      {members.map((m) => (
        <ListRow
          key={m.id}
          icon={<ElectricalSymbol kind={symbolOf(m)} size={16} />}
          label={m.label}
          meta={
            <span className="inline-flex items-center gap-1.5">
              {formatLength(heightM(m.id), locale)}
              {warned.has(m.id) ? (
                <TriangleAlert
                  size={14}
                  className="text-warning"
                  aria-label={t('editor.column.warning')}
                />
              ) : null}
            </span>
          }
          selected={selected.has(m.id)}
          aria-pressed={selected.has(m.id)}
          disabled={disabled?.has(m.id)}
          onClick={() => onPick(m.id)}
          onMouseEnter={() => onHover(m.id)}
          onFocus={() => onHover(m.id)}
        />
      ))}
    </div>
  );
}
