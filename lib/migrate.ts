import fs from "fs/promises";
import path from "path";

import {
  MigrationRow,
  Parameters,
  RunContext,
  RX_MIGRATION_FILES,
} from "./types";

import {
  getMigrationsPath,
  createMigrationError,
  instanceOfNodeError,
  getTable,
} from "./helpers";

export async function runMigrations(
  context: RunContext,
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
  { schema, table, query, now }: RunContext,
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
        ${getTable(schema, table)}
        values ('${fileName}', ${now ? now : "CURRENT_TIMESTAMP"});
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

async function getNewMigrations(context: RunContext) {
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
  context: RunContext,
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
    if (runAlways && instanceOfNodeError(e) && e.code === "ENOENT") {
      return [];
    }

    throw e;
  }
}

async function getCompletedMigrations({
  query,
  schema,
  table,
}: RunContext): Promise<MigrationRow[]> {
  const migrations = (await query(
    `
    select * from ${getTable(schema, table)}
    order by name, created_at;
  `,
    true
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
