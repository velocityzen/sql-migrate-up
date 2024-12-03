import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { Parameters } from "./types";
import { pipe } from "fp-ts/function";
import { addFileNameToErrorMessage, readFile } from "./fs";

export function loadTemplate(
  filePath: string,
  data: Parameters,
): TE.TaskEither<Error, string> {
  return pipe(
    filePath,
    readFile,
    TE.flatMapEither(applyTemplateData(data)),
    TE.mapError(addFileNameToErrorMessage(filePath)),
  );
}

export function applyTemplateData(
  data: Parameters,
): (templateSql: string) => E.Either<Error, string> {
  return (templateSql) => {
    // check for empty migrations files
    if (templateSql.trim().length === 0) {
      return E.left(Error("Found empty migration"));
    }

    const sql = Array.from(Object.entries(data)).reduce(
      (sql, [key, value]) =>
        value ? sql.replaceAll(`{{${key}}}`, value) : sql,
      templateSql,
    );

    const extraParameters = Array.from(sql.matchAll(/{{([-a-zA-Z0-9_]+)}}/gi));
    if (extraParameters.length > 0) {
      const extraNames = extraParameters.map((tuple) => tuple[1]);
      return E.left(Error(`Found extra parameters (${extraNames.join(",")})`));
    }

    return E.right(sql);
  };
}
