import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

export const Dependecies = "migrations.json";
export const RunOnce = "run-once";
export const RunAlways = "run-always";

export type Parameters = Record<string, string>;

export interface DbContext {
  parameters: (context: MigrationsContext) => TE.TaskEither<Error, Parameters>;
  select: <T>(sql: string) => TE.TaskEither<Error, T[]>;
  execute: (sql: string) => TE.TaskEither<Error, void>;
  now?: string;
}

export interface MigrationsContext {
  schema: string | null;
  folder: string | ((schema: MigrationsContext["schema"]) => string);
  table: string;
}

export interface OptionsUseVersioning {
  version: string;
  useVersioning: boolean;
  force: boolean;
}

export interface OptionsCommon extends Partial<MigrationsContext>, DbContext {
  name?: string;
  end?: () => T.Task<void>;
}

export type Options = OptionsCommon & Partial<OptionsUseVersioning>;

export interface ContextCommon
  extends MigrationsContext,
    Pick<Options, "version">,
    DbContext {}

export interface ContextUseVersioning
  extends MigrationsContext,
    OptionsUseVersioning,
    DbContext {}

export type Context = ContextCommon | ContextUseVersioning;

export function useVersioning(
  context: Context
): context is ContextUseVersioning {
  return "useVersioning" in context && context.useVersioning && !context.force;
}

export interface MigrationRow {
  name: string;
  created_at: string;
}

export interface MigrationError extends Error {
  file: string;
}
