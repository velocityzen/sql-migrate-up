import path from "path";

import { RunOnce, RunAlways, MigrationError } from "./types";

interface GetMigrationsPathOptions {
  folder: string;
  schema: string;
  runAlways?: boolean;
}

export function getMigrationsPath({
  folder,
  schema,
  runAlways,
}: GetMigrationsPathOptions): string {
  return path.join(".", folder, schema, runAlways ? RunAlways : RunOnce);
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
