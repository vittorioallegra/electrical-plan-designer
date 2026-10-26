// Repository interfaces: the app's only view of persistence.
import type { CatalogItem } from '@epd/domain/catalog/types';
import type {
  BoxPreset,
  PriceOverrides,
  ProjectMeta,
  ProjectQuote,
  ProjectSettings,
} from '@epd/domain/types';

export interface Session {
  userId: string;
  email: string;
}

export type AuthErrorCode =
  'invalid_credentials' | 'email_taken' | 'weak_password' | 'network' | 'unknown';

export class AuthError extends Error {
  override name = 'AuthError';
  constructor(
    readonly code: AuthErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export interface AuthRepository {
  getSession(): Promise<Session | null>;
  /** Called on sign-in, sign-out and session expiry. Returns an unsubscribe function. */
  onChange(listener: (session: Session | null) => void): () => void;
  signUp(email: string, password: string): Promise<Session>;
  signIn(email: string, password: string): Promise<Session>;
  signOut(): Promise<void>;
}

export type SaveErrorCode =
  'version_conflict' | 'network' | 'auth_expired' | 'forbidden' | 'invalid_doc';

export class SaveError extends Error {
  override name = 'SaveError';
  constructor(
    readonly code: SaveErrorCode,
    message: string = code,
  ) {
    super(message);
  }
}

export interface ProjectRecord {
  meta: ProjectMeta;
  settings: ProjectSettings;
  quote: ProjectQuote;
  /** Unvalidated: the editor runs it through loadDoc. */
  rawDoc: unknown;
}

export interface NewProject {
  name: string;
  clientName: string;
  address: string;
  settings: ProjectSettings;
  quote: ProjectQuote;
  doc: unknown;
}

export interface ProjectRepository {
  list(): Promise<ProjectMeta[]>;
  get(id: string): Promise<ProjectRecord | null>;
  create(input: NewProject): Promise<ProjectMeta>;
  updateMeta(
    id: string,
    patch: Partial<Pick<ProjectMeta, 'name' | 'clientName' | 'address'>>,
  ): Promise<void>;
  /** Deletes the project, its purchase marks and its stored files. */
  delete(id: string): Promise<void>;
  /** Returns the new version. Throws SaveError. */
  save(
    id: string,
    expectedVersion: number,
    doc: unknown,
    settings: ProjectSettings,
    quote: ProjectQuote,
  ): Promise<number>;
}

export interface Profile {
  businessName: string;
  vatNumber: string;
  address: string;
  phone: string;
  email: string;
  logoPath: string | null;
  priceOverrides: PriceOverrides;
  boxPresets: BoxPreset[];
}

export type ProfilePatch = Partial<Omit<Profile, 'logoPath'>> & { logoPath?: string | null };

export interface ProfileRepository {
  get(): Promise<Profile>;
  update(patch: ProfilePatch): Promise<void>;
  nextQuoteNumber(): Promise<number>;
}

export type NewCatalogItem = Omit<CatalogItem, 'id'>;

export interface CatalogRepository {
  /** User items, archived ones included. */
  list(): Promise<CatalogItem[]>;
  create(item: NewCatalogItem): Promise<CatalogItem>;
  update(id: string, patch: Partial<NewCatalogItem>): Promise<void>;
}

export interface PurchaseRepository {
  list(projectId: string): Promise<Map<string, number | null>>;
  set(projectId: string, lineKey: string, purchasedQty: number | null): Promise<void>;
}

export type Bucket = 'backgrounds' | 'logos';

export interface FileRepository {
  upload(bucket: Bucket, path: string, file: Blob): Promise<void>;
  download(bucket: Bucket, path: string): Promise<Blob>;
  removePrefix(bucket: Bucket, prefix: string): Promise<void>;
}

export interface Repositories {
  auth: AuthRepository;
  projects: ProjectRepository;
  profile: ProfileRepository;
  catalog: CatalogRepository;
  purchases: PurchaseRepository;
  files: FileRepository;
}
