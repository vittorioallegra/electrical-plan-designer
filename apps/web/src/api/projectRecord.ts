import { queryOptions } from '@tanstack/react-query';
import type { Repositories } from '@/lib/repositories/types';
import { queryKeys } from './keys';

/**
 * A project record, always read from the server (`staleTime: 0`: renames and other devices
 * change it). `null` = not found. The editor store is created once from it (or from the draft
 * opened from it); nothing re-seeds an open editor.
 */
export const projectRecordQuery = (repos: Repositories, userId: string, projectId: string) =>
  queryOptions({
    queryKey: queryKeys.project(userId, projectId),
    queryFn: () => repos.projects.get(projectId),
    staleTime: 0,
  });
