import * as E from "fp-ts/Either";
import { flow, pipe } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { ParserOptions } from "sql-parser-cst";
import { cli } from "./cli";
import { migrateUp } from "./migrate";
import {
  DbContext,
  MigrationsContext,
  OptionsCommon,
  Parameters,
} from "./types";

interface DbContextPromise extends Pick<DbContext, "now"> {
  parameters: (context: MigrationsContext) => Promise<Parameters>;
  select: <T>(sql: string) => Promise<T[]>;
  execute: (sql: string) => Promise<void>;
}

function dbContextPromiseAdapter({
  now,
  parameters,
  select,
  execute,
}: DbContextPromise): DbContext {
  return {
    now,
    parameters: TE.tryCatchK(parameters, E.toError),
    select: <T>(sql: string) => TE.tryCatch(() => select<T>(sql), E.toError),
    execute: TE.tryCatchK(execute, E.toError),
  };
}

interface OptionsCommonPromise
  extends Partial<MigrationsContext>,
    DbContextPromise,
    Pick<OptionsCommon, "name"> {
  end?: () => Promise<void>;
}

function optionsCommonPromiseAdapter({
  now,
  parameters,
  select,
  execute,
  end,
  ...options
}: OptionsCommonPromise): OptionsCommon {
  return {
    ...options,
    ...dbContextPromiseAdapter({ now, parameters, select, execute }),
    end: end ? flow(TE.tryCatchK(end, E.toError), T.asUnit) : end,
  };
}

export type OptionsPromise = OptionsCommonPromise & {
  version?: string;
  useVersioning?: boolean;
  force?: boolean;
};

export function cliPromise(
  { version, useVersioning, force, ...options }: OptionsPromise,
  parserOptions?: ParserOptions,
) {
  pipe(options, optionsCommonPromiseAdapter, (options) => {
    cli({ ...options, version, useVersioning, force }, parserOptions);
  });
}

export interface ContextPromise extends MigrationsContext, DbContextPromise {
  version?: string;
  useVersioning?: boolean;
  force?: boolean;
}

export async function migrateUpPromise(
  {
    now,
    parameters,
    select,
    execute,
    version,
    useVersioning,
    force,
    ...context
  }: ContextPromise,
  onMigrationApplied?: (fileName: string) => void,
) {
  const migrate = migrateUp(
    {
      ...context,
      ...dbContextPromiseAdapter({ now, parameters, select, execute }),
      version,
      useVersioning: useVersioning ?? false,
      force: force ?? false,
    },
    onMigrationApplied
      ? (fileName: string) =>
          IO.of(() => {
            onMigrationApplied(fileName);
          })
      : undefined,
  );
  const result = await migrate();

  if (E.isLeft(result)) {
    throw result.left;
  }

  return result.right;
}
