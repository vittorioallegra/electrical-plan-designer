import { queryOptions, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ProjectMeta } from '@epd/domain/types';
import { useSession } from '@/lib/auth/AuthProvider';
import type { ProjectRecord, Repositories } from '@/lib/repositories/types';
import type { EditorData } from '@/stores/editor/editorStore';
import { queryKeys } from './keys';

/**
 * A project record, always read from the server (`staleTime: 0`): autosave advances the record
 * version, so a cached record could make the first save fail with `version_conflict`.
 * `null` = not found. The editor store is created once from it; nothing re-seeds an open editor.
 */
export const projectRecordQuery = (repos: Repositories, userId: string, projectId: string) =>
  queryOptions({
    queryKey: queryKeys.project(userId, projectId),
    queryFn: () => repos.projects.get(projectId),
    staleTime: 0,
  });

/** After an autosave: the cached record takes the saved data and version, the list refetches. */
export function useProjectSaved(): (meta: ProjectMeta, data: EditorData) => void {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return useCallback(
    (meta: ProjectMeta, data: EditorData) => {
      const record: ProjectRecord = {
        meta,
        settings: data.settings,
        quote: data.quote,
        rawDoc: data.doc,
      };
      queryClient.setQueryData<ProjectRecord | null>(queryKeys.project(userId, meta.id), record);
      void queryClient.invalidateQueries({ queryKey: queryKeys.projects(userId) });
    },
    [queryClient, userId],
  );
}
