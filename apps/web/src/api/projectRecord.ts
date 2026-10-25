import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import type { ProjectMeta } from '@epd/domain/types';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';
import type { ProjectRecord } from '@/lib/repositories/types';
import type { EditorData } from '@/stores/editor/editorStore';
import { queryKeys } from './keys';

/**
 * Reads a project record, always from the server: autosave advances the record version, so a
 * cached record could make the first save fail with `version_conflict`. `null` = not found.
 * The editor store is created once from the result; nothing re-seeds an open editor.
 */
export function useFetchProjectRecord(): (projectId: string) => Promise<ProjectRecord | null> {
  const { userId } = useSession();
  const { projects } = useRepositories();
  const queryClient = useQueryClient();
  return useCallback(
    (projectId: string) =>
      queryClient.fetchQuery({
        queryKey: queryKeys.project(userId, projectId),
        queryFn: () => projects.get(projectId),
        staleTime: 0,
      }),
    [queryClient, projects, userId],
  );
}

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
