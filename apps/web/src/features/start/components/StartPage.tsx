import { useQuery } from '@tanstack/react-query';
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
import type { FileRef } from '@/lib/repositories/types';
import { useDraftActions } from '@/hooks/useDraftActions';
import { useEditorServices, useWorkspace } from '@/stores/editor/EditorContext';
import { saveStatusOf, type EditorInit } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/TextField';
import { useToast } from '@/components/ui/Toast';

type Creating = { template: OpenedProject | null; templateName?: string };

/** What a start action would replace: changes not in a file, or the project of another tab. */
type Confirm =
  | { kind: 'unsaved'; name: string; run: () => void }
  | { kind: 'other_tab'; name: string; unsaved: boolean; run: () => void };

/**
 * `/`: start a project. New, new from a template file, open a file, resume the draft, recent
 * files. Anything that would replace a project with changes not saved to a file, or the
 * project another tab is editing, asks first. The draft another tab holds opens read-only, or
 * is taken over (that tab turns read-only).
 */
export function StartPage() {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const toast = useToast();
  const { drafts, presence, fileAccess, workspace } = useEditorServices();
  const current = useWorkspace((s) => s.current);
  const tabLock = useWorkspace((s) => s.tabLock);
  const draftActions = useDraftActions();
  const draft = useQuery({
    queryKey: queryKeys.draft(),
    queryFn: () => drafts.get(),
    staleTime: 0,
  });
  // The tab that holds the draft, if another one does.
  const holder = useQuery({
    queryKey: queryKeys.draftHolder(),
    queryFn: () => presence.holder(),
    staleTime: 0,
  });
  const elsewhere = holder.data ?? null;
  const recent = useQuery({
    queryKey: queryKeys.recentFiles(),
    queryFn: () => fileAccess.recent(),
    staleTime: 0,
  });
  const [creating, setCreating] = useState<Creating | null>(null);
  const [confirm, setConfirm] = useState<Confirm | null>(null);

  const dateFormat = new Intl.DateTimeFormat(i18n.language === 'it' ? 'it-IT' : 'en-GB', {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  /**
   * Runs `action` now, or after confirming when it would drop changes not in a file or take
   * the draft from another tab (which is then made read-only first).
   */
  function guard(action: () => void | Promise<void>) {
    const fail = () => toast(t('start.failed'), 'error');
    const run = () => void Promise.resolve(action()).catch(fail);
    if (elsewhere) {
      const takeOver = () =>
        void presence
          .claim()
          .then(() => {
            draftActions.refresh();
            return action();
          })
          .catch(fail);
      setConfirm({
        kind: 'other_tab',
        name: elsewhere.name,
        unsaved: elsewhere.unsaved,
        run: takeOver,
      });
      return;
    }
    // A read-only project here (another tab's draft, a newer file) loses nothing.
    const open = current?.store.getState();
    const editable = open && !open.readOnly ? open : undefined;
    const atRisk = editable
      ? saveStatusOf(editable) !== 'saved'
      : !current && draft.data
        ? !draft.data.savedToFile
        : false;
    const name = editable?.data.meta.name ?? draft.data?.project.meta.name ?? '';
    if (atRisk) setConfirm({ kind: 'unsaved', name, run });
    else run();
  }

  function openProject(init: EditorInit) {
    workspace.getState().open(init);
    draftActions.refresh();
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

  function openPicked(file: FileRef, bytes: Uint8Array) {
    const opened = read(bytes);
    if (opened) openProject({ file, data: opened.project, assets: opened.assets });
  }

  async function openFile() {
    const picked = await fileAccess.open();
    if (picked) openPicked(picked.file, picked.bytes);
  }

  async function openRecent(file: FileRef) {
    const picked = await fileAccess.reopen(file);
    if (picked) openPicked(picked.file, picked.bytes);
    else toast(t('start.recentGone', { name: file.name }), 'error');
  }

  async function pickTemplate() {
    const picked = await fileAccess.open();
    const template = picked && read(picked.bytes);
    if (template) setCreating({ template, templateName: picked.file.name });
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

  // The draft is this tab's open project unless that one is a read-only view.
  const shownDraft = (!current || tabLock !== null) && draft.data ? draft.data : null;

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

      {shownDraft ? (
        <section
          className="flex items-center gap-3 rounded border border-border p-3"
          aria-label={t('start.draft.title')}
        >
          <div className="min-w-0 flex-1">
            <p className="text-text-muted">{t('start.draft.title')}</p>
            <p className="truncate font-medium">{shownDraft.project.meta.name}</p>
            <p className="text-text-muted">
              {t('start.draft.lastChange', {
                date: dateFormat.format(new Date(shownDraft.savedAt)),
              })}
              {shownDraft.savedToFile ? null : ` · ${t('start.draft.notInFile')}`}
            </p>
            {elsewhere ? (
              <p className="text-warning" role="status">
                {t('start.draft.inUse')}
              </p>
            ) : null}
          </div>
          {elsewhere ? (
            <>
              <Button onClick={() => void draftActions.openReadOnly()}>
                {t('start.draft.openReadOnly')}
              </Button>
              <Button variant="primary" onClick={() => void draftActions.takeOver()}>
                {t('start.draft.editHere')}
              </Button>
            </>
          ) : (
            <Button variant="primary" onClick={() => void draftActions.resume()}>
              {t('start.draft.resume')}
            </Button>
          )}
        </section>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button variant="primary" onClick={() => guard(() => setCreating({ template: null }))}>
          {t('start.new')}
        </Button>
        <Button onClick={() => guard(pickTemplate)}>{t('start.fromTemplate')}</Button>
        <Button onClick={() => guard(openFile)}>{t('start.open')}</Button>
      </div>

      {recent.data && recent.data.length > 0 ? (
        <section aria-label={t('start.recent')}>
          <h2 className="mb-2 font-medium">{t('start.recent')}</h2>
          <ul className="divide-y divide-border rounded border border-border">
            {recent.data.map((file, i) => (
              <li key={`${file.name}-${i}`}>
                <button
                  type="button"
                  className="w-full truncate px-3 py-2 text-left hover:bg-surface-muted"
                  onClick={() => guard(() => openRecent(file))}
                >
                  {file.name}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {fileAccess.canOverwrite ? null : (
        <p className="text-text-muted" role="note">
          {t('start.browserNote')}
        </p>
      )}

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
          confirm?.kind === 'other_tab' ? 'start.otherTab.title' : 'start.replaceDraft.title',
        )}
        description={
          confirm?.kind === 'other_tab'
            ? t(confirm.unsaved ? 'start.otherTab.bodyUnsaved' : 'start.otherTab.body', {
                name: confirm.name,
              })
            : t('start.replaceDraft.body', { name: confirm?.name ?? '' })
        }
        footer={
          <>
            <Button onClick={() => setConfirm(null)}>{t('common.cancel')}</Button>
            <Button
              variant="danger"
              onClick={() => {
                const run = confirm?.run;
                setConfirm(null);
                run?.();
              }}
            >
              {t(
                confirm?.kind === 'other_tab'
                  ? 'start.otherTab.confirm'
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
