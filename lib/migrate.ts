import fs from "fs/promises";
import path from "path";

import { partition } from "fp-ts/Array";

import {
  MigrationRow,
  Parameters,
  RunContext,
  RunContextUseVersioning,
  doUseVersioning,
} from "./types";

import {
  getMigrationsPath,
  createMigrationError,
  instanceOfNodeError,
  getTable,
} from "./helpers";

export async function runMigrations(
  context: RunContext,
  onMigrationApplied?: (fileName: string) => void | Promise<void>,
): Promise<number> {
  if (doUseVersioning(context) && !context.version) {
    throw new Error("useVersioning is set to true, but version is not defined");
  }

  await ensureSchemaAndMigrationTable(context);
  const migrations = await getNewMigrations(context);
  if (!migrations) {
    return 0;
  }

  const { filesToRunOnce, filesToRunAlways } = migrations;
  const migrationData = await context.parameters(context);

  for await (const migrationFile of filesToRunOnce) {
    await runMigration(context, migrationFile, migrationData);
    if (onMigrationApplied) {
      await onMigrationApplied(migrationFile);
    }
  }

  for await (const migrationFile of filesToRunAlways) {
    await runMigration(context, migrationFile, migrationData, false);
    if (onMigrationApplied) {
      await onMigrationApplied(migrationFile);
    }
  }

  if (doUseVersioning(context)) {
    await saveVersion(context);
  }

  return filesToRunOnce.length + filesToRunAlways.length;
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
      const fileName = path.basename(migrationFile);
      await query(`insert into
        ${getTable(schema, table)}
        values ('${fileName}', ${now ? now : "CURRENT_TIMESTAMP"});
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

  return Array.from(Object.entries(data)).reduce(
    (sql, [key, value]) => (value ? sql.replaceAll(`{{${key}}}`, value) : sql),
    templateSql,
  );
}

const rxVersion = /^version-(.*)/;
const splitMigrationsAndVersions = partition<MigrationRow>((row) =>
  rxVersion.test(row.name),
);

async function getNewMigrations(context: RunContext) {
  const [rows, fsFilesRunOnce, filesToRunAlways] = await Promise.all([
    getCompletedMigrations(context),
    getMigrationsFiles(context),
    getMigrationsFiles(context, true),
  ]);

  let migrations: MigrationRow[];

  if (doUseVersioning(context)) {
    const { right: versions, left: migrationRows } =
      splitMigrationsAndVersions(rows);
    const latest = versions.at(-1);

    if (latest) {
      const match = latest.name.match(rxVersion);
      if (match?.[1] === context.version) {
        // version matches, all good, bye!
        return null;
      }
    }

    migrations = migrationRows;
  } else {
    migrations = rows;
  }

  const dbFiles = migrations.map((row) => row.name);
  const filesToRunOnce = fsFilesRunOnce.filter(
    (name) => !dbFiles.includes(path.basename(name)),
  );

  return { filesToRunOnce, filesToRunAlways };
}

async function getMigrationsFiles(
  context: RunContext,
  runAlways = false,
): Promise<string[]> {
  const migrationsPath = getMigrationsPath({ ...context, runAlways });
  const rxSqlFiles = /\.sql$/;
  const rxMigrationFiles = /^\d+[-_].*\.sql$/;

  try {
    const files = await fs.readdir(migrationsPath);
    const allSqlFiles = files
      .filter((file) => rxSqlFiles.test(path.basename(file)))
      .sort((a, b) => a.localeCompare(b));

    const migrationFiles = allSqlFiles.filter((file) =>
      rxMigrationFiles.test(path.basename(file)),
    );

    const difference = allSqlFiles.filter(
      (element) => !migrationFiles.includes(element),
    );

    if (difference.length) {
      throw new Error(
        `Found migration files that do not start with a number and will not be ran: \n${difference.join(
          "\n",
        )}`,
      );
    }

    return migrationFiles.map((fileName) =>
      path.join(migrationsPath, fileName),
    );
  } catch (e) {
    if (instanceOfNodeError(e) && e.code === "ENOENT") {
      return [];
    }

    throw e;
  }
}

export async function getCompletedMigrations({
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
