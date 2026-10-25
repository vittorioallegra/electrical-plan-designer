// Supabase repositories. The only module that talks to Supabase.
import {
  createClient,
  type PostgrestError,
  type Session as SupabaseSession,
  type SupabaseClient,
} from '@supabase/supabase-js';
import type { CatalogItem } from '@/domain/catalog/types';
import {
  boxPresetSchema,
  priceOverridesSchema,
  projectQuoteSchema,
  projectSettingsSchema,
} from '@/domain/schema';
import type { ProjectMeta } from '@/domain/types';
import type { Database, Json } from './database.types';
import {
  AuthError,
  SaveError,
  type NewCatalogItem,
  type Profile,
  type Repositories,
  type Session,
} from './types';

type Client = SupabaseClient<Database>;
type JsonValue = NonNullable<Json>;
type ProjectRow = Database['public']['Tables']['projects']['Row'];
type CatalogRow = Database['public']['Tables']['catalog_items']['Row'];

const toSession = (s: SupabaseSession | null): Session | null =>
  s ? { userId: s.user.id, email: s.user.email ?? '' } : null;

const toMeta = (
  row: Pick<ProjectRow, 'id' | 'name' | 'client_name' | 'address' | 'updated_at' | 'version'>,
): ProjectMeta => ({
  id: row.id,
  name: row.name,
  clientName: row.client_name,
  address: row.address,
  updatedAt: row.updated_at,
  version: row.version,
});

const toItem = (row: CatalogRow): CatalogItem => ({
  id: row.id,
  ownerId: row.owner_id,
  category: row.category as CatalogItem['category'],
  name: row.name,
  ...(row.code ? { code: row.code } : {}),
  ...(row.unit_price !== null ? { unitPrice: row.unit_price } : {}),
  unit: row.unit as CatalogItem['unit'],
  ...(row.modules !== null ? { modules: row.modules } : {}),
  attributes: (row.attributes ?? {}) as CatalogItem['attributes'],
  archived: row.archived,
});

const fromItem = (item: Partial<NewCatalogItem>) => ({
  ...(item.category !== undefined ? { category: item.category } : {}),
  ...(item.name !== undefined ? { name: item.name } : {}),
  ...('code' in item ? { code: item.code ?? null } : {}),
  ...('unitPrice' in item ? { unit_price: item.unitPrice ?? null } : {}),
  ...(item.unit !== undefined ? { unit: item.unit } : {}),
  ...('modules' in item ? { modules: item.modules ?? null } : {}),
  ...(item.attributes !== undefined ? { attributes: item.attributes as JsonValue } : {}),
  ...(item.archived !== undefined ? { archived: item.archived } : {}),
});

function check(error: PostgrestError | null): void {
  if (error) throw new Error(`${error.code}: ${error.message}`);
}

function toSaveError(error: PostgrestError | Error): SaveError {
  const e = error as Partial<PostgrestError> & Error;
  if (e.message === 'version_conflict') return new SaveError('version_conflict');
  if (e.code === '42501') return new SaveError('forbidden');
  if (e.code === 'PGRST301' || e.code === 'PGRST303' || /jwt/i.test(e.message)) {
    return new SaveError('auth_expired');
  }
  if (e.code === '22P02' || e.code === '23502' || e.code === '23514') {
    return new SaveError('invalid_doc', e.message);
  }
  return new SaveError('network', e.message);
}

function toAuthError(error: {
  message: string;
  code?: string | undefined;
  status?: number | undefined;
}): AuthError {
  const code = error.code ?? '';
  if (code === 'invalid_credentials' || /invalid login/i.test(error.message)) {
    return new AuthError('invalid_credentials');
  }
  if (code === 'user_already_exists' || /already registered/i.test(error.message)) {
    return new AuthError('email_taken');
  }
  if (code === 'weak_password' || /password/i.test(error.message)) {
    return new AuthError('weak_password', error.message);
  }
  if (!error.status) return new AuthError('network', error.message);
  return new AuthError('unknown', error.message);
}

