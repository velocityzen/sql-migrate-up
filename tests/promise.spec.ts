import { afterAll, describe, expect, test } from "vitest";
import { ContextPromise, migrateUpPromise } from "../lib";
import { MigrationRow } from "../lib/types";
import { createSqlLiteClient } from "./db";

describe("Migrations", () => {
  const db = createSqlLiteClient(":memory:");

  const context: ContextPromise = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations",
    now: "datetime('now')",
    parameters: () => Promise.resolve({ table: "test_table" }),
    select: <T>(sql: string) => Promise.resolve(db.prepare<[], T>(sql).all()),
    execute: (sql) =>
      new Promise((resolve) => {
        db.exec(sql);
        resolve();
      }),
  };

  afterAll(() => {
    db.close();
  });

  test("run everything", async () => {
    await migrateUpPromise(context);

    const rows = db
      .prepare<[], { test_column: string }>("select * from test_view;")
      .all();
    expect(rows).toEqual([{ test_column: "test_value" }]);

    const migrationRows = db
      .prepare<[], MigrationRow>("select * from migrations;")
      .all();
    expect(migrationRows.length).toEqual(2);
    expect(migrationRows[0].name).toEqual(
      "tests/migrations/run-once/01-table.sql",
    );
    expect(migrationRows[1].name).toEqual(
      "tests/migrations/run-once/02-insert.sql",
    );
  });
});
