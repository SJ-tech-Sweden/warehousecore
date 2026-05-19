DO $$
DECLARE
  id_column_name text;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'jobs') THEN
    EXECUTE 'ALTER TABLE jobs ADD COLUMN IF NOT EXISTS job_code VARCHAR(16)';

    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'jobs' AND table_schema = current_schema() AND column_name = 'jobid'
    ) THEN
      id_column_name := 'jobid';
    ELSIF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_name = 'jobs' AND table_schema = current_schema() AND column_name = 'id'
    ) THEN
      id_column_name := 'id';
    END IF;

    IF id_column_name IS NOT NULL THEN
      EXECUTE format(
        'UPDATE jobs SET job_code = ''JOB'' || LPAD((%I)::text, 6, ''0'') WHERE job_code IS NULL OR job_code = ''''''',
        id_column_name
      );
    ELSE
      RAISE WARNING 'Migration 013: jobs table missing jobid/id column in current schema; job_code backfill skipped';
    END IF;

    EXECUTE 'ALTER TABLE jobs ALTER COLUMN job_code TYPE VARCHAR(16)';

    IF EXISTS (
      SELECT 1
      FROM jobs
      WHERE COALESCE(TRIM(job_code), '') = ''
    ) THEN
      RAISE WARNING 'Migration 013: jobs.job_code still contains NULL/empty values; NOT NULL and unique index enforcement skipped';
    ELSIF EXISTS (
      SELECT 1
      FROM jobs
      GROUP BY job_code
      HAVING COUNT(*) > 1
    ) THEN
      RAISE WARNING 'Migration 013: jobs.job_code contains duplicate values; unique enforcement skipped';
    ELSE
      EXECUTE 'ALTER TABLE jobs ALTER COLUMN job_code SET NOT NULL';
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS ux_jobs_job_code ON jobs(job_code)';
    END IF;
  END IF;
END$$;
