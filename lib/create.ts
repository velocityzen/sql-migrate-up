import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import { DateTime } from "luxon";
import path from "path";
import slugify from "slugify";
import { mkdirp, touch } from "./fs";
import { getMigrationsPath } from "./migrations";
import { MigrationsContext } from "./types";

export interface CreateMigrationContext extends MigrationsContext {
  runAlways?: boolean;
}

export function createMigration(
  context: CreateMigrationContext,
  migrationName: string,
): TE.TaskEither<Error, string> {
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

  return pipe(
    mkdirp(migrationPath),
    TE.flatMap(() => touch(fullMigrationPath)),
    TE.as(fullMigrationPath),
  );
}
