import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useTranslation } from 'react-i18next';
import { useRepositories } from '@/lib/repositories/provider';
import { builtinCatalog } from '@epd/domain/catalog/builtin';
import { createCatalogLookup, type CatalogLookup } from '@epd/domain/catalog/lookup';
import type { CatalogCategory, CatalogItem } from '@epd/domain/catalog/types';
import type { Profile, ProfilePatch } from '@/lib/repositories/types';

interface CatalogState {
  /** Built-ins + the account's user items (archived included). */
  items: CatalogItem[];
  userItems: CatalogItem[];
  lookup: CatalogLookup;
  reload: () => void;
  /** Account profile (price list, box presets); null while loading. */
  profile: Profile | null;
  updateProfile: (patch: ProfilePatch) => Promise<void>;
}

const CatalogContext = createContext<CatalogState | null>(null);

/** Loads the account catalog once per signed-in session and shares it. */
export function CatalogProvider({ children }: { children: ReactNode }) {
  const { catalog, profile: profileRepo } = useRepositories();
  const [userItems, setUserItems] = useState<CatalogItem[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  useEffect(() => {
    let active = true;
    profileRepo
      .get()
      .then((p) => active && setProfile(p))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [profileRepo]);
  const updateProfile = useCallback(
    async (patch: ProfilePatch) => {
      await profileRepo.update(patch);
      setProfile((p) => (p ? { ...p, ...patch } : p));
    },
    [profileRepo],
  );
  const [generation, setGeneration] = useState(0);
  useEffect(() => {
    let active = true;
    catalog
      .list()
      .then((items) => active && setUserItems(items))
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [catalog, generation]);
  const reload = useCallback(() => setGeneration((g) => g + 1), []);
  const value = useMemo<CatalogState>(
    () => ({
      items: [...builtinCatalog, ...userItems],
      userItems,
      lookup: createCatalogLookup(userItems),
      reload,
      profile,
      updateProfile,
    }),
    [userItems, reload, profile, updateProfile],
  );
  return <CatalogContext.Provider value={value}>{children}</CatalogContext.Provider>;
}

export function useCatalog(): CatalogState {
  const ctx = useContext(CatalogContext);
  if (!ctx) throw new Error('CatalogProvider missing');
  return ctx;
}

/** Display name of a catalog item (built-in names are i18n keys). */
export function useItemName(): (item: CatalogItem | undefined, fallbackId?: string) => string {
  const { t } = useTranslation();
  return useCallback(
    (item, fallbackId) =>
      item
        ? item.ownerId === null
          ? t(item.name)
          : item.name
        : t('catalog.missingItem', { id: fallbackId ?? '' }),
    [t],
  );
}

/** Non-archived items of one category, for pickers. */
export function useItemsOf(category: CatalogCategory): CatalogItem[] {
  const { items } = useCatalog();
  return useMemo(
    () => items.filter((i) => i.category === category && !i.archived),
    [items, category],
  );
}
