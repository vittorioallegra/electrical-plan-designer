import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';
import type { Bucket, Profile, ProfilePatch, Repositories } from '@/lib/repositories/types';
import { queryKeys } from './keys';

export const profileQuery = (repos: Repositories, userId: string) =>
  queryOptions({ queryKey: queryKeys.profile(userId), queryFn: () => repos.profile.get() });

/** Account profile (business data, price list, box presets). */
export function useProfile() {
  const { userId } = useSession();
  return useQuery(profileQuery(useRepositories(), userId));
}

/** Saves a profile patch and merges it into the shared profile query. */
export function useUpdateProfile() {
  const { userId } = useSession();
  const { profile } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: ProfilePatch) => profile.update(patch),
    onSuccess: (_data, patch) =>
      queryClient.setQueryData<Profile>(queryKeys.profile(userId), (p) =>
        p ? { ...p, ...patch } : p,
      ),
  });
}

/** Reserves the next quote number (a profile counter). */
export function useNextQuoteNumber() {
  const { userId } = useSession();
  const { profile } = useRepositories();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => profile.nextQuoteNumber(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: queryKeys.profile(userId) }),
  });
}

/** A stored file (logo, background) as a blob; `null` path disables the query. */
export function useFileBlob(bucket: Bucket, path: string | null) {
  const { userId } = useSession();
  const { files } = useRepositories();
  return useQuery({
    queryKey: queryKeys.file(userId, bucket, path ?? ''),
    queryFn: () => files.download(bucket, path!),
    enabled: path !== null,
    staleTime: Infinity,
  });
}
