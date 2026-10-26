import { useLoaderData, useParams } from 'react-router';
import { ProjectFrame } from '@/app/layouts/ProjectFrame';
import { ProjectLoader } from '@/features/editor/components/ProjectLoader';
import type { ProjectRecord } from '@/lib/repositories/types';

/** The loaded project in the shared project frame around the child route. */
export function ProjectLayoutRoute() {
  const record = useLoaderData<ProjectRecord | null>();
  const { id = '' } = useParams();
  return <ProjectLoader key={id} record={record} renderFrame={() => <ProjectFrame />} />;
}
