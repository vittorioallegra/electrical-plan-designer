import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';
import { queryKeys } from './keys';

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
