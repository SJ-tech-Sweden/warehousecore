DO $$
DECLARE
  ref_col text := NULL;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    EXECUTE 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_code VARCHAR(16)';

    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'jobid') THEN
      ref_col := 'jobid';
    ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'id') THEN
      ref_col := 'id';
    END IF;

    IF ref_col IS NOT NULL THEN
      EXECUTE format(
        'UPDATE jobs SET job_code = ''JOB'' || LPAD((%I)::text, 6, ''0'') WHERE job_code IS NULL OR job_code = ''''''',
        ref_col
      );
    END IF;

    EXECUTE 'ALTER TABLE jobs ALTER COLUMN job_code TYPE VARCHAR(16)';
    EXECUTE 'ALTER TABLE jobs ALTER COLUMN job_code SET NOT NULL';
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_job_code ON jobs(job_code)';
  END IF;
END$$;
