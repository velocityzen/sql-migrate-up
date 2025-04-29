import * as AP from "fp-ts/Apply";
import * as E from "fp-ts/Either";
import * as IO from "fp-ts/IO";
import * as O from "fp-ts/Option";
import * as TE from "fp-ts/TaskEither";
import { constVoid, pipe, flow } from "fp-ts/function";

import { getTable } from "./helpers";
import {
  applyMigrationsWith,
  filterCompletedFor,
  getAllMigrations,
  getMigrationsPath,
  queryCompletedMigrations,
} from "./migrations";
import { Context, ContextUseVersioning, useVersioning } from "./types";

export function migrateUp(
  context: Context,
  onMigrationApplied?: (fileName: string) => IO.IO<void>,
): TE.TaskEither<Error, number> {
  if (useVersioning(context) && !context.version) {
    return TE.left(
      Error("useVersioning is set to true, but version is not defined"),
    );
  }

  return pipe(
    TE.of(context),
    TE.tap(ensureSchemaExists),
    TE.tap(ensureMigrationsTableExists),
    TE.bind("migrations", getMigrationsToRun),
    TE.bind("totalMigrationsApplied", (context) =>
      pipe(
        context.migrations,
        O.match(
          () => TE.of(0),
          applyMigrationsWith(context, onMigrationApplied),
        ),
      ),
    ),
    TE.tap(
      flow(
        O.fromPredicate((context) => context.totalMigrationsApplied > 0),
        O.flatMap(O.fromPredicate(useVersioning)),
        // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
        O.match(() => TE.right(constVoid()), saveVersion),
      ),
    ),
    TE.map(({ totalMigrationsApplied }) => totalMigrationsApplied),
  );
}

function ensureSchemaExists({
  execute,
  schema,
}: Context): TE.TaskEither<Error, void> {
  return pipe(
    schema,
    O.fromNullable,
    O.match(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      () => TE.of(constVoid()),
      (schema) => execute(`create schema if not exists ${schema};`),
    ),
  );
}

function ensureMigrationsTableExists({
  execute,
  schema,
  table,
}: Context): TE.TaskEither<Error, void> {
  return execute(`
    create table if not exists ${getTable(schema, table)} (
      name text not null,
      created_at timestamp not null
    );
  `);
}

function saveVersion({
  execute,
  schema,
  table,
  version,
  now,
}: ContextUseVersioning): TE.TaskEither<Error, void> {
  return execute(`
    insert into ${getTable(schema, table)}
    values ('version-${version}', ${now ?? "CURRENT_TIMESTAMP"});
  `);
}

function getMigrationsToRun(context: Context) {
  const applyParTE = AP.sequenceS(TE.ApplyPar);

  return pipe(
    applyParTE({
      migrations: getAllMigrations(context),
      completed: queryCompletedMigrations(context),
    }),
    TE.flatMapEither(({ migrations, completed }) =>
      pipe(
        migrations,
        O.match(
          () =>
            E.left(
              Error(`No migrations found at "${getMigrationsPath(context)}"`),
            ),
          (migrations) => E.right({ migrations, completed }),
        ),
      ),
    ),
    TE.map(({ migrations, completed }) =>
      pipe(
        completed,
        O.match(
          () => O.some(migrations), // if there is nothing completed just return everything
          filterCompletedFor(context, migrations),
        ),
      ),
    ),
  );
}
