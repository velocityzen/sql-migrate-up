import { pipe } from "fp-ts/lib/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { expectRightTaskEither } from "jest-fp-ts-matchers";
import { Context, migrateUp } from "../lib";
import { MigrationRow } from "../lib/types";
import { createSqlLiteClient, queryAll, queryExec } from "./db";
import { testTaskEither } from "./jest";

describe("Dependencies", () => {
  const db = createSqlLiteClient(":memory:");

  const context: Context = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations-with-dependencies",
    now: "datetime('2024-01-01')",
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
          expect(migrations).toBe(6);
        }),
        T.map(() =>
          pipe(db, queryAll<MigrationRow>("select * from migrations;")),
        ),
        expectRightTaskEither((migrationRows) => {
          expect(migrationRows).toEqual([
            {
              created_at: "2024-01-01 00:00:00",
              name: "tests/migrations-with-dependencies/run-once/01-table.sql",
            },
            {
              created_at: "2024-01-01 00:00:00",
              name: "tests/migrations-with-dependencies/run-once/02-insert.sql",
            },
            {
              created_at: "2024-01-01 00:00:00",
              name: "tests/migrations/run-once/01-table.sql",
            },
            {
              created_at: "2024-01-01 00:00:00",
              name: "tests/migrations/run-once/02-insert.sql",
            },
          ]);
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
          expect(migrations).toBe(2);
        }),
      ),
    ),
  );
});
