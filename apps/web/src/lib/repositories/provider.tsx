import { createContext, useContext, type ReactNode } from 'react';
import type { AppConfig } from '@/config/env';
import { createMemoryRepositories } from './memory';
import { seedMemory } from './memorySeed';
import { createSupabaseRepositories } from './supabase';
import type { Repositories } from './types';

export function createRepositories(config: AppConfig): Repositories {
  if (config.dataMode === 'memory') {
    const { repos, control } = createMemoryRepositories();
    seedMemory(control);
    return repos;
  }
  return createSupabaseRepositories(config.supabaseUrl, config.supabaseAnonKey);
}

const RepositoriesContext = createContext<Repositories | null>(null);

export function RepositoriesProvider({
  repos,
  children,
}: {
  repos: Repositories;
  children: ReactNode;
}) {
  return <RepositoriesContext.Provider value={repos}>{children}</RepositoriesContext.Provider>;
}

export function useRepositories(): Repositories {
  const repos = useContext(RepositoriesContext);
  if (!repos) throw new Error('RepositoriesProvider missing');
  return repos;
}
