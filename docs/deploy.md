# Deploying to a Supabase cloud project

Development runs on the local Supabase stack. When a cloud project is needed:

1. Create the project in the Supabase dashboard (region close to users) and note the
   project ref, API URL and anon key.
2. Link and push the schema:
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref>
   pnpm exec supabase db push
   ```
   `db push` applies `supabase/migrations/*.sql` (tables, RLS, RPCs, private buckets).
   Never run `supabase/seed.sql` against the cloud: it creates a dev user with a known password.
3. Auth settings (dashboard → Authentication):
   - Site URL: the production app URL; add it (and preview URLs) to Redirect URLs.
   - Email confirmations: on. Configure custom SMTP (the built-in sender is rate-limited).
4. Regenerate types against the remote schema and check there is no drift:
   ```bash
   pnpm exec supabase gen types typescript --linked > src/data/database.types.ts
   ```
5. Build the app with `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` of the cloud project
   (`VITE_DATA_MODE=supabase`, `VITE_E2E` unset) and host `dist/` as a static SPA with a
   fallback to `index.html`.
