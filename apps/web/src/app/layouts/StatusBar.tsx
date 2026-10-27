import { useTranslation } from 'react-i18next';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { DrawerTab } from '@/stores/editor/editorStore';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { useVisibleWarnings } from '@/features/checks/components/WarningsTab';
import { ProgressControl } from '@/features/editor/components/ProgressControl';

const panelTabs = [
  { tab: 'circuits', key: 'editor.tabs.circuits' },
  { tab: 'bom', key: 'editor.tabs.bom' },
  { tab: 'warnings', key: 'editor.tabs.warnings' },
] as const satisfies readonly { tab: DrawerTab; key: string }[];

/** Bottom bar: the buttons that open the bottom panel on a tab, and the progress control. */
export function StatusBar() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const open = useEditor((s) => s.ui.drawerOpen);
  const current = useEditor((s) => s.ui.drawerTab);
  const { visible } = useVisibleWarnings();

  function toggle(tab: DrawerTab) {
    const { setUi, ui } = store.getState();
    // The open tab's button closes the panel; any other opens it on that tab.
    if (ui.drawerOpen && ui.drawerTab === tab) setUi({ drawerOpen: false });
    else setUi({ drawerTab: tab, drawerOpen: true });
  }

  return (
    <div
      role="toolbar"
      aria-label={t('editor.statusBar')}
      className="flex h-7 shrink-0 items-center gap-1 border-t border-border bg-chrome px-2 text-small"
    >
      {panelTabs.map(({ tab, key }) => {
        const active = open && current === tab;
        return (
          <Button
            key={tab}
            variant="ghost"
            size="sm"
            pressed={active}
            onClick={() => toggle(tab)}
            className="gap-1.5"
          >
            {t(key)}
            {tab === 'warnings' ? (
              <Badge tone={visible.length > 0 ? 'warning' : 'neutral'} className="h-4 tabular-nums">
                <span data-testid="status-warnings-count">{visible.length}</span>
              </Badge>
            ) : null}
          </Button>
        );
      })}
      <span className="flex-1" />
      <ProgressControl />
    </div>
  );
}
