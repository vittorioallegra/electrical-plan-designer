import { ChevronDown } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Group, Panel, Separator, usePanelRef } from 'react-resizable-panels';
import { useEffect } from 'react';
import { useEditor, useEditorContext } from '@/stores/editor/EditorContext';
import type { DrawerTab } from '@/stores/editor/editorStore';
import { IconButton } from '@/components/ui/IconButton';
import { Tabs } from '@/components/ui/Tabs';
import { cn } from '@/lib/cn';
import { BomTab } from '@/features/bom/components/BomTab';
import { WarningsBadge, WarningsTab } from '@/features/checks/components/WarningsTab';
import { CircuitsTab } from '@/features/circuits/components/CircuitsTab';

/**
 * The editor area with the bottom panel under it (Circuits, BOM, Warnings). The panel is closed
 * by default; whether it is open and how tall lives in the editor store's `ui`, so the status bar
 * can open it. A drag below the minimum collapses it.
 */
export function ProjectBody({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const open = useEditor((s) => s.ui.drawerOpen);
  const panel = usePanelRef();
  // Read once: later size changes come from the panel itself.
  const [initial] = useState(() => store.getState().ui);

  useEffect(() => {
    const handle = panel.current;
    if (!handle) return;
    if (open) {
      if (handle.isCollapsed()) handle.resize(`${store.getState().ui.drawerSize}%`);
    } else if (!handle.isCollapsed()) handle.collapse();
  }, [open, panel, store]);

  return (
    <Group orientation="vertical" className="panel-slide min-h-0 flex-1">
      <Panel id="editor" minSize="30%">
        {children}
      </Panel>
      <Separator
        data-testid="drawer-separator"
        disabled={!open}
        className={cn(
          'bg-border transition-colors data-[separator=active]:bg-accent data-[separator=hover]:bg-accent',
          open ? 'h-1' : 'h-0',
        )}
      />
      <Panel
        id="drawer"
        panelRef={panel}
        collapsible
        collapsedSize="0%"
        minSize="12%"
        maxSize="70%"
        defaultSize={initial.drawerOpen ? `${initial.drawerSize}%` : '0%'}
        onResize={(size) => {
          // The separator is disabled while closed, so a size while the store says closed is the
          // panel collapsing (or about to expand); only a drag changes an open panel by itself.
          const { ui, setUi } = store.getState();
          if (!ui.drawerOpen) return;
          if (size.asPercentage > 0.5) {
            const pct = Math.round(size.asPercentage);
            if (ui.drawerSize !== pct) setUi({ drawerSize: pct });
          } else if (panel.current?.isCollapsed()) {
            setUi({ drawerOpen: false });
          }
        }}
      >
        <section
          aria-label={t('editor.drawer')}
          aria-hidden={!open}
          inert={!open}
          className="relative h-full overflow-y-auto bg-panel px-3"
        >
          <DrawerTabs />
          <div className="absolute top-1 right-2 z-20">
            <IconButton
              label={t('editor.closePanel')}
              icon={<ChevronDown size={16} />}
              onClick={() => store.getState().setUi({ drawerOpen: false })}
            />
          </div>
        </section>
      </Panel>
    </Group>
  );
}

function DrawerTabs() {
  const { t } = useTranslation();
  const { store } = useEditorContext();
  const tab = useEditor((s) => s.ui.drawerTab);
  return (
    <Tabs
      value={tab}
      onValueChange={(value) => store.getState().setUi({ drawerTab: value as DrawerTab })}
      tabs={[
        { value: 'circuits', label: t('editor.tabs.circuits'), content: <CircuitsTab /> },
        { value: 'bom', label: t('editor.tabs.bom'), content: <BomTab /> },
        {
          value: 'warnings',
          label: (
            <>
              {t('editor.tabs.warnings')}
              <WarningsBadge />
            </>
          ),
          content: <WarningsTab />,
        },
      ]}
    />
  );
}