export function createSupabaseRepositories(
  url: string,
  anonKey: string,
  client?: Client,
): Repositories {
  const sb: Client = client ?? createClient<Database>(url, anonKey);
  const userId = async () => {
    const { data } = await sb.auth.getSession();
    const id = data.session?.user.id;
    if (!id) throw new SaveError('auth_expired');
    return id;
  };

  const repos: Repositories = {
    auth: {
      async getSession() {
        return toSession((await sb.auth.getSession()).data.session);
      },
      onChange(listener) {
        const { data } = sb.auth.onAuthStateChange((_event, s) => listener(toSession(s)));
        return () => data.subscription.unsubscribe();
      },
      async signUp(email, password) {
        const { data, error } = await sb.auth.signUp({ email, password });
        if (error) throw toAuthError(error);
        const s = toSession(data.session);
        if (!s) throw new AuthError('unknown', 'email confirmation required');
        return s;
      },
      async signIn(email, password) {
        const { data, error } = await sb.auth.signInWithPassword({ email, password });
        if (error) throw toAuthError(error);
        return toSession(data.session)!;
      },
      async signOut() {
        await sb.auth.signOut();
      },
    },

    projects: {
      async list() {
        const { data, error } = await sb
          .from('projects')
          .select('id, name, client_name, address, updated_at, version')
          .order('updated_at', { ascending: false });
        check(error);
        return (data ?? []).map(toMeta);
      },
      async get(id) {
        const { data, error } = await sb.from('projects').select('*').eq('id', id).maybeSingle();
        check(error);
        if (!data) return null;
        return {
          meta: toMeta(data),
          settings: projectSettingsSchema.parse(data.settings),
          quote: projectQuoteSchema.parse(data.quote),
          rawDoc: data.doc,
        };
      },
      async create(input) {
        const { data, error } = await sb
          .from('projects')
          .insert({
            name: input.name,
            client_name: input.clientName,
            address: input.address,
            settings: input.settings as JsonValue,
            quote: input.quote as JsonValue,
            doc: input.doc as JsonValue,
          })
          .select('id, name, client_name, address, updated_at, version')
          .single();
        check(error);
        return toMeta(data!);
      },
      async updateMeta(id, patch) {
        const { error } = await sb
          .from('projects')
          .update({
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.clientName !== undefined ? { client_name: patch.clientName } : {}),
            ...(patch.address !== undefined ? { address: patch.address } : {}),
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        check(error);
      },
      async delete(id) {
        await repos.files.removePrefix('backgrounds', `${await userId()}/${id}`);
        const { error } = await sb.from('projects').delete().eq('id', id);
        check(error);
      },
      async save(id, expectedVersion, doc, settings, quote) {
        let result;
        try {
          result = await sb.rpc('save_project', {
            p_id: id,
            p_expected_version: expectedVersion,
            p_doc: doc as JsonValue,
            p_settings: settings as JsonValue,
            p_quote: quote as JsonValue,
          });
        } catch (e) {
          throw new SaveError('network', (e as Error).message);
        }
        if (result.error) throw toSaveError(result.error);
        return result.data;
      },
    },

    profile: {
      async get() {
        const { data, error } = await sb
          .from('profiles')
          .select('*')
          .eq('user_id', await userId())
          .single();
        check(error);
        const row = data!;
        const profile: Profile = {
          businessName: row.business_name,
          vatNumber: row.vat_number,
          address: row.address,
          phone: row.phone,
          email: row.email,
          logoPath: row.logo_path,
          priceOverrides: priceOverridesSchema.catch({}).parse(row.price_overrides),
          boxPresets: boxPresetSchema.array().catch([]).parse(row.box_presets),
        };
        return profile;
      },
      async update(patch) {
        const { error } = await sb
          .from('profiles')
          .update({
            ...(patch.businessName !== undefined ? { business_name: patch.businessName } : {}),
            ...(patch.vatNumber !== undefined ? { vat_number: patch.vatNumber } : {}),
            ...(patch.address !== undefined ? { address: patch.address } : {}),
            ...(patch.phone !== undefined ? { phone: patch.phone } : {}),
            ...(patch.email !== undefined ? { email: patch.email } : {}),
            ...('logoPath' in patch ? { logo_path: patch.logoPath ?? null } : {}),
            ...(patch.priceOverrides !== undefined
              ? { price_overrides: patch.priceOverrides as JsonValue }
              : {}),
            ...(patch.boxPresets !== undefined
              ? { box_presets: patch.boxPresets as JsonValue }
              : {}),
          })
          .eq('user_id', await userId());
        check(error);
      },
      async nextQuoteNumber() {
        const { data, error } = await sb.rpc('next_quote_number');
        check(error);
        return data!;
      },
    },

    catalog: {
      async list() {
        const { data, error } = await sb.from('catalog_items').select('*').order('name');
        check(error);
        return (data ?? []).map(toItem);
      },
      async create(item) {
        const { data, error } = await sb
          .from('catalog_items')
          .insert({ ...fromItem(item), category: item.category, name: item.name, unit: item.unit })
          .select('*')
          .single();
        check(error);
        return toItem(data!);
      },
      async update(id, patch) {
        const { error } = await sb.from('catalog_items').update(fromItem(patch)).eq('id', id);
        check(error);
      },
    },

    purchases: {
      async list(projectId) {
        const { data, error } = await sb
          .from('purchase_marks')
          .select('line_key, purchased_qty')
          .eq('project_id', projectId);
        check(error);
        return new Map((data ?? []).map((r) => [r.line_key, r.purchased_qty]));
      },
      async set(projectId, lineKey, purchasedQty) {
        const { error } = await sb
          .from('purchase_marks')
          .upsert({ project_id: projectId, line_key: lineKey, purchased_qty: purchasedQty });
        check(error);
      },
    },

    files: {
      async upload(bucket, path, file) {
        const { error } = await sb.storage.from(bucket).upload(path, file, { upsert: true });
        if (error) throw error;
      },
      async download(bucket, path) {
        const { data, error } = await sb.storage.from(bucket).download(path);
        if (error) throw error;
        return data;
      },
      async removePrefix(bucket, prefix) {
        const { data, error } = await sb.storage.from(bucket).list(prefix, { limit: 1000 });
        if (error) throw error;
        const paths = (data ?? []).map((f) => `${prefix}/${f.name}`);
        if (paths.length > 0) {
          const removed = await sb.storage.from(bucket).remove(paths);
          if (removed.error) throw removed.error;
        }
      },
    },
  };
  return repos;
}
