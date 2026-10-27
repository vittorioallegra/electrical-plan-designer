import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation, useNavigate } from 'react-router';
import { newProjectFile } from '@epd/domain/projectFile';
import { queryKeys } from '@/api/keys';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { useLibrary } from '@/stores/library/useLibrary';
import { useProjectOpener } from '@/features/start/hooks/useProjectOpener';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

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

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <h1 className="text-xl font-semibold">{t('start.title')}</h1>

      {current ? (
        <section
          className="flex items-center gap-3 rounded border border-border p-3"
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

      {shown ? (
        <section
          className="flex items-center gap-3 rounded border border-border p-3"
          aria-label={t('start.recovery.title')}
        >
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
          <Button onClick={() => setDiscarding(shown.project.meta.name)}>
            {t('start.recovery.discard')}
          </Button>
          <Button variant="primary" onClick={() => void restore()}>
            {t('start.recovery.restore')}
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => guard(() => setCreating(true))}>
          {t('start.new')}
        </Button>
        <Button onClick={() => opener.openFile()}>{t('start.open')}</Button>
        <Button onClick={() => navigate('/library/company')}>{t('library.open')}</Button>
      </div>

      {recentFiles.data && recentFiles.data.length > 0 ? (
        <section aria-label={t('start.recent.title')} className="flex flex-col gap-1">
          <h2 className="text-text-muted">{t('start.recent.title')}</h2>
          <ul className="flex flex-col divide-y divide-border rounded border border-border">
            {recentFiles.data.map((file) => (
              <li key={file.path} className="flex items-center gap-3 px-3 py-1.5">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left hover:underline"
                  onClick={() => opener.openPath(file.path)}
                >
                  <span className={file.missing ? 'font-medium line-through' : 'font-medium'}>
                    {file.name}
                  </span>
                  {file.missing ? (
                    <span className="ml-2 text-warning">{t('start.recent.missing')}</span>
                  ) : null}
                  <span className="block truncate text-text-muted">{file.path}</span>
                </button>
                <Button
                  variant="ghost"
                  aria-label={`${t('start.recent.remove')}: ${file.name}`}
                  title={t('start.recent.remove')}
                  onClick={() => void forget(file.path)}
                >
                  <X size={16} />
                </Button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
            <Button onClick={() => setDiscarding(null)}>{t('common.cancel')}</Button>
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
          <Button type="button" onClick={onClose}>
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
