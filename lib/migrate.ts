import fs from "fs/promises";

import * as AP from "fp-ts/Apply";
import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as TE from "fp-ts/TaskEither";
import { pipe, identity, constNull } from "fp-ts/function";

import {
  MigrationRow,
  Parameters,
  RunContext,
  RunContextUseVersioning,
  doUseVersioning,
} from "./types";

import {
  filterCompleted,
  getAllMigrations,
  getDbMigrationsFiles,
  hasMigrations,
} from "./migrations";
import { createMigrationError, getTable } from "./helpers";

export async function runMigrations(
  context: RunContext,
  onMigrationApplied?: (fileName: string) => void | Promise<void>,
): Promise<number> {
  if (doUseVersioning(context) && !context.version) {
    throw new Error("useVersioning is set to true, but version is not defined");
  }

  await ensureSchemaAndMigrationTable(context);

  const getMigrations = pipe(
    context,
    getNewMigrations,
    TE.match(
      (error) => {
        throw error;
      },
      O.match(constNull, identity),
    ),
  );

  const migrations = await getMigrations();
  if (!migrations || migrations.length === 0) {
    return 0;
  }

  const migrationData = await context.parameters(context);

  let total = 0;
  for await (const m of migrations) {
    const { once, always } = m;

    for await (const migrationFile of once) {
      await runMigration(context, migrationFile, migrationData);
      total++;
      if (onMigrationApplied) {
        await onMigrationApplied(migrationFile);
      }
    }

    for await (const migrationFile of always) {
      await runMigration(context, migrationFile, migrationData, false);
      total++;
      if (onMigrationApplied) {
        await onMigrationApplied(migrationFile);
      }
    }
  }

  if (doUseVersioning(context)) {
    await saveVersion(context);
  }

  return total;
}

async function runMigration(
  { schema, table, query, now }: RunContext,
  migrationFile: string,
  data: Parameters,
  saveMigration = true,
) {
  try {
    const migrationSql = await loadMigration(migrationFile, data);
    await query(migrationSql);

    if (saveMigration) {
      await query(`insert into
        ${getTable(schema, table)}
        values ('${migrationFile}', ${now ? now : "CURRENT_TIMESTAMP"});
      `);
    }
  } catch (e) {
    if (!(e instanceof Error)) {
      throw e;
    }

    const error = createMigrationError(migrationFile, e);
    throw error;
  }
}

async function loadMigration(
  migrationFile: string,
  data: Parameters,
): Promise<string> {
  const templateSql = await fs.readFile(migrationFile, "utf8");

  const sql = Array.from(Object.entries(data)).reduce(
    (sql, [key, value]) => (value ? sql.replaceAll(`{{${key}}}`, value) : sql),
    templateSql,
  );

  const extraParameters = Array.from(sql.matchAll(/{{([-a-zA-Z0-9_]+)}}/gi));
  if (extraParameters.length > 0) {
    const extraNames = extraParameters.map((tuple) => tuple[1]);
    throw new Error(
      `Found extra paramters ${extraNames.join(",")} in ${migrationFile}`,
    );
  }

  return sql;
}

function getNewMigrations(context: RunContext) {
  const getTogether = AP.sequenceT(TE.ApplyPar);

  return pipe(
    getTogether(getCompletedMigrations(context), getAllMigrations(context)),
    TE.map(([rows, migrations]) =>
      pipe(
        getDbMigrationsFiles(rows, context),
        O.map((completed) =>
          pipe(
            migrations,
            RA.map(filterCompleted(completed)),
            RA.filter(hasMigrations),
          ),
        ),
      ),
    ),
  );
}

export async function getCompletedMigrationsPromise({
  query,
  schema,
  table,
}: RunContext): Promise<MigrationRow[]> {
  const migrations = (await query(
    `
    select
      name as "name",
      created_at as "created_at"
    from ${getTable(schema, table)}
    order by created_at, name;
  `,
    true,
  )) as MigrationRow[];

  return migrations ?? [];
}

const getCompletedMigrations = TE.tryCatchK(
  getCompletedMigrationsPromise,
  E.toError,
);

async function ensureSchemaAndMigrationTable(context: RunContext) {
  await ensureSchemaExists(context);
  await ensureMigrationsTableExists(context);
}

async function ensureSchemaExists({
  query,
  schema,
}: RunContext): Promise<void> {
  if (schema === null) {
    return;
  }

  await query(`create schema if not exists ${schema};`);
}

async function ensureMigrationsTableExists({
  query,
  schema,
  table,
}: RunContext): Promise<void> {
  await query(`create table if not exists ${getTable(schema, table)} (
    name text not null,
    created_at timestamp not null
  );`);
}

async function saveVersion({
  query,
  schema,
  table,
  version,
  now,
}: RunContextUseVersioning) {
  await query(`insert into
    ${getTable(schema, table)}
    values ('version-${version}', ${now ? now : "CURRENT_TIMESTAMP"});
  `);
}
