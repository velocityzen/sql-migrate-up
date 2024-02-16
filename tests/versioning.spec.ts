import Database from "better-sqlite3";
import { runMigrations, RunContext } from "../lib";
import { getCompletedMigrationsPromise } from "../lib/migrate";
import { MigrationRow } from "../lib/types";
import { version } from "../package.json";

describe("Versioning", () => {
  const db = new Database(":memory:");
  const context: RunContext = {
    schema: null,
    table: "migrations",
    folder: "./tests/migrations",
    now: "datetime('now')",
    useVersioning: true,
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
    expect(migrations).toBe(3);

    const rows = db.prepare("select * from test_view;").all();
    expect(rows).toEqual([{ test_column: "test_value" }]);

    const migrationRows = db
      .prepare("select * from migrations;")
      .all() as MigrationRow[];

    expect(migrationRows.length).toEqual(3);
    expect(migrationRows[0].name).toEqual(
      "tests/migrations/run-once/01-table.sql",
    );
    expect(migrationRows[1].name).toEqual(
      "tests/migrations/run-once/02-insert.sql",
    );
    expect(migrationRows[2].name).toEqual(`version-${version}`);
  });

  test("run everything again, and check that nothing was run again", async () => {
    const migrations = await runMigrations(context);
    expect(migrations).toBe(0);
  });

  test("change version, run everything again, and check run-always", async () => {
    const migrations = await runMigrations({ ...context, version: "new" });
    expect(migrations).toBe(1);

    const migrationRows = await getCompletedMigrationsPromise(context);
    expect(migrationRows.length).toBe(4);
  });

  test("run new version again, and check that nothing was run again", async () => {
    const migrations = await runMigrations({ ...context, version: "new" });
    expect(migrations).toBe(0);
  });

  test("run new version again with force flag", async () => {
    const migrations = await runMigrations({
      ...context,
      version: "new",
      force: true,
    });

    expect(migrations).toBe(1);
  });
});
