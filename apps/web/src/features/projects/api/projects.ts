import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { ProjectMeta } from '@epd/domain/types';
import { queryKeys } from '@/api/keys';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';
import type { NewProject } from '@/lib/repositories/types';

type MetaPatch = Partial<Pick<ProjectMeta, 'name' | 'clientName' | 'address'>>;

export function useProjects() {
  const { userId } = useSession();
  const { projects } = useRepositories();
  return useQuery({ queryKey: queryKeys.projects(userId), queryFn: () => projects.list() });
}

function useInvalidateProjects() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.projects(userId) });
}

export function useCreateProject() {
  const { projects } = useRepositories();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (input: NewProject) => projects.create(input),
    onSuccess: () => void invalidate(),
  });
}

export function useUpdateProject() {
  const { projects } = useRepositories();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: MetaPatch }) => projects.updateMeta(id, patch),
    onSuccess: invalidate,
  });
}

export function useDeleteProject() {
  const { userId } = useSession();
  const { projects } = useRepositories();
  const queryClient = useQueryClient();
  const invalidate = useInvalidateProjects();
  return useMutation({
    mutationFn: (id: string) => projects.delete(id),
    onSuccess: (_data, id) => {
      queryClient.removeQueries({ queryKey: queryKeys.project(userId, id) });
      return invalidate();
    },
  });
}
