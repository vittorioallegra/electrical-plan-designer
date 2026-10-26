import { useEffect, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router';
import { useRepositories } from '@/lib/repositories/provider';
import type { Draft, ProjectRecord } from '@/lib/repositories/types';
import { openRecord } from '@/lib/projectFile/record';
import { DocLoadError, loadDoc } from '@epd/domain/load';
import { projectFileSchema } from '@epd/domain/projectFile';
import { startAutosave, type Autosave } from '@/stores/editor/autosave';
import { EditorProvider, useEditorServices } from '@/stores/editor/EditorContext';
import { createEditorStore, type EditorStore } from '@/stores/editor/editorStore';
import { Button } from '@/components/ui/Button';
import { downloadJson } from '@/lib/download';

type LoadState =
  | { status: 'loading' }
  | { status: 'not_found' }
  | { status: 'failed' }
  | { status: 'invalid'; error: DocLoadError; raw: unknown; name: string }
  | { status: 'ready'; store: EditorStore; autosave: Autosave };

declare global {
  interface Window {
    __epd?: { store: EditorStore };
  }
}

/** The draft, when it was opened from this record and still passes the file schema. */
function draftFor(draft: Draft | null, recordId: string): Draft | null {
  if (!draft || draft.recordId !== recordId) return null;
  return projectFileSchema.safeParse(draft.project).success ? draft : null;
}

/**
 * Validates a loaded project record, then mounts the editor with its store and autosave.
 * A draft opened from the same record is newer than the record (autosave writes only the
 * draft), so the editor resumes it. The route remounts this component per project (`key`);
 * the store is created once, so a later record never re-seeds the editor.
 * The app supplies the frame (top bar, views, drawer), which composes several features.
 */
export function ProjectLoader({
  record: loaded,
  renderFrame,
}: {
  record: ProjectRecord | null;
  renderFrame: () => ReactNode;
}) {
  const { t } = useTranslation();
  const [record] = useState(loaded);
  const repos = useRepositories();
  const { drafts, exposeTestHandle } = useEditorServices();
  const [state, setState] = useState<LoadState>(() =>
    record ? { status: 'loading' } : { status: 'not_found' },
  );

  useEffect(() => {
    if (!record) return;
    const id = record.meta.id;
    let active = true;
    let cleanup: (() => void) | undefined;
    void (async () => {
      let loadedDoc;
      try {
        loadedDoc = loadDoc(record.rawDoc);
      } catch (e) {
        if (!(e instanceof DocLoadError)) throw e;
        setState({ status: 'invalid', error: e, raw: record.rawDoc, name: record.meta.name });
        return;
      }
      const draft = loadedDoc.readOnly ? null : draftFor(await drafts.get().catch(() => null), id);
      const opened = draft ?? (await openRecord(record, loadedDoc.doc, repos.files));
      if (!active) return;
      const store = createEditorStore({
        projectId: id,
        data: opened.project,
        assets: opened.assets,
        readOnly: loadedDoc.readOnly,
        status: draft && !draft.savedToFile ? 'draft' : 'saved',
      });
      const autosave = startAutosave(store, { drafts });
      if (exposeTestHandle) window.__epd = { store };
      cleanup = () => {
        autosave.stop();
        if (window.__epd?.store === store) delete window.__epd;
      };
      setState({ status: 'ready', store, autosave });
    })().catch((e: unknown) => {
      // An unexpected error (not a DocLoadError) must not leave the page on "Loading".
      console.error(e);
      if (active) setState({ status: 'failed' });
    });
    return () => {
      active = false;
      cleanup?.();
    };
  }, [record, repos, drafts, exposeTestHandle]);

  if (state.status === 'loading')
    return <p className="p-4 text-text-muted">{t('common.loading')}</p>;
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
  if (state.status === 'invalid') {
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
          <Button
            variant="primary"
            onClick={() => downloadJson(state.raw, `${state.name}-raw.json`)}
          >
            {t('editor.recovery.download')}
          </Button>
          <Link to="/projects" className="self-center text-accent underline">
            {t('nav.projects')}
          </Link>
        </div>
      </div>
    );
  }
  return (
    <EditorProvider store={state.store} autosave={state.autosave}>
      {renderFrame()}
    </EditorProvider>
  );
}
