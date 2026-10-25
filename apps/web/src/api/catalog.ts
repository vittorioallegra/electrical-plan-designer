import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useMemo } from 'react';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import { createCatalogLookup, type CatalogLookup } from '@epd/domain/catalog/lookup';
import type { CatalogItem } from '@epd/domain/catalog/types';
import { useSession } from '@/lib/auth/AuthProvider';
import { useRepositories } from '@/lib/repositories/provider';
import type { NewCatalogItem, Profile, ProfilePatch } from '@/lib/repositories/types';
import { queryKeys } from './keys';
import { useProfile, useUpdateProfile } from './profile';

const NO_ITEMS: CatalogItem[] = [];

/** The account's own catalog items (archived included). */
export function useCatalogItems() {
  const { userId } = useSession();
  const { catalog } = useRepositories();
  return useQuery({ queryKey: queryKeys.catalogItems(userId), queryFn: () => catalog.list() });
}

function useInvalidateCatalogItems() {
  const { userId } = useSession();
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: queryKeys.catalogItems(userId) });
}

export function useCreateCatalogItem() {
  const { catalog } = useRepositories();
  const invalidate = useInvalidateCatalogItems();
  return useMutation({
    mutationFn: (item: NewCatalogItem) => catalog.create(item),
    onSuccess: invalidate,
  });
}

export function useUpdateCatalogItem() {
  const { catalog } = useRepositories();
  const invalidate = useInvalidateCatalogItems();
  return useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<NewCatalogItem> }) =>
      catalog.update(id, patch),
    onSuccess: invalidate,
  });
}

export interface CatalogState {
  /** Built-ins + the account's user items (archived included). */
  items: CatalogItem[];
  userItems: CatalogItem[];
  lookup: CatalogLookup;
  reload: () => void;
  /** Account profile (price list, box presets); null while loading or when it failed. */
  profile: Profile | null;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
}

/**
 * Catalog and profile as the editor pages use them. A failed catalog load leaves only the
 * built-ins (as before); pages that must report it read `useCatalogItems()` directly.
 */
export function useCatalog(): CatalogState {
  const items = useCatalogItems();
  const profile = useProfile();
  const { mutateAsync } = useUpdateProfile();
  const userItems = items.data ?? NO_ITEMS;
  const { refetch } = items;
  const reload = useCallback(() => void refetch(), [refetch]);
  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      await mutateAsync(patch);
    },
    [mutateAsync],
  );
  return useMemo(
    () => ({
      items: [...builtinCatalog, ...userItems],
      userItems,
      lookup: createCatalogLookup(userItems),
      reload,
      profile: profile.data ?? null,
      updateProfile,
    }),
    [userItems, reload, profile.data, updateProfile],
  );
}
