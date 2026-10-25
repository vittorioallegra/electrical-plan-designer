import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import type { Panel } from '@epd/domain/types';
import { usePanelKeyboard } from '@/features/panel/hooks/usePanelKeyboard';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import { DeviceInspector } from './DeviceInspector';
import { DevicePalette } from './DevicePalette';
import { LayoutInspector } from './LayoutInspector';
import { PanelFront } from './PanelFront';

export function PanelView() {
  const { t } = useTranslation();
  const panel = useEditor((s) => s.data.doc.panels[0]);
  if (!panel) {
    return (
      <div className="p-6">
        <h1 className="mb-2 text-xl font-semibold">{t('pages.panel')}</h1>
        <p className="mb-3 text-text-muted">{t('panel.noPanel')}</p>
        <Link to="../plan" className="text-accent underline">
          {t('panel.goToPlan')}
        </Link>
      </div>
    );
  }
  return <PanelDesigner panel={panel} />;
}

/** Palette, panel front and the inspector of the selected device (or of the layout). */
function PanelDesigner({ panel }: { panel: Panel }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const readOnly = useEditor((s) => s.readOnly);
  const selection = useEditor((s) => s.ui.selection);
  const selected = panel.devices.find((d) => selection.includes(d.id));
  usePanelKeyboard(store, selected, readOnly);

  return (
    <div className="flex h-full">
      <aside
        className="w-60 overflow-y-auto border-r border-border p-2"
        aria-label={t('panel.palette')}
      >
        <h1 className="sr-only">{t('pages.panel')}</h1>
        <DevicePalette readOnly={readOnly} />
      </aside>

      <div className="min-w-0 flex-1 overflow-auto p-4">
        <PanelFront panel={panel} selection={selection} readOnly={readOnly} />
      </div>

      <aside
        className="w-72 overflow-y-auto border-l border-border p-2"
        aria-label={t('editor.inspector')}
      >
        {selected ? (
          <DeviceInspector panel={panel} device={selected} />
        ) : (
          <LayoutInspector panel={panel} />
        )}
      </aside>
    </div>
  );
}
