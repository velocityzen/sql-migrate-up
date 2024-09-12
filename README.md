# sql-migrate-up

[![NPM Version](https://img.shields.io/npm/v/sql-migrate-up.svg?style=flat-square)](https://www.npmjs.com/package/sql-migrate-up)
[![NPM Downloads](https://img.shields.io/npm/dt/sql-migrate-up.svg?style=flat-square)](https://www.npmjs.com/package/sql-migrate-up)

Simple SQL migration tool.

Tested with SQLite, PostgreSQL, Snowflake

# Install

`npm i sql-migrate-up`

# Usage

## fp-ts version

Here is an example of your `migrate` command:

```typescript
import * as TE from "fp-ts/TaskEither";
import * as T from "fp-ts/Task";
import { pipe } from "fp-ts/lib/function";
import { cli } from "sql-migrate-up";

// this is your db client dependecy implementation
import { withDbClient } from "./client";

cli({
  schema: "public",
  folder: "./migrations",
  table: "migrations",
  parameters: ({ schema }) => TE.of({ schema }),
  select: <T>(sql: string) =>
    pipe(
      withDbClient(),
      TE.flatMap(({ select }) => select<T>(sql)),
    ),
  execute: (sql: string) =>
    pipe(
      withDbClient(),
      TE.flatMap(({ execute }) => execute(sql)),
      TE.asUnit,
    ),
  end: () =>
    pipe(
      withDbClient(),
      TE.flatMap(({ end }) => end()),
      T.asUnit,
    ),
});
```

## Promise version

```typescript
import { cliPromise } from "sql-migrate-up";

// this is your db client dependecy implementation
import { withDbClient } from "./client";

const db = withDbClient()

cliPromise({
  schema: "public",
  folder: "./migrations",
  table: "migrations",
  parameters: ({ schema }) => Promise.resolve({ schema }),
  select: <T>(sql: string) => Promise.resolve(db.select<T>(sql)),
  execute: (sql) =>
    new Promise((resolve) => {
      db.exec(sql);
      resolve();
    }),
  end: () => Promise.resolve(db.end());
});
```


The example above is in TypeScript, use your favorite build tool to make an executable script or simply add it to package.json scripts section.

If you run it with no parameters you'll see help:

```
❯ ./migrate
Usage: migrate [options] [command]

Options:
  -V, --version               output the version number
  -h, --help                  display help for command

Commands:
  up [options]                run all migrations
  test [options]              tests all migrations for errors
  create [options] [name...]  create a new migration file
  help [command]              display help for command
```

You can run help for any command like `migrate help create`.

All commands take the following arguments to override default values:

- --schema <string> schema to migrate
- --table <string> migrations history table name
- --folder <string> folder with migrations files

## Test migrations

You can test all of the migrations to have all the paramters and, optionaly, syntax errors

```
❯ ./migrate test --schema <schema>
```

To turn on the syntax errors add parser options as a second argument for your cli implementation like this:

```typescript
import { cli } from "sql-migrate-up";

cli({...}, { dialect: "sqlite" });

```

Syntax check only supports:

* SQLite - full support.
* BigQuery - full support.
* MySQL - experimental.
* MariaDB - experimental.
* PostgreSQL - experimental.

For the progress you can follow [sql-parser-cst](https://github.com/nene/sql-parser-cst)

## run-once vs. run-always

All migrations are split into two categories:

- **run-once** - default, normal migration file that will be kept in a history table and run only once.
- **run-always** - migration file that needs to be run after all migrations every time. Useful for `create or replace` views, functions, etc.

`run-once` always runs first and then `run-always`.

**Always use `migrate create <name> [--run-always]` to create a new migration**

## SQLUp Options

- name, <string> ("migrate") - the name of the script.
- version, <string> ("version of this package") - version of the script.
- schema, <string | null> ("public") - schema, if schema is set to `null` to schema will be enforced.
- folder, <string> or <(schema: string) => string> ("./migrations") - folder with migrations files, or a functinon that returns a folder.
- table, <string> ("migrations") - the name of the table to keep the history of migration.
- now, <string> ("now()") - the sql function for getting current timestamp.
- _parameters_, async function that should resolve into a data object that will be applied to every migration file.
- _select_, async function that returns results from your SQL db.
- _execute_, async function that executes arbitrary SQL in your db and does not return results.
- end, async function that will be run after all is done. The perfect place to close your connections.

## API: migrateUp

`migrateUp` take all the same arguments except `end`. Returns a number of applied migrations.

```ts
import { migrateUp } from "sql-migrate-up"; // or migrateUpPromise

// this is your db client dependecy implementation
import { withDbClient } from "./client";

const migrations = await migrateUp({
  schema: "public",
  folder: "./migrations",
  table: "migrations",
  parameters: ({ schema }) => TE.of({ schema }),
  select: <T>(sql: string) =>
    pipe(
      withDbClient(),
      TE.flatMap(({ select }) => select<T>(sql)),
    ),
  execute: (sql: string) =>
    pipe(
      withDbClient(),
      TE.flatMap(({ execute }) => execute(sql)),
      TE.asUnit,
    ),
});
```

## Versioning

This is advance option and you probably will never need it. However it is very usefull when you have mutliple parallel instances of the same script trying to migrate one schema.

### Options

- _version_, <string> required version of your package
- _useVersioning_, <true> sets the migrations to be in versioning mode.

How it works. If version changes works as usual, if version did not change no migration (not run-once, not run-always) will be applied.

When using versioning you can use `--force` flag to force run migrations for the same version.

## Dependecies

If there is migration dependency on external folder, ie. npm package there is a way to include that in migration process as well. Create a file `migrations.json` in the migrations folder:

```
/*
 /migrations
   [/schema]
     run-once
     migrations.json
*/

{
  "before": ["path/to/migrations", "path/to/another/migrations"],
  "after": ["path/to/migrations"]
}
```

* All paths should have the same structure as local migrations.
* `migrations.json` from external migrations will be ignored
* `before` and `after` are both optional but the file should have at least one
* Migrations history would have full path to migration file relative to the current working directory
* for `before` folders both `run-once` and `run-always` migration will be applied before all local migrations
* for `after` folders both `run-once` and `run-always` migration will be applied after all local migrations

License

[MIT](LICENSE)
