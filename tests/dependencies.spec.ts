import Database from "better-sqlite3";
import { runMigrations, RunContext } from "../lib";
import { MigrationRow } from "../lib/types";
import { version } from "../package.json";

describe("Dependencies", () => {
  const db = new Database(":memory:");
  const context: RunContext = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations-with-dependencies",
    now: "datetime('2024-01-01')",
    version,
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
    expect(migrations).toBe(6);

    const migrationRows = db
      .prepare("select * from migrations;")
      .all() as MigrationRow[];

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
  });

  test("run everything again, and check that nothing was run again", async () => {
    const migrations = await runMigrations(context);
    expect(migrations).toBe(2);
  });
});
