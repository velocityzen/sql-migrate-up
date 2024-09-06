import * as T from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { Context, migrateUp } from "../lib";
import { MigrationRow } from "../lib/types";
import { createSqlLiteClient, queryAll, queryExec } from "./db";
import { testTaskEither } from "./jest";
import { expectRightTaskEither } from "jest-fp-ts-matchers";

describe("Migrations", () => {
  const db = createSqlLiteClient(":memory:");

  const context: Context = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations",
    now: "datetime('now')",
    parameters: () => TE.of({ table: "test_table" }),
    select: <T>(sql: string) => pipe(db, queryAll<T>(sql), TE.fromEither),
    exec: (sql) => pipe(db, queryExec(sql), TE.fromEither),
  };

  afterAll(() => {
    db.close();
  });

  test(
    "run everything",
    testTaskEither(() =>
      pipe(
        context,
        migrateUp,
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(3);
        }),
        T.map(() =>
          pipe(
            db,
            queryAll<{ test_column: string }>("select * from test_view;"),
            (a) => a,
          ),
        ),
        expectRightTaskEither((rows) => {
          expect(rows).toEqual([{ test_column: "test_value" }]);
        }),
        T.map(() =>
          pipe(db, queryAll<MigrationRow>("select * from migrations;")),
        ),
        expectRightTaskEither((migrationRows) => {
          expect(migrationRows.length).toEqual(2);
          expect(migrationRows[0].name).toEqual(
            "tests/migrations/run-once/01-table.sql",
          );
          expect(migrationRows[1].name).toEqual(
            "tests/migrations/run-once/02-insert.sql",
          );
        }),
      ),
    ),
  );

  test(
    "run everything again, and check run-always",
    testTaskEither(() =>
      pipe(
        context,
        migrateUp,
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(1);
        }),
      ),
    ),
  );

  test(
    "run migration from different than schema folder",
    testTaskEither(() =>
      pipe(
        migrateUp({
          ...context,
          folder: () => "./tests/migrations",
        }),
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(1);
        }),
      ),
    ),
  );
});
