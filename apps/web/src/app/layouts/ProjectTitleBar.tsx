import { Download, MoreHorizontal, Settings } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { useEditor } from '@/stores/editor/EditorContext';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { SegmentedLinks } from '@/components/ui/SegmentedControl';
import { TITLE_BAR_HEIGHT, modifierLabel, useTitleBarInset } from '@/lib/platform';
import { SaveStatus } from '@/features/editor/components/SaveStatus';

const views = [
  { to: 'plan', key: 'nav.plan' },
  { to: 'panel', key: 'nav.panel' },
  { to: 'quote', key: 'nav.quote' },
  { to: 'details', key: 'nav.project' },
] as const;

/** Room for the macOS traffic lights (px). */
const TRAFFIC_LIGHTS_INSET = 84;

export interface ProjectTitleBarProps {
  exporting: boolean;
  onExportPdf: () => void;
  onExportJson: () => void;
  onImportJson: () => void;
  onUpdateFromCatalog: () => void;
  onCloseProject: () => void;
}

/**
 * Title bar of the project pages: name, save state, the views as links, Settings, Export and the
 * project menu. On macOS it is the window's title bar (the page is a drag region, every control
 * opts out of it); elsewhere it is an ordinary bar under the native frame.
 */
export function ProjectTitleBar(props: ProjectTitleBarProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const name = useEditor((s) => s.data.meta.name);
  const readOnly = useEditor((s) => s.readOnly);
  const inset = useTitleBarInset();
  const mod = modifierLabel();
  return (
    <header
      className="app-drag flex shrink-0 items-center gap-3 border-b border-border bg-chrome pr-3"
      style={{ height: TITLE_BAR_HEIGHT, paddingLeft: inset ? TRAFFIC_LIGHTS_INSET : 12 }}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="truncate font-semibold" data-testid="project-name">
          {name}
        </span>
        <SaveStatus />
      </div>
      <SegmentedLinks
        aria-label={t('editor.views')}
        className="app-no-drag"
        links={views.map((v) => ({ to: v.to, label: t(v.key) }))}
      />
      <div className="app-no-drag flex flex-1 items-center justify-end gap-0.5">
        <IconButton
          label={t('library.open')}
          shortcut={`${mod},`}
          icon={<Settings size={16} />}
          onClick={() => void navigate('/settings/general')}
        />
        <Menu
          trigger={<IconButton label={t('editor.export')} icon={<Download size={16} />} />}
          items={[
            {
              key: 'pdf',
              label: t('editor.exportPdf'),
              disabled: props.exporting,
              onSelect: props.onExportPdf,
            },
            { key: 'json', label: t('editor.exportJson'), onSelect: props.onExportJson },
            {
              key: 'import',
              label: t('editor.importJson'),
              disabled: readOnly,
              onSelect: props.onImportJson,
            },
          ]}
        />
        <Menu
          trigger={
            <IconButton label={t('editor.projectMenu')} icon={<MoreHorizontal size={16} />} />
          }
          items={[
            {
              key: 'update',
              label: t('library.update.open'),
              disabled: readOnly,
              onSelect: props.onUpdateFromCatalog,
            },
            {
              key: 'close',
              label: t('menu.close'),
              separatorBefore: true,
              onSelect: props.onCloseProject,
            },
          ]}
        />
      </div>
    </header>
  );
}
