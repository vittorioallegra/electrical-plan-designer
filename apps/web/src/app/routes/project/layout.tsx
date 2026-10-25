import { ProjectFrame } from '@/app/layouts/ProjectFrame';
import { ProjectLoader } from '@/features/editor/components/ProjectLoader';

/** Loads the project, then shows the shared project frame around the child route. */
export function ProjectLayoutRoute() {
  return <ProjectLoader renderFrame={(props) => <ProjectFrame {...props} />} />;
}
