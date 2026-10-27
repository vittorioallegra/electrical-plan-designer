import { BrickWall, MousePointer2, Ruler, Spline } from 'lucide-react';
import { Fragment, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { Tool } from '@/stores/editor/editorStore';
import { IconButton } from '@/components/ui/IconButton';
import { Select } from '@/components/ui/Select';
import { ElectricalSymbol } from '@/components/symbols/ElectricalSymbol';
import { useLibrary } from '@/stores/library/useLibrary';

interface ToolDef {
  tool: Tool;
  icon: ReactNode;
  key: string;
  shortcut: string;
}

const select: ToolDef = {
  tool: 'select',
  icon: <MousePointer2 size={16} />,
  key: 'tools.select',
  shortcut: 'V',
};
const draw: ToolDef[] = [
  { tool: 'wall', icon: <BrickWall size={16} />, key: 'tools.wall', shortcut: 'W' },
  { tool: 'calibrate', icon: <Ruler size={16} />, key: 'tools.calibrate', shortcut: 'K' },
];
const place: ToolDef[] = [
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
];
const lay: ToolDef[] = [
  { tool: 'conduit', icon: <Spline size={16} />, key: 'tools.conduit', shortcut: 'C' },
];

/** Groups in rail order; a hairline separates them. */
const groups: ToolDef[][] = [[select], draw, place, lay];

export const toolShortcuts: Record<string, Tool> = Object.fromEntries(
  groups.flat().map((t) => [t.shortcut.toLowerCase(), t.tool]),
);

/** Vertical tool rail: 32px tool buttons in groups, each with a tooltip showing its shortcut. */
export function ToolRail() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const active = useEditor((s) => s.ui.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const hasBackground = useEditor(
    (s) => !!s.data.doc.floors.find((f) => f.id === s.ui.floorId)?.background,
  );
  const hasPanel = useEditor((s) => s.data.doc.panels.length > 0);
  return (
    <div
      role="toolbar"
      aria-label={t('editor.tools')}
      aria-orientation="vertical"
      className="flex w-11 shrink-0 flex-col items-center gap-0.5 border-r border-border bg-panel py-2"
    >
      {groups.map((group, i) => (
        <Fragment key={group[0]!.tool}>
          {i > 0 ? <div role="separator" className="my-1 h-px w-5 bg-border" /> : null}
          {group.map(({ tool, icon, key, shortcut }) => {
            const disabled =
              (readOnly && tool !== 'select') ||
              (tool === 'calibrate' && !hasBackground) ||
              (tool === 'panel' && hasPanel);
            return (
              <IconButton
                key={tool}
                label={t(key)}
                shortcut={shortcut}
                tooltipSide="right"
                icon={icon}
                pressed={active === tool}
                disabled={disabled}
                data-testid={`tool-${tool}`}
                size="lg"
                onClick={() => store.getState().setUi({ tool, selection: [] })}
              />
            );
          })}
        </Fragment>
      ))}
    </div>
  );
}

/** "Place with" choice of box preset, shown while the terminal box tool is active. */
export function PresetPicker() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const active = useEditor((s) => s.ui.tool);
  const presetId = useEditor((s) => s.ui.presetId);
  const presets = useLibrary((s) => s.library.boxPresets);
  if (active !== 'terminal_box' || presets.length === 0) return null;
  return (
    <div className="flex w-48 flex-col gap-1 rounded-md border border-border bg-raised p-2 shadow-pop">
      <span className="text-small text-text-muted">{t('contents.placeWith')}</span>
      <Select
        aria-label={t('contents.placeWith')}
        value={presetId ?? ''}
        onValueChange={(v) => store.getState().setUi({ presetId: v || null })}
        options={[
          { value: '', label: t('contents.plainBox') },
          ...presets.map((p) => ({ value: p.id, label: p.name })),
        ]}
      />
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
