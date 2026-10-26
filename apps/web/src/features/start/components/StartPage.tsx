import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  newProjectFile,
  projectFileFromTemplate,
  ProjectFileError,
  type ProjectFile,
} from '@epd/domain/projectFile';
import { queryKeys } from '@/api/keys';
import { readEpd, type OpenedProject, type ProjectAssets } from '@/lib/projectFile/epd';
import { useEditorServices, useWorkspace } from '@/stores/editor/EditorContext';
import { saveStatusOf, type EditorInit } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

type Creating = { template: OpenedProject | null; templateName?: string };

/** What a start action would replace: changes that are not in a file, or the recovery copy. */
type Confirm =
  { kind: 'unsaved'; name: string; run: () => void } | { kind: 'discard_recovery'; name: string };

/**
 * `/`: start a project. New, new from a template file, open a file, restore the recovery copy a
 * crash left (or discard it). Anything that would replace a project with changes not saved to a
 * file asks first.
 */
export function StartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { recovery, fileAccess, workspace } = useEditorServices();
  const queryClient = useQueryClient();
  const current = useWorkspace((s) => s.current);
  const recovered = useQuery({
    queryKey: queryKeys.recovery(),
    queryFn: () => recovery.get(),
    staleTime: 0,
  });
  const [creating, setCreating] = useState<Creating | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const dateFormat = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  /** Runs `action` now, or after confirming when it would drop changes that are not in a file. */
  function guard(action: () => void | Promise<void>) {
    const run = () => void Promise.resolve(action()).catch(() => toast(t('start.failed'), 'error'));
    // A read-only project (a newer file) loses nothing.
    const open = current?.store.getState();
    const editable = open && !open.readOnly ? open : undefined;
    const atRisk = editable
      ? saveStatusOf(editable) !== 'saved'
      : !current && recovered.data
        ? !recovered.data.savedToFile
        : false;
    const name = editable?.data.meta.name ?? recovered.data?.project.meta.name ?? '';
    if (atRisk) setConfirm({ kind: 'unsaved', name, run });
    else run();
  }

  const refreshRecovery = () =>
    void queryClient.invalidateQueries({ queryKey: queryKeys.recovery() });

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

  function openProject(init: EditorInit) {
    workspace.getState().open(init);
    refreshRecovery();
    navigate('/project/plan');
  }

  /** Reads a picked file; a broken or unsupported file shows why and returns null. */
  function read(bytes: Uint8Array): OpenedProject | null {
    try {
      return readEpd(bytes);
    } catch (e) {
      toast(t(`start.openErrors.${e instanceof ProjectFileError ? e.code : 'invalid'}`), 'error');
      return null;
    }
  }

  async function openFile() {
    const picked = await fileAccess.open();
    const opened = picked && read(picked.bytes);
    if (picked && opened) {
      const { path, name, stat } = picked;
      openProject({ data: opened.project, assets: opened.assets, file: { path, name, stat } });
    }
  }

  async function pickTemplate() {
    const picked = await fileAccess.open();
    const template = picked && read(picked.bytes);
    if (template) setCreating({ template, templateName: picked.name });
  }

  function create(values: { name: string; clientName: string; address: string }) {
    const input = { ...values, firstFloorName: t('start.firstFloorName') };
    const now = new Date();
    const template = creating?.template ?? null;
    let project: ProjectFile;
    const assets: ProjectAssets = new Map();
    if (template) {
      project = projectFileFromTemplate(template.project, input, now);
      const logoId = project.company.logoAssetId;
      const logo = logoId === undefined ? undefined : template.assets.get(logoId);
      if (logoId !== undefined && logo) assets.set(logoId, logo);
    } else {
      project = newProjectFile(input, now);
    }
    setCreating(null);
    openProject({ data: project, assets, status: 'unsaved' });
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
          <Button
            onClick={() => setConfirm({ kind: 'discard_recovery', name: shown.project.meta.name })}
          >
            {t('start.recovery.discard')}
          </Button>
          <Button variant="primary" onClick={() => void restore()}>
            {t('start.recovery.restore')}
          </Button>
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => guard(() => setCreating({ template: null }))}>
          {t('start.new')}
        </Button>
        <Button onClick={() => guard(pickTemplate)}>{t('start.fromTemplate')}</Button>
        <Button onClick={() => guard(openFile)}>{t('start.open')}</Button>
      </div>

      {creating ? (
        <NewProjectDialog
          title={
            creating.templateName
              ? t('start.templateTitle', { name: creating.templateName })
              : t('start.newTitle')
          }
          onClose={() => setCreating(null)}
          onSubmit={create}
        />
      ) : null}

      <Dialog
        open={confirm !== null}
        onOpenChange={(open) => !open && setConfirm(null)}
        title={t(
          confirm?.kind === 'discard_recovery'
            ? 'start.recovery.discardTitle'
            : 'start.replaceDraft.title',
        )}
        description={t(
          confirm?.kind === 'discard_recovery'
            ? 'start.recovery.discardBody'
            : 'start.replaceDraft.body',
          { name: confirm?.name ?? '' },
        )}
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                const choice = confirm;
                setConfirm(null);
                if (choice?.kind === 'unsaved') choice.run();
                else void discardRecovery();
              }}
            >
              {t(
                confirm?.kind === 'discard_recovery'
                  ? 'start.recovery.discard'
                  : 'start.replaceDraft.confirm',
              )}
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
