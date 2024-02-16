import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";
import { MigrationError } from "./types";

export function fromValidation<A>(
  validation: t.Validation<A>,
): E.Either<Error, A> {
  return pipe(
    validation,
    E.mapLeft(
      (errors) => new Error(PathReporter.report(E.left(errors)).join("\n")),
    ),
  );
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
  value: unknown,
): value is Error & NodeJS.ErrnoException {
  return value !== null && typeof value === "object" && "code" in value;
}

export function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
