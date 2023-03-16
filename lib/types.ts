export const RunOnce = "run-once";
export const RunAlways = "run-always";

export const RX_MIGRATION_FILES = /^\d+[-_].*\.sql$/;

export type Parameters = Record<string, string | undefined>;

export interface Options {
  name?: string;
  version?: string;
  table?: string;
  folder?: string;
  schema?: string;
  parameters: (context: MigrationsContext) => Promise<Parameters>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (sql: string, isSelect?: boolean) => Promise<any>;
  end: () => Promise<void>;
  now?: string;
}

export type MigrationsContext = {
  schema: string | null;
  folder: string;
  table: string;
};

export type RunContext = MigrationsContext &
  Pick<Options, "parameters" | "query" | "now">;

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
