// Query keys. Every key starts with the signed-in user id, and the cache is cleared when the
// user changes (lib/auth/AuthProvider), so no data of a previous session is ever shown.
import type { Bucket } from '@/lib/repositories/types';

export const queryKeys = {
  catalogItems: (userId: string) => [userId, 'catalogItems'] as const,
  profile: (userId: string) => [userId, 'profile'] as const,
  projects: (userId: string) => [userId, 'projects'] as const,
  project: (userId: string, projectId: string) => [userId, 'project', projectId] as const,
  purchases: (userId: string, projectId: string) => [userId, 'purchases', projectId] as const,
  file: (userId: string, bucket: Bucket, path: string) => [userId, 'file', bucket, path] as const,
  draft: (userId: string) => [userId, 'draft'] as const,
  recentFiles: (userId: string) => [userId, 'recentFiles'] as const,
  backgroundImage: (userId: string, path: string) => [userId, 'backgroundImage', path] as const,
};
