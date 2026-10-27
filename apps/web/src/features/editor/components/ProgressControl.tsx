import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import type { ProjectDoc } from '@epd/domain/types';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { EditorUi } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { Menu } from '@/components/ui/Menu';
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
      ui: { drawerTab: 'circuits', drawerOpen: true },
    },
    { stage: 'bom', done: hasCable, view: 'plan', ui: { drawerTab: 'bom', drawerOpen: true } },
  ];
}

/** First-project guide in the status bar: the next stage, and a menu of all stages with their state. */
export function ProgressControl() {
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

  const current = next
    ? t('progress.nextStage', { stage: t(`progress.stages.${next}`) })
    : t('progress.complete');
  return (
    <Menu
      trigger={
        <Button
          variant="ghost"
          size="sm"
          icon={<ListChecks size={14} />}
          aria-label={`${t('progress.label')}: ${current}`}
          data-testid="progress-control"
          data-next={next ?? 'none'}
        >
          {current}
        </Button>
      }
      items={list.map((s) => ({
        key: s.stage,
        label: t(`progress.stages.${s.stage}`),
        hint: s.done ? t('progress.done') : s.stage === next ? t('progress.next') : '',
        onSelect: () => open(s),
      }))}
    />
  );
}
