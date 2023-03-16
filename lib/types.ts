export const RunOnce = "run-once";
export const RunAlways = "run-awlays";

export const RX_MIGRATION_FILES = /^\d+_.*\.sql$/;

export type Parameters = Record<string, string | undefined>;

export interface Options {
  name?: string;
  version?: string;
  table?: string;
  folder?: string;
  schema?: string;
  parameters: (context: MigrationsContext) => Promise<Parameters>;
  query: (sql: string) => Promise<unknown>;
  end: () => Promise<void>;
}

export type MigrationsContext = {
  schema: string;
  folder: string;
  table: string;
};

export type CreateMigrationContext = MigrationsContext & {
  runAlways?: boolean;
};

export type MigrationRow = {
  name: string;
  created_at: string;
};

export type MigrationError = Error & {
  file: string;
};
