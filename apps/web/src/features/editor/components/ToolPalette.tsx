import { BrickWall, MousePointer2, Ruler, Spline } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { Tool } from '@/stores/editor/editorStore';
import { cn } from '@/lib/cn';
import { ElectricalSymbol } from '@/components/symbols/ElectricalSymbol';
import { useCatalog } from '@/features/catalog/hooks/useCatalog';

const tools: { tool: Tool; icon: ReactNode; key: string; shortcut: string }[] = [
  { tool: 'select', icon: <MousePointer2 size={16} />, key: 'tools.select', shortcut: 'V' },
  {
    tool: 'panel',
    icon: <ElectricalSymbol kind="panel" size={16} />,
    key: 'tools.panel',
    shortcut: 'P',
  },
  {
    tool: 'junction_box',
    icon: <ElectricalSymbol kind="junction_box" size={16} />,
    key: 'tools.junctionBox',
    shortcut: 'J',
  },
  {
    tool: 'terminal_box',
    icon: <ElectricalSymbol kind="socket" size={16} />,
    key: 'tools.terminalBox',
    shortcut: 'B',
  },
  {
    tool: 'riser_point',
    icon: <ElectricalSymbol kind="riser" size={16} />,
    key: 'tools.riser',
    shortcut: 'R',
  },
  { tool: 'conduit', icon: <Spline size={16} />, key: 'tools.conduit', shortcut: 'C' },
  { tool: 'wall', icon: <BrickWall size={16} />, key: 'tools.wall', shortcut: 'W' },
  { tool: 'calibrate', icon: <Ruler size={16} />, key: 'tools.calibrate', shortcut: 'K' },
];

export const toolShortcuts: Record<string, Tool> = Object.fromEntries(
  tools.map((t) => [t.shortcut.toLowerCase(), t.tool]),
);

export function ToolPalette() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const active = useEditor((s) => s.ui.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const hasBackground = useEditor(
    (s) => !!s.data.doc.floors.find((f) => f.id === s.ui.floorId)?.background,
  );
  const hasPanel = useEditor((s) => s.data.doc.panels.length > 0);
  const presetId = useEditor((s) => s.ui.presetId);
  const { profile } = useCatalog();
  const presets = profile?.boxPresets ?? [];
  return (
    <div role="toolbar" aria-label={t('editor.tools')} className="flex flex-col gap-0.5">
      {active === 'terminal_box' && presets.length > 0 ? (
        <label className="order-last mt-2 flex flex-col gap-1">
          {t('contents.placeWith')}
          <select
            className="h-[var(--control-height)] rounded border border-border px-1"
            value={presetId ?? ''}
            onChange={(e) => store.getState().setUi({ presetId: e.target.value || null })}
          >
            <option value="">{t('contents.plainBox')}</option>
            {presets.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {tools.map(({ tool, icon, key, shortcut }) => {
        const disabled =
          (readOnly && tool !== 'select') ||
          (tool === 'calibrate' && !hasBackground) ||
          (tool === 'panel' && hasPanel);
        return (
          <button
            key={tool}
            aria-pressed={active === tool}
            disabled={disabled}
            title={`${t(key)} (${shortcut})`}
            data-testid={`tool-${tool}`}
            className={cn(
              'flex items-center gap-2 rounded px-2 py-1 text-left disabled:opacity-40',
              active === tool ? 'bg-accent text-accent-contrast' : 'hover:bg-surface-muted',
            )}
            onClick={() => store.getState().setUi({ tool, selection: [] })}
          >
            {icon}
            <span className="flex-1">{t(key)}</span>
            <kbd className="text-xs opacity-60">{shortcut}</kbd>
          </button>
        );
      })}
    </div>
  );
}

/** Hint shown over the canvas for the active tool. */
export function toolHintKey(tool: Tool): string | null {
  switch (tool) {
    case 'calibrate':
      return 'background.calibrateClick';
    case 'conduit':
      return 'tools.hints.conduit';
    case 'wall':
      return 'tools.hints.wall';
    case 'panel':
    case 'junction_box':
    case 'terminal_box':
    case 'riser_point':
      return 'tools.hints.place';
    case 'select':
      return null;
  }
}
