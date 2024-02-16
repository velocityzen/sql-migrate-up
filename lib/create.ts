import fs from "fs/promises";
import path from "path";
import slugify from "slugify";
import { mkdirp } from "mkdirp";
import { DateTime } from "luxon";

import { CreateMigrationContext } from "./types";
import { getMigrationsPath } from "./migrations";

export async function createMigration(
  context: CreateMigrationContext,
  migrationName: string,
): Promise<string> {
  const nextMigrationNumber = DateTime.utc().toUnixInteger();
  const nextMigrationName = slugify(migrationName, {
    replacement: "_",
    lower: true,
    strict: true,
  });

  const migrationPath = getMigrationsPath(context);
  const fullMigrationPath = path.join(
    migrationPath,
    `${nextMigrationNumber}_${nextMigrationName}.sql`,
  );

  await mkdirp(migrationPath);
  const fd = await fs.open(fullMigrationPath, "a"); // use `a` so we do not overwrite existing migration file`
  await fd.close();

  return fullMigrationPath;
}
