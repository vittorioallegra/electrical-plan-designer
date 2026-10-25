// In-memory repositories: unit/component tests and Docker-less dev (`pnpm dev:mem`).
import type { CatalogItem } from '@/domain/catalog/types';
import { newId } from '@/domain/ids';
import type { ProjectMeta, ProjectQuote, ProjectSettings } from '@/domain/types';
import {
  AuthError,
  SaveError,
  type Bucket,
  type NewProject,
  type Profile,
  type Repositories,
  type Session,
} from './types';

interface StoredProject {
  ownerId: string;
  meta: ProjectMeta;
  settings: ProjectSettings;
  quote: ProjectQuote;
  doc: unknown;
}

interface User {
  id: string;
  email: string;
  password: string;
}

export function emptyProfile(email = ''): Profile {
  return {
    businessName: '',
    vatNumber: '',
    address: '',
    phone: '',
    email,
    logoPath: null,
    priceOverrides: {},
    boxPresets: [],
  };
}

/** Test hooks: inject failures and delays into the memory backend. */
export interface MemoryControl {
  users: Map<string, User>;
  projects: Map<string, StoredProject>;
  profiles: Map<string, Profile & { quoteCounter: number }>;
  catalog: Map<string, CatalogItem>;
  marks: Map<string, Map<string, number | null>>;
  files: Map<string, Blob>;
  /** Runs before every save; throw a SaveError to simulate a failure, await to delay. */
  beforeSave?: (projectId: string) => Promise<void> | void;
  /** Simulates session expiry: listeners get null. */
  expireSession(): void;
  saveCalls: { projectId: string; expectedVersion: number }[];
}

const clone = <T>(v: T): T => structuredClone(v);

export function createMemoryRepositories(): { repos: Repositories; control: MemoryControl } {
  let session: Session | null = null;
  const listeners = new Set<(s: Session | null) => void>();
  const setSession = (s: Session | null) => {
    session = s;
    for (const l of listeners) l(s);
  };

  const control: MemoryControl = {
    users: new Map(),
    projects: new Map(),
    profiles: new Map(),
    catalog: new Map(),
    marks: new Map(),
    files: new Map(),
    saveCalls: [],
    expireSession: () => setSession(null),
  };

  const me = (): Session => {
    if (!session) throw new SaveError('auth_expired');
    return session;
  };
  const owned = (id: string) => {
    const p = control.projects.get(id);
    return p && p.ownerId === me().userId ? p : undefined;
  };
  const profileOf = (userId: string) => {
    let p = control.profiles.get(userId);
    if (!p) {
      p = { ...emptyProfile(), quoteCounter: 0 };
      control.profiles.set(userId, p);
    }
    return p;
  };
  const fileKey = (bucket: Bucket, path: string) => `${bucket}/${path}`;
  const checkPath = (path: string) => {
    if (path.split('/')[0] !== me().userId) throw new Error('forbidden');
  };

  const repos: Repositories = {
    auth: {
      async getSession() {
        return session;
      },
      onChange(listener) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      async signUp(email, password) {
        const key = email.toLowerCase();
        if (control.users.has(key)) throw new AuthError('email_taken');
        if (password.length < 6) throw new AuthError('weak_password');
        const user = { id: newId(), email: key, password };
        control.users.set(key, user);
        profileOf(user.id).email = key;
        const s = { userId: user.id, email: key };
        setSession(s);
        return s;
      },
      async signIn(email, password) {
        const user = control.users.get(email.toLowerCase());
        if (!user || user.password !== password) throw new AuthError('invalid_credentials');
        const s = { userId: user.id, email: user.email };
        setSession(s);
        return s;
      },
      async signOut() {
        setSession(null);
      },
    },

    projects: {
      async list() {
        const userId = me().userId;
        return [...control.projects.values()]
          .filter((p) => p.ownerId === userId)
          .map((p) => clone(p.meta))
          .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      },
      async get(id) {
        const p = owned(id);
        return p
          ? {
              meta: clone(p.meta),
              settings: clone(p.settings),
              quote: clone(p.quote),
              rawDoc: clone(p.doc),
            }
          : null;
      },
      async create(input: NewProject) {
        const id = crypto.randomUUID();
        const meta: ProjectMeta = {
          id,
          name: input.name,
          clientName: input.clientName,
          address: input.address,
          updatedAt: new Date().toISOString(),
          version: 1,
        };
        control.projects.set(id, {
          ownerId: me().userId,
          meta,
          settings: clone(input.settings),
          quote: clone(input.quote),
          doc: clone(input.doc),
        });
        return clone(meta);
      },
      async updateMeta(id, patch) {
        const p = owned(id);
        if (!p) throw new Error('not found');
        Object.assign(p.meta, patch, { updatedAt: new Date().toISOString() });
      },
      async delete(id) {
        if (!owned(id)) return;
        control.projects.delete(id);
        control.marks.delete(id);
        await repos.files.removePrefix('backgrounds', `${me().userId}/${id}`);
      },
      async save(id, expectedVersion, doc, settings, quote) {
        control.saveCalls.push({ projectId: id, expectedVersion });
        await control.beforeSave?.(id);
        if (!session) throw new SaveError('auth_expired');
        const p = owned(id);
        if (!p) throw new SaveError('forbidden');
        if (p.meta.version !== expectedVersion) throw new SaveError('version_conflict');
        p.doc = clone(doc);
        p.settings = clone(settings);
        p.quote = clone(quote);
        p.meta.version += 1;
        p.meta.updatedAt = new Date().toISOString();
        return p.meta.version;
      },
    },

    profile: {
      async get() {
        const { quoteCounter: _counter, ...profile } = profileOf(me().userId);
        return clone(profile);
      },
      async update(patch) {
        Object.assign(profileOf(me().userId), clone(patch));
      },
      async nextQuoteNumber() {
        const p = profileOf(me().userId);
        p.quoteCounter += 1;
        return p.quoteCounter;
      },
    },

    catalog: {
      async list() {
        const userId = me().userId;
        return [...control.catalog.values()].filter((i) => i.ownerId === userId).map(clone);
      },
      async create(item) {
        const created: CatalogItem = {
          ...clone(item),
          id: crypto.randomUUID(),
          ownerId: me().userId,
        };
        control.catalog.set(created.id, created);
        return clone(created);
      },
      async update(id, patch) {
        const item = control.catalog.get(id);
        if (!item || item.ownerId !== me().userId) throw new Error('not found');
        Object.assign(item, clone(patch));
      },
    },

    purchases: {
      async list(projectId) {
        if (!owned(projectId)) return new Map();
        return new Map(control.marks.get(projectId) ?? []);
      },
      async set(projectId, lineKey, qty) {
        if (!owned(projectId)) throw new Error('forbidden');
        const marks = control.marks.get(projectId) ?? new Map();
        marks.set(lineKey, qty);
        control.marks.set(projectId, marks);
      },
    },

    files: {
      async upload(bucket, path, file) {
        checkPath(path);
        control.files.set(fileKey(bucket, path), file);
      },
      async download(bucket, path) {
        checkPath(path);
        const file = control.files.get(fileKey(bucket, path));
        if (!file) throw new Error('not found');
        return file;
      },
      async removePrefix(bucket, prefix) {
        checkPath(prefix);
        for (const key of [...control.files.keys()]) {
          if (key.startsWith(fileKey(bucket, `${prefix}/`))) control.files.delete(key);
        }
      },
    },
  };

  return { repos, control };
}
