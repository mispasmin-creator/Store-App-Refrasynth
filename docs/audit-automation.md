# Audit Data automation

Rectify and Tally Entry are manual on the Audit Data page. The server worker handles Audit, Reaudit and the existing final Again Audit. The other application pages are outside this change.

## Backend configuration

The app uses the existing Supabase project. Versioned AI reports use the existing remarks columns and manual voucher metadata uses remarks4. Existing plain-text remarks still display.

The worker now uses the **OpenAI Responses API**, with PDF/image input, strict JSON schema extraction and store=false. The default model is gpt-5.4-mini; the protected backend config can select another compatible model. The only user-supplied secret required is **OPENAI_API_KEY**, saved under Supabase Edge Functions ? Secrets. The API key is never sent to the browser or written to this repository.

## Protected worker configuration

Apply supabase/audit-automation-setup.sql through a Supabase migration. This creates:

- pg_cron and pg_net extensions for scheduled backend requests.
- A singleton public.audit_automation_config table, with RLS and all browser access revoked; only service_role may SELECT it.
- A random 32-byte worker token in Supabase Vault. Only its SHA-256 hash is stored in the config table. The plaintext token is used exclusively inside database-side HTTP requests.
- Processing disabled by default. The migration does not change accounting records or start a schedule.

Supabase supplies SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to hosted functions. The function performs its own worker-token authentication; platform JWT verification is disabled only for this endpoint. For local tests, AUDIT_WORKER_SECRET, AUDIT_AI_MODEL and AUDIT_AUTOMATION_ENABLED environment overrides remain supported. An explicit AUDIT_AUTOMATION_ENABLED=false always pauses writes.

GET /functions/v1/audit-automation reports only configured/enabled booleans. This confirms configuration presence, not API billing or schedule health. POST requires x-audit-worker-secret. Its default body is a dry run, permitted while automation is paused. A dry run still sends invoice documents to OpenAI and incurs API usage, but performs no accounting database writes.

To test without exposing any secret, execute in the project's SQL editor:

```sql
select net.http_post(
  url := 'https://YOUR_PROJECT.supabase.co/functions/v1/audit-automation',
  headers := jsonb_build_object('Content-Type','application/json',
    'x-audit-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='audit_worker_secret')),
  body := '{"dryRun":true}'::jsonb,
  timeout_milliseconds := 120000
);
```

Read the result from net._http_response using the returned request ID. Check that document extraction succeeds before enabling processing. Insufficient API quota or a rejected key keeps the worker paused until billing/secrets are fixed.

## Schedule activation

After a successful technical trial, enable the config and schedule a POST every minute. Replace YOUR_PROJECT with the existing Supabase project reference:

```sql
update public.audit_automation_config set enabled=true, updated_at=now() where id=1;
select cron.schedule('audit-data-ai-every-minute', '* * * * *', $$
  select net.http_post(
    url := 'https://YOUR_PROJECT.supabase.co/functions/v1/audit-automation',
    headers := jsonb_build_object('Content-Type','application/json',
      'x-audit-worker-secret',(select decrypted_secret from vault.decrypted_secrets where name='audit_worker_secret')),
    body := '{"dryRun":false}'::jsonb,
    timeout_milliseconds := 120000
  );
$$);
```

To pause, set enabled=false in public.audit_automation_config and deactivate the cron job. Each invocation processes at most one eligible record, paging through historical/manual records in batches of 100 so a later pending bill is not hidden by an arbitrary row limit. Conditional claims prevent concurrent workers from committing the same snapshot; source data is rechecked after inference before committing. Changed credentials/models trigger a fresh retry fingerprint, and exhausted transient failures can retry after a one-hour cooldown.

## What is checked

- Supplier invoice facts are extracted from the actual bill PDF/image; PO and receipt data are loaded server-side, scoped to firm and document identity.
- Company, vendor, invoice number, gross total, product, unit rate, ordered/received quantities, physical check, HOD approval and duplicate invoice identity must pass deterministic checks.
- Tax-inclusive invoice total is compared to the recorded gross bill amount, not quantity × unit price. This version does not independently calculate GST/TDS or certify tax compliance.
- Exact normalized product/company/vendor names are required. Ambiguous aliases or multiple matching lines are held for source correction.
- Physical-check legacy column `damage_order=Yes` means **good** in this app.
- Rectify is human-only. The AI worker skips it without extracting documents or writing corrections. Humans can correct bill number, bill amount, quantity and rate, optionally replace the bill attachment, and add correction remarks. Saving submits the record to a fresh AI Reaudit. PO/receipt issues must be corrected in their source screens.
- Failed Audit or Reaudit sends the record to human Rectify. Updating the underlying source record/document changes the fingerprint and permits another check. Provider failures retry with backoff, up to three attempts for unchanged inputs.
- Only a passed Reaudit can release a previously failed audit to Tally Entry. A final audit requires both a completion timestamp and passed status to appear Completed.

