import { pipe } from "fp-ts/lib/function";
import * as TE from "fp-ts/TaskEither";
import { expectLeftTaskEither } from "jest-fp-ts-matchers";
import { afterAll, describe, expect, test } from "vitest";
import { Context, testMigrations } from "../lib";
import { createSqlLiteClient, queryAll, queryExec } from "./db";
import { testTaskEither } from "./helpers";

describe("Check", () => {
  const db = createSqlLiteClient(":memory:");

  const context: Context = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations-with-dependencies-and-errors",
    now: "datetime('now')",
    parameters: () => TE.of({ table: "test_table" }),
    select: <T>(sql: string) => pipe(db, queryAll<T>(sql), TE.fromEither),
    execute: (sql) => pipe(db, queryExec(sql), TE.fromEither),
  };

  afterAll(() => {
    db.close();
  });

  test(
    "full",
    testTaskEither(() =>
      pipe(
        testMigrations(context, { dialect: "sqlite" }),
        expectLeftTaskEither(() => {
          expect(true).toBe(true);
        }),
      ),
    ),
  );
});
