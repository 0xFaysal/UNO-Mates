-- The admin session is never kept alive by polling. Expired sessions and rate-limit
-- windows are disposable; anonymous daily match counters intentionally remain.
SELECT cron.schedule('uno-admin-maintenance','47 * * * *',$job$
 DELETE FROM uno_private.admin_sessions WHERE expires_at<=now();
 DELETE FROM uno_private.admin_attempts WHERE window_start<now()-interval '1 day';
 DELETE FROM cron.job_run_details WHERE jobid IN
  (SELECT jobid FROM cron.job WHERE jobname='uno-admin-maintenance') AND end_time<now()-interval '7 days';
$job$);
