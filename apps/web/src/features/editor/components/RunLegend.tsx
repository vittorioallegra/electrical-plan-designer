import { ChevronDown, ChevronRight } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { RunElevation } from '@epd/domain/types';
import { runDash } from '@/features/editor/canvas/canvasColors';

const elevations: RunElevation[] = ['floor', 'ceiling', 'direct'];

/**
 * Small collapsible key of the three conduit run dash patterns, drawn in the same colour as the
 * runs on the canvas (the `canvas-run` token, so it follows the theme).
 */
export function RunLegend() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const bodyId = useId();
  return (
    <div
      className="absolute bottom-3 left-3 rounded-md border border-border bg-raised text-small shadow-pop"
      data-testid="run-legend"
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={bodyId}
        className="flex h-6 w-full items-center gap-1 rounded-md px-2 text-text-muted hover:text-text focus-visible:outline-2 focus-visible:outline-offset-1"
        onClick={() => setOpen((o) => !o)}
      >
        {open ? <ChevronDown size={12} aria-hidden /> : <ChevronRight size={12} aria-hidden />}
        {t('editor.legend.title')}
      </button>
      <ul id={bodyId} hidden={!open} className="flex flex-col gap-1 px-2 pt-0.5 pb-2">
        {elevations.map((el) => (
          <li key={el} className="flex items-center gap-2">
            <svg width="32" height="6" viewBox="0 0 32 6" aria-hidden>
              <line
                x1="0"
                y1="3"
                x2="32"
                y2="3"
                data-testid={`legend-dash-${el}`}
                stroke="var(--color-canvas-run)"
                strokeWidth="2"
                strokeDasharray={runDash[el].join(' ')}
              />
            </svg>
            {t(`runElevation.${el}`)}
          </li>
        ))}
      </ul>
    </div>
  );
}
