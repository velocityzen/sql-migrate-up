import path from "path";

import { RunOnce, RunAlways, MigrationError, MigrationsContext } from "./types";

type GetMigrationsPathOptions = Pick<MigrationsContext, "schema" | "folder"> & {
  runAlways?: boolean;
};

export function getMigrationsPath({
  folder,
  schema,
  runAlways,
}: GetMigrationsPathOptions): string {
  if (typeof folder === "function") {
    return path.join(folder(schema), runAlways ? RunAlways : RunOnce);
  }

  if (schema === null) {
    return path.join(folder, runAlways ? RunAlways : RunOnce);
  }

  return path.join(folder, schema, runAlways ? RunAlways : RunOnce);
}

export function getTable(schema: string | null, table: string): string {
  if (schema === null) {
    return table;
  }

  return `${schema}.${table}`;
}

export function createMigrationError(file: string, e: Error): MigrationError {
  const error = e as MigrationError;
  error.file = file;
  error.message = `${file}: ${e.message}`;
  return error;
}

export function instanceOfNodeError(
  value: unknown
): value is Error & NodeJS.ErrnoException {
  return value !== null && typeof value === "object" && "code" in value;
}
