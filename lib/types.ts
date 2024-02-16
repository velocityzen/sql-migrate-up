export const Dependecies = "migrations.json";
export const RunOnce = "run-once";
export const RunAlways = "run-always";

export type Parameters = Record<string, string | undefined>;

export type MigrationsContext = {
  schema: string | null;
  folder: string | ((schema: MigrationsContext["schema"]) => string);
  table: string;
};

interface OptionsUseVersioning {
  version: string;
  useVersioning: true;
  force: boolean;
}

interface OptionsVersion {
  version?: string;
}

interface OptionsCommon extends Partial<MigrationsContext> {
  name?: string;
  parameters: (context: MigrationsContext) => Promise<Parameters>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  query: (sql: string, isSelect?: boolean) => Promise<any>;
  end?: () => Promise<void>;
  now?: string;
}

export type Options = OptionsCommon & (OptionsVersion | OptionsUseVersioning);

export type RunContextCommon = MigrationsContext &
  OptionsVersion &
  Pick<Options, "parameters" | "query" | "now">;

export type RunContextUseVersioning = MigrationsContext &
  OptionsUseVersioning &
  Pick<Options, "parameters" | "query" | "now">;

export type RunContext = RunContextCommon | RunContextUseVersioning;

export function doUseVersioning(
  context: RunContext,
): context is RunContextUseVersioning {
  return (
    "useVersioning" in context &&
    context.useVersioning === true &&
    context.force !== true
  );
}

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
