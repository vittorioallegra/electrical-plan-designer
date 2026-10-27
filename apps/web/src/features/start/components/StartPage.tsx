import { useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Ellipsis,
  FileText,
  FolderOpen,
  Plus,
  Settings as SettingsIcon,
  TriangleAlert,
  X,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { newProjectFile } from '@epd/domain/projectFile';
import { queryKeys } from '@/api/keys';
import { APP_VERSION } from '@/config/version';
import { cn } from '@/lib/cn';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { useProjectOpener } from '@/features/start/hooks/useProjectOpener';
import { AppMark } from '@/components/AppMark';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { EmptyState } from '@/components/ui/EmptyState';
import { IconButton } from '@/components/ui/IconButton';
import { Menu } from '@/components/ui/Menu';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';
import { modifierLabel } from '@/lib/platform';

/**
 * `/`: start a project. New (from the library defaults), open a file, restore the recovery copy a
 * crash left (or discard it). Anything that would replace a project with changes not saved to a
 * file asks first.
 */
export function StartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { recovery, recent, workspace } = useEditorServices();
  const defaults = useLibrary((s) => s.library.defaults);
  const queryClient = useQueryClient();
  const opener = useProjectOpener();
  const { current, recovered, guard, refreshRecovery, openProject } = opener;
  const recentFiles = useQuery({
    queryKey: queryKeys.recent(),
    queryFn: () => recent.list(),
    staleTime: 0,
  });
  const [creating, setCreating] = useState(false);
  const [discarding, setDiscarding] = useState<string | null>(null);

  const dateFormat = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  // File > New in the native menu comes here: the same question, then the new-project form.
  const requestedNew = (location.state as { command?: string } | null)?.command === 'new';
  useEffect(() => {
    if (!requestedNew) return;
    guard(() => setCreating(true));
    // Forget the request, so a reload or a back navigation does not open the form again.
    void navigate('.', { replace: true, state: null });
    // Only a new navigation (its key) is a request.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  /** Opens the recovery copy bound to its original path, still unsaved. */
  async function restore() {
    // Read again: autosave may have written since the screen loaded.
    const copy = await recovery.get().catch(() => null);
    if (!copy) {
      toast(t('start.recovery.invalid'), 'error');
      return;
    }
    workspace.getState().open({
      data: copy.project,
      assets: copy.assets,
      status: copy.savedToFile ? 'saved' : 'draft',
      ...(copy.file ? { file: copy.file } : {}),
    });
    refreshRecovery();
    navigate('/project/plan');
  }

  async function discardRecovery() {
    try {
      await recovery.clear();
    } catch {
      toast(t('start.failed'), 'error');
    }
    refreshRecovery();
  }

  async function forget(path: string) {
    await recent.remove(path);
    void queryClient.invalidateQueries({ queryKey: queryKeys.recent() });
  }

  function create(values: { name: string; clientName: string; address: string }) {
    const input = { ...values, firstFloorName: t('start.firstFloorName') };
    setCreating(false);
    openProject({
      data: newProjectFile(input, defaults, new Date()),
      assets: new Map(),
      status: 'unsaved',
    });
  }

  // While a project is open the copy is that project's own.
  const shown = !current && recovered.data ? recovered.data : null;

  const mod = modifierLabel();
  const recentList = recentFiles.data ?? [];

  return (
    <div className="flex min-h-full">
      <aside className="flex w-64 shrink-0 flex-col gap-1.5 border-r border-border bg-panel p-4">
        <div className="mx-1 mb-4 flex items-center gap-2.5">
          <AppMark />
          <div className="min-w-0">
            <p className="font-semibold">{t('app.name')}</p>
            <p className="text-small text-text-faint">
              {t('start.version', { version: APP_VERSION })}
            </p>
          </div>
        </div>
        <Button
          variant="primary"
          size="lg"
          className="w-full justify-start"
          icon={<Plus size={16} />}
          onClick={() => guard(() => setCreating(true))}
        >
          {t('start.new')}
          <Shortcut className="opacity-70">{`${mod}N`}</Shortcut>
        </Button>
        <Button
          variant="ghost"
          size="lg"
          className="w-full justify-start"
          icon={<FolderOpen size={16} />}
          onClick={() => opener.openFile()}
        >
          {t('start.open')}
          <Shortcut className="text-text-faint">{`${mod}O`}</Shortcut>
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="lg"
          className="w-full justify-start"
          icon={<SettingsIcon size={16} />}
          onClick={() => navigate('/settings')}
        >
          {t('library.open')}
          <Shortcut className="text-text-faint">{`${mod},`}</Shortcut>
        </Button>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col gap-5 overflow-auto p-10">
        <h1 className="sr-only">{t('start.title')}</h1>

        {shown ? (
          <section
            className="flex items-center gap-3 rounded-md bg-warning-subtle p-3"
            aria-label={t('start.recovery.title')}
          >
            <TriangleAlert size={16} aria-hidden className="shrink-0 text-warning" />
            <div className="min-w-0 flex-1">
              <p className="text-text-muted">{t('start.recovery.title')}</p>
              <p className="truncate font-medium">{shown.project.meta.name}</p>
              <p className="text-text-muted">
                {t('start.recovery.lastChange', {
                  date: dateFormat.format(new Date(shown.savedAt)),
                })}
                {shown.file
                  ? ` · ${t('start.recovery.file', { name: shown.file.name })}`
                  : ` · ${t('start.recovery.noFile')}`}
                {shown.savedToFile ? null : ` · ${t('start.recovery.notInFile')}`}
              </p>
            </div>
            <Button variant="ghost" onClick={() => setDiscarding(shown.project.meta.name)}>
              {t('start.recovery.discard')}
            </Button>
            <Button onClick={() => void restore()}>{t('start.recovery.restore')}</Button>
          </section>
        ) : null}

        {current ? (
          <section
            className="flex items-center gap-3 rounded-md border border-border bg-panel p-3"
            aria-label={t('start.continue.title')}
          >
            <div className="min-w-0 flex-1">
              <p className="text-text-muted">{t('start.continue.title')}</p>
              <p className="truncate font-medium">
                {current.store.getState().data.meta.name}
                {current.store.getState().readOnly ? ` · ${t('start.continue.readOnly')}` : ''}
              </p>
            </div>
            <Button variant="primary" onClick={() => navigate('/project/plan')}>
              {t('start.continue.action')}
            </Button>
          </section>
        ) : null}

        {recentList.length > 0 ? (
          <section aria-label={t('start.recent.title')} className="flex flex-col gap-2">
            <h2 className="text-heading font-semibold">{t('start.recent.title')}</h2>
            <ul className="flex flex-col">
              {recentList.map((file) => (
                <li
                  key={file.path}
                  className="flex h-13 items-center gap-3 rounded-md px-3 hover:bg-hover"
                >
                  <span
                    aria-hidden
                    className="flex size-7 shrink-0 items-center justify-center rounded-sm border border-border bg-chrome text-text-muted"
                  >
                    <FileText size={14} />
                  </span>
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => opener.openPath(file.path)}
                  >
                    <span
                      className={cn(
                        'block truncate font-medium',
                        file.missing && 'text-text-muted',
                      )}
                    >
                      {file.name}
                    </span>
                    <span className="block truncate text-small text-text-faint">
                      {folderOf(file.path)}
                    </span>
                  </button>
                  {file.missing ? (
                    <Badge tone="warning">{t('start.recent.missing')}</Badge>
                  ) : file.modifiedAt !== undefined ? (
                    <span className="shrink-0 text-small text-text-muted tnum">
                      {dateFormat.format(new Date(file.modifiedAt))}
                    </span>
                  ) : null}
                  {file.missing ? (
                    <IconButton
                      label={`${t('start.recent.remove')}: ${file.name}`}
                      icon={<X size={16} />}
                      onClick={() => void forget(file.path)}
                    />
                  ) : (
                    <Menu
                      trigger={
                        <IconButton
                          label={t('start.recent.more', { name: file.name })}
                          icon={<Ellipsis size={16} />}
                        />
                      }
                      items={[
                        {
                          key: 'open',
                          label: t('start.recent.open'),
                          onSelect: () => opener.openPath(file.path),
                        },
                        {
                          key: 'remove',
                          label: t('start.recent.remove'),
                          onSelect: () => void forget(file.path),
                        },
                      ]}
                    />
                  )}
                </li>
              ))}
            </ul>
          </section>
        ) : recentFiles.data ? (
          <EmptyState message={t('start.recent.empty')} />
        ) : null}
      </main>

      {creating ? (
        <NewProjectDialog
          title={t('start.newTitle')}
          onClose={() => setCreating(false)}
          onSubmit={create}
        />
      ) : null}

      {opener.dialog}

      <Dialog
        open={discarding !== null}
        onOpenChange={(open) => !open && setDiscarding(null)}
        title={t('start.recovery.discardTitle')}
        description={t('start.recovery.discardBody', { name: discarding ?? '' })}
        footer={
          <>
            <Button variant="ghost" onClick={() => setDiscarding(null)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="danger-ghost"
              onClick={() => {
                setDiscarding(null);
                void discardRecovery();
              }}
            >
              {t('start.recovery.discard')}
            </Button>
          </>
        }
      />
    </div>
  );
}

/** The folder part of a path (empty when it has none). */
function folderOf(path: string): string {
  const cut = Math.max(path.lastIndexOf('/'), path.lastIndexOf('\\'));
  return cut > 0 ? path.slice(0, cut) : '';
}

function Shortcut({ className, children }: { className?: string; children: string }) {
  return (
    <span aria-hidden className={cn('ml-auto pl-3 text-small font-normal', className)}>
      {children}
    </span>
  );
}

function NewProjectDialog({
  title,
  onClose,
  onSubmit,
}: {
  title: string;
  onClose: () => void;
  onSubmit: (values: { name: string; clientName: string; address: string }) => void;
}) {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [clientName, setClientName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()} title={title}>
      <form
        className="flex flex-col gap-3"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit({ name: name.trim(), clientName: clientName.trim(), address: address.trim() });
        }}
      >
        <TextField
          label={t('start.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          autoFocus
        />
        <TextField
          label={t('start.client')}
          value={clientName}
          onChange={(e) => setClientName(e.target.value)}
        />
        <TextField
          label={t('start.address')}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            {t('common.cancel')}
          </Button>
          <Button type="submit" variant="primary">
            {t('start.create')}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
