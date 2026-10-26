import { Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import type { ProjectDoc } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { EditorUi } from '@/stores/editor/editorStore';
import { cn } from '@/lib/cn';
import { useAnalysis } from '@/hooks/useAnalysis';

type Stage = 'plan' | 'panel' | 'conduits' | 'boxes' | 'circuits' | 'bom';

interface StageDef {
  stage: Stage;
  done: boolean;
  /** View to open and UI state to apply when the stage is clicked. */
  view: 'plan' | 'panel';
  ui: Partial<EditorUi>;
}

function stages(doc: ProjectDoc, hasCable: boolean): StageDef[] {
  const panel = doc.panels[0];
  return [
    {
      stage: 'plan',
      // Drawing straight onto an empty floor (no walls or background) also counts as a plan.
      done: doc.nodes.length > 0 || doc.floors.some((f) => f.background || f.walls.length > 0),
      view: 'plan',
      ui: { tool: 'wall' },
    },
    {
      stage: 'panel',
      done: (panel?.devices.length ?? 0) > 0,
      view: panel ? 'panel' : 'plan',
      ui: panel ? {} : { tool: 'panel' },
    },
    {
      stage: 'conduits',
      done: doc.segments.length > 0,
      view: 'plan',
      ui: { tool: 'conduit' },
    },
    {
      stage: 'boxes',
      done: doc.nodes.some((n) => n.kind === 'terminal_box'),
      view: 'plan',
      ui: { tool: 'terminal_box' },
    },
    {
      stage: 'circuits',
      done: doc.circuits.some((c) => c.targetNodeIds.length > 0),
      view: 'plan',
      ui: { drawerTab: 'circuits' },
    },
    { stage: 'bom', done: hasCable, view: 'plan', ui: { drawerTab: 'bom' } },
  ];
}

/** First-project guide: each stage shows done / next and opens its tool. */
export function ProgressStrip() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const doc = useEditor((s) => s.data.doc);
  const readOnly = useEditor((s) => s.readOnly);
  const { bom } = useAnalysis();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const list = stages(
    doc,
    bom.some((l) => l.category === 'cable'),
  );
  const next = list.find((s) => !s.done)?.stage;

  function open(s: StageDef) {
    store.getState().setUi({ ...(readOnly ? {} : s.ui), pick: null });
    const target = `/project/${s.view}`;
    if (pathname !== target) void navigate(target);
  }

  return (
    <nav
      className="flex flex-wrap items-center gap-1 border-b border-border px-3 py-1 text-sm"
      aria-label={t('progress.label')}
    >
      {list.map((s, i) => (
        <span key={s.stage} className="flex items-center gap-1">
          {i > 0 ? <span className="text-text-muted">→</span> : null}
          <button
            className={cn(
              'flex items-center gap-1 rounded px-2 py-0.5',
              s.done && 'text-success',
              s.stage === next && 'bg-accent text-accent-contrast',
              !s.done && s.stage !== next && 'text-text-muted',
            )}
            data-state={s.done ? 'done' : s.stage === next ? 'next' : 'todo'}
            aria-current={s.stage === next ? 'step' : undefined}
            onClick={() => open(s)}
          >
            {s.done ? <Check size={14} aria-label={t('progress.done')} /> : null}
            {t(`progress.stages.${s.stage}`)}
            {s.stage === next ? <span className="sr-only">({t('progress.next')})</span> : null}
          </button>
        </span>
      ))}
    </nav>
  );
}
