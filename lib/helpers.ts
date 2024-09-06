import * as E from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { PathReporter } from "io-ts/PathReporter";

export function getTable(schema: string | null, table: string): string {
  if (schema === null) {
    return table;
  }

  return `${schema}.${table}`;
}

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

export function toMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}
