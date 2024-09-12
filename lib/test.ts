import * as E from "fp-ts/Either";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { constVoid, flow, pipe } from "fp-ts/function";
import { parse, ParserOptions } from "sql-parser-cst";
import { fromSeparated } from "./helpers";
import {
  foldMigrations,
  getAllMigrations,
  getMigrationsPath,
} from "./migrations";
import { loadTemplate } from "./template";
import { Context } from "./types";

const parseSql = E.tryCatchK(parse, E.toError);

const parseSqlWith = (
  options: O.Option<ParserOptions>,
  filename: string,
): ((sql: string) => E.Either<Error, void>) =>
  pipe(
    options,
    O.match(
      // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
      () => () => E.of(constVoid()),
      (options) => (sql: string) =>
        pipe(parseSql(sql, { ...options, filename }), E.asUnit),
    ),
  );

export function testMigrations(context: Context, options?: ParserOptions) {
  const parserOptions = O.fromNullable(options);

  return pipe(
    TE.of(context),
    TE.bind("migrations", (context) =>
      pipe(
        getAllMigrations(context),
        TE.flatMapEither((migrations) =>
          pipe(
            migrations,
            O.match(
              () =>
                E.left(
                  Error(
                    `No migrations found at "${getMigrationsPath(context)}"`,
                  ),
                ),
              (migrations) => E.right(migrations),
            ),
          ),
        ),
      ),
    ),
    TE.bind("templateData", (context) => context.parameters(context)),
    TE.flatMap(({ migrations, templateData }) =>
      pipe(
        migrations,
        foldMigrations,
        T.traverseArray(([filename]) =>
          pipe(
            loadTemplate(filename, templateData),
            TE.flatMapEither(parseSqlWith(parserOptions, filename)),
            TE.asUnit,
          ),
        ),
        T.map(flow(RA.separate, fromSeparated)),
      ),
    ),
  );
}
