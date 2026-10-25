// Integration tests against the local Supabase stack (pnpm test:db).
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { beforeAll, describe, expect, it } from 'vitest';
import demo from '../../../../../tests/fixtures/demo-project.json';
import { defaultProjectSettings, defaultQuoteSettings } from '@epd/domain/defaults';
import type { Database } from './database.types';

const url = process.env.VITE_SUPABASE_URL!;
const anonKey = process.env.VITE_SUPABASE_ANON_KEY!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

type Client = SupabaseClient<Database>;

const options = { auth: { persistSession: false, autoRefreshToken: false } };

async function newUser(): Promise<{ client: Client; id: string }> {
  const client = createClient<Database>(url, anonKey, options);
  const email = `test-${crypto.randomUUID()}@example.test`;
  const { data, error } = await client.auth.signUp({ email, password: 'test-password-1' });
  if (error || !data.user) throw error ?? new Error('no user');
  return { client, id: data.user.id };
}

async function newProject(client: Client) {
  const { data, error } = await client
    .from('projects')
    .insert({
      name: 'P',
      settings: defaultProjectSettings(),
      quote: { settings: defaultQuoteSettings(), issued: [] },
      doc: demo,
    })
    .select('id, version')
    .single();
  if (error) throw error;
  return data;
}

let a: { client: Client; id: string };
let b: { client: Client; id: string };
let bProject: { id: string; version: number };

beforeAll(async () => {
  a = await newUser();
  b = await newUser();
  bProject = await newProject(b.client);
});

describe('RLS (AC 17)', () => {
  // protects=project isolation; fails_when=user A can read or change user B's project; no_claim=UI routing
  it("user A cannot read or write user B's project", async () => {
    const read = await a.client.from('projects').select('id').eq('id', bProject.id);
    expect(read.data).toEqual([]);
    const update = await a.client
      .from('projects')
      .update({ name: 'x' })
      .eq('id', bProject.id)
      .select();
    expect(update.data).toEqual([]);
    const spoof = await a.client.from('projects').insert({
      owner_id: b.id,
      name: 'spoof',
      settings: {},
      quote: {},
      doc: {},
    });
    expect(spoof.error).not.toBeNull();
  });

  // protects=save RPC ownership check; fails_when=save_project writes another user's project; no_claim=—
  it("user A calling save_project on B's project is forbidden", async () => {
    const { error } = await a.client.rpc('save_project', {
      p_id: bProject.id,
      p_expected_version: bProject.version,
      p_doc: {},
      p_settings: {},
      p_quote: {},
    });
    expect(error?.code).toBe('42501');
  });

  // protects=catalog isolation; fails_when=user A sees user B's catalog items; no_claim=—
  it("user A cannot read user B's catalog items", async () => {
    const inserted = await b.client
      .from('catalog_items')
      .insert({ category: 'device', name: 'Secret', unit: 'pcs' })
      .select('id')
      .single();
    expect(inserted.error).toBeNull();
    const read = await a.client.from('catalog_items').select('id').eq('id', inserted.data!.id);
    expect(read.data).toEqual([]);
  });

  // protects=purchase mark isolation; fails_when=user A can tick lines of B's project; no_claim=—
  it("user A cannot read or write purchase marks of B's project", async () => {
    await b.client
      .from('purchase_marks')
      .insert({ project_id: bProject.id, line_key: 'k', purchased_qty: 1 });
    const read = await a.client.from('purchase_marks').select('*').eq('project_id', bProject.id);
    expect(read.data).toEqual([]);
    const write = await a.client
      .from('purchase_marks')
      .insert({ project_id: bProject.id, line_key: 'k2', purchased_qty: 1 });
    expect(write.error).not.toBeNull();
  });

  // protects=storage isolation; fails_when=user A reads or writes under user B's prefix; no_claim=size limits
  it("user A cannot read or write user B's backgrounds", async () => {
    const path = `${b.id}/${bProject.id}/bg.png`;
    const blob = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });
    expect((await b.client.storage.from('backgrounds').upload(path, blob)).error).toBeNull();
    expect((await a.client.storage.from('backgrounds').download(path)).error).not.toBeNull();
    const intrude = await a.client.storage
      .from('backgrounds')
      .upload(`${b.id}/${bProject.id}/x.png`, blob);
    expect(intrude.error).not.toBeNull();
    expect((await b.client.storage.from('backgrounds').download(path)).error).toBeNull();
  });
});

describe('save_project', () => {
  // protects=optimistic concurrency; fails_when=a stale version overwrites a newer save; no_claim=client retry logic
  it('returns the new version and raises version_conflict on a stale version', async () => {
    const project = await newProject(a.client);
    const args = {
      p_id: project.id,
      p_expected_version: project.version,
      p_doc: demo,
      p_settings: defaultProjectSettings(),
      p_quote: { settings: defaultQuoteSettings(), issued: [] },
    };
    const first = await a.client.rpc('save_project', args);
    expect(first.data).toBe(project.version + 1);
    const stale = await a.client.rpc('save_project', args);
    expect(stale.error?.message).toBe('version_conflict');
  });
});

describe('purchase marks', () => {
  // protects=AC 14 storage; fails_when=a second tick creates a duplicate instead of updating; no_claim=UI sync
  it('upserts purchased quantity per line', async () => {
    const project = await newProject(a.client);
    const upsert = (qty: number | null) =>
      a.client
        .from('purchase_marks')
        .upsert({ project_id: project.id, line_key: 'cable:2.5:brown', purchased_qty: qty });
    expect((await upsert(40)).error).toBeNull();
    expect((await upsert(52)).error).toBeNull();
    const { data } = await a.client
      .from('purchase_marks')
      .select('line_key, purchased_qty')
      .eq('project_id', project.id);
    expect(data).toEqual([{ line_key: 'cable:2.5:brown', purchased_qty: 52 }]);
  });

  // protects=cascade delete; fails_when=deleting a project leaves orphan marks; no_claim=storage cleanup
  it('deleting a project deletes its marks', async () => {
    const project = await newProject(a.client);
    await a.client
      .from('purchase_marks')
      .insert({ project_id: project.id, line_key: 'k', purchased_qty: 1 });
    expect((await a.client.from('projects').delete().eq('id', project.id)).error).toBeNull();
    const admin = createClient<Database>(url, serviceKey, options);
    const { count } = await admin
      .from('purchase_marks')
      .select('*', { count: 'exact', head: true })
      .eq('project_id', project.id);
    expect(count).toBe(0);
  });
});

describe('quote numbering', () => {
  // protects=per-account numbering; fails_when=numbers are shared across accounts or not incremented; no_claim=—
  it('next_quote_number counts per account', async () => {
    const u = await newUser();
    expect((await u.client.rpc('next_quote_number')).data).toBe(1);
    expect((await u.client.rpc('next_quote_number')).data).toBe(2);
  });

  // protects=quote numbers cannot be rewound; fails_when=a user can write quote_counter directly or can no longer edit the rest of the profile; no_claim=service-role access
  it('users cannot write quote_counter but can edit their profile', async () => {
    const u = await newUser();
    expect((await u.client.rpc('next_quote_number')).data).toBe(1);
    const rewind = await u.client.from('profiles').update({ quote_counter: 0 }).eq('user_id', u.id);
    expect(rewind.error?.code).toBe('42501');
    const edit = await u.client
      .from('profiles')
      .update({ business_name: 'Rossi Impianti' })
      .eq('user_id', u.id);
    expect(edit.error).toBeNull();
    expect((await u.client.rpc('next_quote_number')).data).toBe(2);
  });
});
