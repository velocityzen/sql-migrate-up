import fs from "fs/promises";
import path from "path";

import {
  MigrationsContext,
  Options,
  MigrationRow,
  Parameters,
  RX_MIGRATION_FILES,
} from "./types";

import {
  getMigrationsPath,
  createMigrationError,
  instanceOfNodeError,
} from "./helpers";

type Context = MigrationsContext & Pick<Options, "parameters" | "query">;

export async function runMigrations(
  context: Context,
  onMigrationApplied?: (fileName: string) => void | Promise<void>
): Promise<number> {
  await ensureSchemaAndMigrationTable(context);
  const { filesToRunOnce, filesToRunAlways } = await getNewMigrations(context);
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

  return filesToRunOnce.length + filesToRunAlways.length;
}

async function runMigration(
  { schema, table, query }: Context,
  migrationFile: string,
  data: Parameters,
  saveMigration = true
) {
  try {
    const migrationSql = await loadMigration(migrationFile, data);
    await query(migrationSql);

    if (saveMigration) {
      const fileName = path.basename(migrationFile);
      await query(`insert into
        ${schema}.${table}
        values ('${fileName}', now());
      `);
    }
  } catch (e) {
    if (!(e instanceof Error)) {
      return e;
    }

    const error = createMigrationError(migrationFile, e);
    throw error;
  }
}

async function loadMigration(
  migrationFile: string,
  data: Parameters
): Promise<string> {
  const templateSql = await fs.readFile(migrationFile, "utf8");

  return Array.from(Object.entries(data)).reduce(
    (sql, [key, value]) => (value ? sql.replaceAll(`{{${key}}}`, value) : sql),
    templateSql
  );
}

async function getNewMigrations(context: Context) {
  const [migrations, fsFilesRunOnce, filesToRunAlways] = await Promise.all([
    getCompletedMigrations(context),
    getMigrationsFiles(context),
    getMigrationsFiles(context, true),
  ]);

  const dbFiles = migrations.map((row) => row.name);
  const filesToRunOnce = fsFilesRunOnce.filter(
    (name) => !dbFiles.includes(path.basename(name))
  );

  return { filesToRunOnce, filesToRunAlways };
}

async function getMigrationsFiles(
  context: Context,
  runAlways = false
): Promise<string[]> {
  const migrationsPath = getMigrationsPath({ ...context, runAlways });

  try {
    const files = await fs.readdir(migrationsPath);
    const migrationFiles = files
      .filter((file) => RX_MIGRATION_FILES.test(path.basename(file)))
      .sort((a, b) => a.localeCompare(b));

    return migrationFiles.map((fileName) =>
      path.join(migrationsPath, fileName)
    );
  } catch (e) {
    if (runAlways && instanceOfNodeError(e, Error) && e.code === "ENOENT") {
      return [];
    }

    throw e;
  }
}

async function getCompletedMigrations({
  query,
  schema,
  table,
}: Context): Promise<MigrationRow[]> {
  const migrations = (await query(`
    select * from ${schema}.${table}
    order by name, created_at;
  `)) as MigrationRow[];

  return migrations;
}

async function ensureSchemaAndMigrationTable(context: Context) {
  await ensureSchemaExists(context);
  await ensureMigrationsTableExists(context);
}

async function ensureSchemaExists({ query, schema }: Context): Promise<void> {
  await query(`create schema if not exists ${schema};`);
}

async function ensureMigrationsTableExists({
  query,
  schema,
  table,
}: Context): Promise<void> {
  await query(`create table if not exists ${schema}.${table} (
    name text not null,
    created_at timestamp not null
  );`);
}
