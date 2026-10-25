import { BrickWall, MousePointer2, Ruler } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/state/EditorContext';
import type { Tool } from '@/state/editorStore';
import { cn } from '@/ui/cn';

const tools: { tool: Tool; icon: typeof MousePointer2; key: string; shortcut: string }[] = [
  { tool: 'select', icon: MousePointer2, key: 'tools.select', shortcut: 'V' },
  { tool: 'wall', icon: BrickWall, key: 'tools.wall', shortcut: 'W' },
  { tool: 'calibrate', icon: Ruler, key: 'tools.calibrate', shortcut: 'K' },
];

export function ToolPalette() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const active = useEditor((s) => s.ui.tool);
  const readOnly = useEditor((s) => s.readOnly);
  const hasBackground = useEditor(
    (s) => !!s.data.doc.floors.find((f) => f.id === s.ui.floorId)?.background,
  );
  return (
    <div role="toolbar" aria-label={t('editor.tools')} className="flex flex-col gap-0.5">
      {tools.map(({ tool, icon: Icon, key, shortcut }) => {
        const disabled =
          (readOnly && tool !== 'select') || (tool === 'calibrate' && !hasBackground);
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
            <Icon size={16} />
            {t(key)}
          </button>
        );
      })}
    </div>
  );
}

export const toolShortcuts: Record<string, Tool> = { v: 'select', w: 'wall', k: 'calibrate' };
