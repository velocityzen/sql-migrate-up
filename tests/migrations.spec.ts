import Database from "better-sqlite3";
import { runMigrations, RunContext } from "../lib";
import { MigrationRow } from "../lib/types";

describe("Migrations", () => {
  const db = new Database(":memory:");
  const context: RunContext = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations",
    now: "datetime('now')",
    parameters: () => Promise.resolve({ table: "test_table" }),
    query: (query, isSelect) =>
      new Promise((resolve) => {
        if (isSelect) {
          resolve(db.prepare(query).all());
          return;
        }

        resolve(db.exec(query));
      }),
  };

  afterAll(() => {
    db.close();
  });

  test("run everything", async () => {
    const migrations = await runMigrations(context);
    expect(migrations).toBe(3);

    const rows = db.prepare("select * from test_view;").all();
    expect(rows).toEqual([{ test_column: "test_value" }]);

    const migrationRows = db
      .prepare("select * from migrations;")
      .all() as MigrationRow[];

    expect(migrationRows.length).toEqual(2);
    expect(migrationRows[0].name).toEqual("01-table.sql");
    expect(migrationRows[1].name).toEqual("02-insert.sql");
  });

  test("run everything again, and check run-always", async () => {
    const migrations = await runMigrations(context);
    expect(migrations).toBe(1);
  });

  test("run migration from different than schema folder", async () => {
    const migrations = await runMigrations({
      ...context,
      folder: () => "./tests/migrations",
    });
    expect(migrations).toBe(1);
  });
});
