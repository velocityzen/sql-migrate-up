import { pipe } from "fp-ts/function";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { expectRightTaskEither } from "jest-fp-ts-matchers";
import { afterAll, describe, expect, test } from "vitest";
import { Context, migrateUp } from "../lib";
import { MigrationRow } from "../lib/types";
import { version } from "../package.json";
import { createSqlLiteClient, queryAll, queryExec } from "./db";
import { testTaskEither } from "./helpers";

describe("Versioning", () => {
  const db = createSqlLiteClient(":memory:");

  const context: Context = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations",
    now: "datetime('now')",
    useVersioning: true,
    version,
    parameters: () => TE.of({ table: "test_table" }),
    select: <T>(sql: string) => pipe(db, queryAll<T>(sql), TE.fromEither),
    execute: (sql) => pipe(db, queryExec(sql), TE.fromEither),
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
          expect(migrationRows.length).toEqual(3);
          expect(migrationRows[0].name).toEqual(
            "tests/migrations/run-once/01-table.sql",
          );
          expect(migrationRows[1].name).toEqual(
            "tests/migrations/run-once/02-insert.sql",
          );
          expect(migrationRows[2].name).toEqual(`version-${version}`);
        }),
      ),
    ),
  );

  test(
    "run everything again, and check that nothing was run again",
    testTaskEither(() =>
      pipe(
        context,
        migrateUp,
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(0);
        }),
        T.map(() =>
          pipe(db, queryAll<MigrationRow>("select * from migrations;")),
        ),
        expectRightTaskEither((migrationRows) => {
          expect(migrationRows.length).toEqual(3);
        }),
      ),
    ),
  );

  test(
    "change version, run everything again, and check run-always",
    testTaskEither(() =>
      pipe(
        migrateUp({ ...context, version: "new" }),
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(1);
        }),
        T.map(() =>
          pipe(db, queryAll<MigrationRow>("select * from migrations;")),
        ),
        expectRightTaskEither((migrationRows) => {
          expect(migrationRows.length).toEqual(4);
        }),
      ),
    ),
  );

  test(
    "run new version again, and check that nothing was run again",
    testTaskEither(() =>
      pipe(
        migrateUp({ ...context, version: "new" }),
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(0);
        }),
      ),
    ),
  );

  test(
    "run new version again with force flag",
    testTaskEither(() =>
      pipe(
        migrateUp({ ...context, version: "new", force: true }),
        expectRightTaskEither((migrations) => {
          expect(migrations).toBe(1);
        }),
      ),
    ),
  );
});
