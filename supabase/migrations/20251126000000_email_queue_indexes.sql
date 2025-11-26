-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status_created_at ON jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_jobs_attempts ON jobs(attempts);
CREATE INDEX IF NOT EXISTS idx_jobs_status_pending ON jobs(status) WHERE status = 'pending';

-- Enable pg_net extension
CREATE EXTENSION IF NOT EXISTS "pg_net";

-- Create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION notify_new_job()
RETURNS TRIGGER AS $$
DECLARE
  edge_function_url text;
  service_role_key text;
  is_production boolean;
BEGIN
  -- Detect if we're in production by checking if the database host contains 'supabase'
  -- In local development, use localhost URL
  -- In production, use hardcoded Supabase project URL
  is_production := current_database() = 'postgres' AND current_setting('server_version_num')::int > 0;

  -- Check if we're running in local Supabase (dev) or production
  -- Local: use docker host
  -- Production: use actual Supabase project URL
  IF current_setting('app.settings.edge_function_url', true) IS NOT NULL THEN
    -- If custom setting exists, use it
    edge_function_url := current_setting('app.settings.edge_function_url', true);
    service_role_key := current_setting('app.settings.service_role_key', true);
  ELSE
    -- Otherwise use hardcoded values
    -- For local development
    IF NOT is_production THEN
      edge_function_url := 'http://host.docker.internal:54321/functions/v1';
      service_role_key := 'anon_key_placeholder';
    ELSE
      -- For production - hardcoded project URL
      edge_function_url := 'https://wdtjhxxqgwobalxizlic.supabase.co/functions/v1';
      service_role_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndkdGpoeHhxZ3dvYmFseGl6bGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2MzUxMDI4NCwiZXhwIjoyMDc5MDg2Mjg0fQ.lDP7m6wh_-dUJ3lIPiw9TrPUDBSunVo0Sx2r2dqPUCs';
    END IF;
  END IF;

  PERFORM
    net.http_post(
      url := edge_function_url || '/process-job',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_role_key
      ),
      body := jsonb_build_object('record', row_to_json(NEW))
    );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger
DROP TRIGGER IF EXISTS on_job_inserted ON jobs;
CREATE TRIGGER on_job_inserted
AFTER INSERT ON jobs
FOR EACH ROW
WHEN (NEW.status = 'pending')
EXECUTE FUNCTION notify_new_job();
