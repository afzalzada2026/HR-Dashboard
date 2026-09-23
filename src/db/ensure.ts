import { pool } from "./index";

/**
 * Idempotent schema bootstrap mirroring src/db/schema.ts. Guarantees the tables exist even
 * in fresh environments where `drizzle-kit push` has not been executed yet.
 */
const DDL = `
CREATE TABLE IF NOT EXISTS datasets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size integer NOT NULL DEFAULT 0,
  row_count integer NOT NULL DEFAULT 0,
  column_count integer NOT NULL DEFAULT 0,
  mapping jsonb NOT NULL DEFAULT '{}'::jsonb,
  quality jsonb,
  source text NOT NULL DEFAULT 'upload',
  uploaded_by text NOT NULL,
  uploaded_role text NOT NULL,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS dataset_records (
  dataset_id uuid PRIMARY KEY,
  employees jsonb NOT NULL,
  CONSTRAINT dataset_records_dataset_id_datasets_id_fk FOREIGN KEY (dataset_id) REFERENCES datasets(id) ON DELETE CASCADE
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id serial PRIMARY KEY,
  action text NOT NULL,
  category text NOT NULL,
  details text NOT NULL DEFAULT '',
  user_name text NOT NULL,
  user_email text NOT NULL DEFAULT '',
  role text NOT NULL,
  ip text NOT NULL DEFAULT '',
  meta jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS audit_created_idx ON audit_logs (created_at);
CREATE TABLE IF NOT EXISTS scheduled_reports (
  id serial PRIMARY KEY,
  name text NOT NULL,
  frequency text NOT NULL,
  format text NOT NULL,
  recipients text NOT NULL DEFAULT '',
  sections jsonb NOT NULL DEFAULT '[]'::jsonb,
  time_of_day text NOT NULL DEFAULT '08:00',
  day_of_week integer NOT NULL DEFAULT 1,
  day_of_month integer NOT NULL DEFAULT 1,
  is_active boolean NOT NULL DEFAULT true,
  last_run_at timestamp with time zone,
  next_run_at timestamp with time zone,
  run_count integer NOT NULL DEFAULT 0,
  created_by text NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
`;

const g = globalThis as typeof globalThis & { __atomaSchemaReady?: Promise<void> };

export function ensureSchema(): Promise<void> {
  if (!g.__atomaSchemaReady) {
    g.__atomaSchemaReady = pool
      .query(DDL)
      .then(() => undefined)
      .catch((err) => {
        g.__atomaSchemaReady = undefined;
        throw err;
      });
  }
  return g.__atomaSchemaReady;
}