## Manual Tally Entry and final verification

Enter Tally manually, then save the voucher number, posting date, remarks and actual voucher PDF/image on Audit Data. Each product record is submitted separately to avoid advancing unrelated invoices together. One multi-product voucher can be reused for its individual records.

The worker extracts the voucher and compares the voucher number/date, company, supplier invoice, vendor, gross amount, products, quantities and rates with the approved source. A voucher mismatch sends the row back to manual Tally Entry. Missing/unreadable proof remains pending. The worker does not connect to or post into Tally; final verification establishes agreement with the uploaded proof, not independent confirmation from the Tally database.

Documents must be PDF, JPEG, PNG or WebP up to 5 MB and uploaded to this project's existing `images` bucket. External URLs, redirects and other hosts are refused to prevent arbitrary server-side fetching. Voucher files use unique immutable `tally-vouchers/` paths. The bucket follows the app's existing public-document access model; use private storage and authenticated uploads before handling documents requiring private access. The current application uses custom login rather than Supabase Auth; this change does not overhaul its existing database/storage authorization.

Reports preserve the immediately preceding report and record corrections with before/after values. They are operational history, not a tamper-proof accounting log. For regulated retention, add an append-only audit event table and server-side authorization.

## Local verification

```powershell
npm.cmd run test:audit
node_modules/.bin/tsc.cmd --noEmit --target ES2022 --module esnext --moduleResolution bundler --allowImportingTsExtensions --lib ES2022,DOM --skipLibCheck supabase/functions/deno.d.ts supabase/functions/audit-automation/index.ts
npm.cmd run build
```

References: [Supabase scheduling](https://supabase.com/docs/guides/functions/schedule-functions), [backend secrets](https://supabase.com/docs/guides/functions/secrets), [OpenAI file inputs](https://developers.openai.com/api/docs/guides/file-inputs).

## Verified OpenAI activation — 21 October 2026

- OpenAI key was confirmed through real document extraction, without reading or displaying the saved key.
- Both a dry run and a live audit returned HTTP 200. The audited pending bill failed six deterministic source checks and was held in Rectify with its AI report saved; it was not released to Tally.
- The protected database configuration is enabled. The `audit-data-ai-every-minute` cron job is active, scheduled once per minute.
- Anonymous and authenticated browser roles have no SELECT permission on the worker config; service_role does. The plaintext worker token stays in Vault.
- Local regression checks cover OpenAI request format, paused dry runs, token-hash authentication, source changes during inference, and the existing workflow safeguards.

The project security advisor also reported pre-existing [RLS-disabled tables](https://supabase.com/docs/guides/database/database-linter?lint=0013_rls_disabled_in_public) and [mutable function search paths](https://supabase.com/docs/guides/database/database-linter?lint=0011_function_search_path_mutable). This activation did not alter the application's existing custom-login data-access rules. The new config table deliberately denies browser access via revoked privileges and RLS with no browser policies.

## Human Rectify update


Flow: AI Audit -> Human Rectify -> AI Reaudit -> Human Tally Entry. A failed Reaudit returns to human Rectify. AI remarks display only failed checks, numbered one per line with concise observed/expected values; successful audits say "All checks passed." Full structured check data remains in the saved audit report. Existing final voucher verification remains unchanged.

## Current remark ownership and language

AI Audit writes only remarks1 (Audit Remarks); AI Reaudit writes only remarks3 (Reaudit Remarks). Rectify remarks2 and Tally Entry remarks4 are human-only. The existing final Again Audit writes only remarks5. Worker transitions reject human stages and mismatched report stages. AI remarks are concise English, numbered by failed check. Legacy AI-only Rectify remarks on uncompleted rectifications were removed, preserving any previous human text. Existing AI reports were restored to English without changing audit outcomes or business data.

## Partial lifting and separate bills

Each lifting has a separate invoice. Audit matches that invoice to its own firm/PO/product/lift/indent receipt, including the receipt bill number. It compares invoice quantity with the current received quantity and invoice gross amount with the current bill amount; it does not require a partial invoice to equal the entire PO.

All active liftings for the same firm/PO/product are summed against the ordered quantity. For PO 100, lifts 30 and 20 leave 50 pending. Cancelled liftings are excluded, duplicate source IDs are counted once, and all source pages are loaded. Lifted quantity determines the PO balance; a received shortage remains a separate failed check. Overlifting is flagged. Successful English remarks include a concise lifting/total/pending summary.
