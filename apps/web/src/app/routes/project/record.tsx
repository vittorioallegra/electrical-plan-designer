import { useLoaderData, useParams } from 'react-router';
import { OpenRecord } from '@/features/editor/components/OpenRecord';
import type { ProjectRecord } from '@/lib/repositories/types';

/** `/projects/:id/*`: opens a server project, then shows it under `/project/<view>`. */
export function RecordRoute() {
  const record = useLoaderData<ProjectRecord | null>();
  const { id = '', '*': view = '' } = useParams();
  return <OpenRecord key={id} record={record} view={view} />;
}
