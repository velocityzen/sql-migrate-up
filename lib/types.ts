export const RunOnce = "run-once";
export const RunAlways = "run-awlays";

export const RX_MIGRATION_FILES = /^\d+_.*\.sql$/;

export type MigrationData = Record<string, string | undefined>;

export type ApplyData = (context: MigrationsContext) => Promise<MigrationData>;

export interface Options {
  name?: string;
  version?: string;
  table?: string;
  folder?: string;
  schema?: string;
  applyData: ApplyData;
  runSQL: (sql: string) => Promise<unknown>;
  finally: () => Promise<void>;
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
