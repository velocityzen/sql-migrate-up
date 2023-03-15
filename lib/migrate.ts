import fs from "fs/promises";
import path from "path";

import {
  MigrationsContext,
  Options,
  MigrationRow,
  MigrationData,
  RX_MIGRATION_FILES,
} from "./types";

import {
  getMigrationsPath,
  createMigrationError,
  instanceOfNodeError,
} from "./helpers";

type Context = MigrationsContext & Pick<Options, "applyData" | "runSQL">;

export async function runMigrations(
  context: Context,
  onMigrationApplied?: (fileName: string) => void | Promise<void>
): Promise<number> {
  await ensureSchemaAndMigrationTable(context);
  const { filesToRunOnce, filesToRunAlways } = await getNewMigrations(context);
  const migrationData = await context.applyData(context);

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
  { schema, table, runSQL }: Context,
  migrationFile: string,
  data: MigrationData,
  saveMigration = true
) {
  try {
    const migrationSql = await loadMigration(migrationFile, data);
    await runSQL(migrationSql);

    if (saveMigration) {
      const fileName = path.basename(migrationFile);
      await runSQL(`insert into
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
  data: MigrationData
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
  runSQL,
  schema,
  table,
}: Context): Promise<MigrationRow[]> {
  const migrations = (await runSQL(`
    select * from ${schema}.${table}
    order by name, created_at;
  `)) as MigrationRow[];

  return migrations;
}

/**
 * Ensures that the schema you're trying to run migrations on and the history table exist.
 * */
async function ensureSchemaAndMigrationTable(context: Context) {
  await ensureSchemaExists(context);
  await ensureMigrationsTableExists(context);
}

async function ensureSchemaExists({ runSQL, schema }: Context): Promise<void> {
  await runSQL(`create schema if not exists ${schema};`);
}

async function ensureMigrationsTableExists({
  runSQL,
  schema,
  table,
}: Context): Promise<void> {
  await runSQL(`create table if not exists ${schema}.${table} (
    name text not null,
    created_at timestamp not null
  );`);
}
