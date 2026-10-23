-- Run once daily at noon IST (06:30 GMT). Preserve the existing protected worker token.
-- Existing audit job ID: 1. Each eligible bill receives a separate worker request.
select cron.alter_job(
  job_id := 1,
  schedule := '30 6 * * *',
  command := $job$
    select net.http_post(
      url := 'https://tgnyngzbukegjadygmpt.supabase.co/functions/v1/audit-automation',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-audit-worker-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'audit_worker_secret')
      ),
      body := jsonb_build_object('dryRun', false, 'id', pending.id),
      timeout_milliseconds := 120000
    )
    from public.tally_entry pending
    where pending.actual1 is null
      or (lower(trim(coalesce(pending.status1, ''))) <> 'done'
        and pending.actual2 is not null
        and lower(trim(coalesce(pending.status2, ''))) = 'done'
        and pending.actual3 is null);
  $job$
);
