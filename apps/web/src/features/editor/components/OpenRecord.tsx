import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link, Navigate } from 'react-router';
import { useRepositories } from '@/lib/repositories/provider';
import type { Draft, ProjectRecord } from '@/lib/repositories/types';
import { openRecord } from '@/lib/projectFile/record';
import { DocLoadError, loadDoc } from '@epd/domain/load';
import { projectFileSchema } from '@epd/domain/projectFile';
import { useEditorServices } from '@/stores/editor/EditorContext';
import { Button } from '@/components/ui/Button';
import { downloadJson } from '@/lib/download';

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'failed' }
  | { status: 'invalid'; error: DocLoadError; raw: unknown; name: string }
  | { status: 'confirm'; draftName: string; open: () => void }
  | { status: 'opened' };

export const PROJECT_VIEWS = ['plan', 'panel', 'quote', 'settings', 'catalog', 'company'] as const;

/** The draft, when it was opened from this record and still passes the file schema. */
function draftFor(draft: Draft | null, recordId: string): Draft | null {
  if (!draft || draft.recordId !== recordId) return null;
  return projectFileSchema.safeParse(draft.project).success ? draft : null;
}

/**
 * Opens a server project record as the tab's open project, then goes to its view. A draft
 * opened from the same record is newer than the record (autosave writes only the draft), so
 * it is resumed; a draft of another project with changes not in a file is replaced only after
 * the user confirms. The route remounts this component per record (`key`).
 */
export function OpenRecord({
  record: loaded,
  view,
}: {
  record: ProjectRecord | null;
  view: string;
}) {
  const { t } = useTranslation();
  const [record] = useState(loaded);
  const repos = useRepositories();
  const { drafts, workspace } = useEditorServices();
  const [state, setState] = useState<LoadState>(() =>
    record ? { status: 'loading' } : { status: 'not_found' },
  );

  useEffect(() => {
    if (!record) return;
    const id = record.meta.id;
    let active = true;
    void (async () => {
      if (workspace.getState().current?.store.getState().recordId === id) {
        setState({ status: 'opened' });
        return;
      }
      let loadedDoc;
      try {
        loadedDoc = loadDoc(record.rawDoc);
      } catch (e) {
        if (!(e instanceof DocLoadError)) throw e;
        setState({ status: 'invalid', error: e, raw: record.rawDoc, name: record.meta.name });
        return;
      }
      const { doc, readOnly } = loadedDoc;
      const stored = readOnly ? null : await drafts.get().catch(() => null);
      const own = draftFor(stored, id);
      const open = async () => {
        const opened = own ?? (await openRecord(record, doc, repos.files));
        if (!active) return;
        workspace.getState().open({
          recordId: id,
          file: own?.file ?? null,
          data: opened.project,
          assets: opened.assets,
          readOnly,
          status: own && !own.savedToFile ? 'draft' : 'saved',
        });
        setState({ status: 'opened' });
      };
      if (!active) return;
      if (stored && !own && !stored.savedToFile && !readOnly) {
        const fail = (e: unknown) => {
          console.error(e);
          if (active) setState({ status: 'failed' });
        };
        setState({
          status: 'confirm',
          draftName: stored.project.meta.name,
          open: () => void open().catch(fail),
        });
        return;
      }
      await open();
    })().catch((e: unknown) => {
      // An unexpected error (not a DocLoadError) must not leave the page on "Loading".
      console.error(e);
      if (active) setState({ status: 'failed' });
    });
    return () => {
      active = false;
    };
  }, [record, repos, drafts, workspace]);

  if (state.status === 'opened') {
    const target = (PROJECT_VIEWS as readonly string[]).includes(view) ? view : 'plan';
    return <Navigate to={`/project/${target}`} replace />;
  }
  if (state.status === 'loading')
    return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
  if (state.status === 'confirm') {
    return (
      <div className="mx-auto max-w-2xl p-6" role="alert">
        <h1 className="mb-2 text-xl font-semibold">{t('start.replaceDraft.title')}</h1>
        <p className="mb-4">{t('start.replaceDraft.body', { name: state.draftName })}</p>
        <div className="flex gap-2">
          <Button variant="primary" onClick={state.open}>
            {t('start.replaceDraft.confirm')}
          </Button>
          <Link to="/" className="self-center text-accent underline">
            {t('nav.start')}
          </Link>
        </div>
      </div>
    );
  }
  if (state.status === 'not_found' || state.status === 'failed') {
    return (
      <div className="p-6">
        <p className="mb-3">
          {t(state.status === 'not_found' ? 'editor.notFound' : 'editor.loadFailed')}
        </p>
        <Link to="/projects" className="text-accent underline">
          {t('nav.projects')}
        </Link>
      </div>
    );
  }
  return (
    <div className="mx-auto max-w-2xl p-6" role="alert">
      <h1 className="mb-2 text-xl font-semibold">{t('editor.recovery.title')}</h1>
      <p className="mb-3 text-text-muted">{t('editor.recovery.body')}</p>
      <ul className="mb-4 list-disc pl-5 font-mono text-sm" data-testid="doc-issues">
        {state.error.issues.slice(0, 10).map((issue, i) => (
          <li key={i}>{`${issue.path || '(root)'}: ${issue.message}`}</li>
        ))}
      </ul>
      <div className="flex gap-2">
        <Button variant="primary" onClick={() => downloadJson(state.raw, `${state.name}-raw.json`)}>
          {t('editor.recovery.download')}
        </Button>
        <Link to="/projects" className="self-center text-accent underline">
          {t('nav.projects')}
        </Link>
      </div>
    </div>
  );
}
