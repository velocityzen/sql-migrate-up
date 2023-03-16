# sql-up

[![NPM Version](https://img.shields.io/npm/v/sql-up.svg?style=flat-square)](https://www.npmjs.com/package/sql-up)
[![NPM Downloads](https://img.shields.io/npm/dt/sql-up.svg?style=flat-square)](https://www.npmjs.com/package/sql-up)

Simple SQL migration tool.

# Install

`npm i sql-up`

# Usage

Here is an example of your `migrate` command:

```typescript
import SQLUp from "sql-up";

import { getDbClient, stopDbClient } from "./client";

SQLUp({
  schema: "public",
  folder: "./db/migrations",
  table: "migrations",
  parameters: async ({ schema }) => ({ schema }),
  query: async (query) => {
    const client = getDbClient();
    return client(query);
  },
  end: stopDbClient,
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
  create [options] [name...]  create a new migration file
  help [command]              display help for command
```

You can run help for any command like `migrate help create`.

All commands take the following arguments to override default values:

- --schema <string> schema to migrate
- --table <string> migrations history table name
- --folder <string> folder with migrations files

## run-once vs. run-always

All migrations are split into two categories:

- **run-once** - default, normal migration file that will be kept in a history table and run only once.
- **run-always** - migration file that needs to be run after all migrations every time. Useful for `create or replace` views, functions, etc.

`run-once` always runs first and then `run-always`.

**Always use `migrate create <name> [--run-always]` to create a new migration**

## SQLUp Options

- name, string ("migrate") - the name of the script
- version, string ("version of this package") - version of the script
- schema, string ("public") - schema
- folder, string ("./migrations") - folder with migrations files
- table, string ("migrations") - the name of the table to keep the history of migration
- _parameters_, async function that should resolve into a data object that will be applied to every migration file
- _query_, async function that runs SQL
- _end_, async function that will be run after all is done. The perfect place to close your connections

## API: runMigrations

run migrations take all the same arguments except `finally`. Returns a number of applied migrations.

```ts
import { runMigrations } from "sql-up";

import { getDbClient, stopDbClient } from "./client";

const migrations = await runMigrations({
  schema: "public",
  folder: "./db/migrations",
  table: "migrations",
  parameters: async ({ schema }) => ({ schema }),
  query: async (query) => {
    const client = getDbClient();
    return client(query);
  },
});
```

License

[MIT](LICENSE)
