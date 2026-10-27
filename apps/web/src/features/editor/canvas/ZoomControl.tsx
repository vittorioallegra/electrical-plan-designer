import { Minus, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { IconButton } from '@/components/ui/IconButton';
import { Toolbar } from '@/components/ui/Toolbar';
import { DEFAULT_VIEW, zoomAt } from './viewport';

const STEP = 1.25;

/** Floating zoom control: zoom out, current zoom (click to reset to 100%), zoom in. */
export function ZoomControl({ size }: { size: { width: number; height: number } }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const scale = useEditor((s) => s.ui.view.scale);
  const center = { x: size.width / 2, y: size.height / 2 };
  const zoom = (factor: number) => {
    const view = store.getState().ui.view;
    store.getState().setUi({ view: zoomAt(view, center, factor) });
  };
  const percent = Math.round((scale / DEFAULT_VIEW.scale) * 100);
  return (
    <Toolbar
      aria-label={t('editor.zoom.label')}
      floating
      className="absolute right-3 bottom-3 h-8 gap-0.5 px-1"
    >
      <IconButton
        label={t('editor.zoom.out')}
        icon={<Minus size={14} />}
        onClick={() => zoom(1 / STEP)}
      />
      <Button
        variant="ghost"
        size="sm"
        aria-label={t('editor.zoom.reset')}
        data-testid="zoom-level"
        className="min-w-12 font-mono tabular-nums"
        onClick={() => zoom(DEFAULT_VIEW.scale / store.getState().ui.view.scale)}
      >
        {percent}%
      </Button>
      <IconButton
        label={t('editor.zoom.in')}
        icon={<Plus size={14} />}
        onClick={() => zoom(STEP)}
      />
    </Toolbar>
  );
}
