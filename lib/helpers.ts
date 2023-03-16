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
    return path.join(".", folder(schema), runAlways ? RunAlways : RunOnce);
  }

  if (schema === null) {
    return path.join(".", folder, runAlways ? RunAlways : RunOnce);
  }

  return path.join(".", folder, schema, runAlways ? RunAlways : RunOnce);
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function instanceOfNodeError<T extends new (...args: any[]) => Error>(
  value: unknown,
  ErrorType: T
): value is InstanceType<T> & NodeJS.ErrnoException {
  return value instanceof ErrorType;
}
