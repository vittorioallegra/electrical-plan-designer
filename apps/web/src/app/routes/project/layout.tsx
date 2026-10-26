import { Navigate } from 'react-router';
import { ProjectFrame } from '@/app/layouts/ProjectFrame';
import { EditorProvider, useWorkspace } from '@/stores/editor/EditorContext';

/** `/project/*`: the tab's open project in the shared frame; the start screen without one. */
export function ProjectLayoutRoute() {
  const current = useWorkspace((s) => s.current);
  if (!current) return <Navigate to="/" replace />;
  return (
    <EditorProvider key={current.id} store={current.store} autosave={current.autosave}>
      <ProjectFrame />
    </EditorProvider>
  );
}
