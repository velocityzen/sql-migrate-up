import { Option } from "commander";
import { Options } from "./types";

const MIGRATIONS_SCHEMA = "public";
const MIGRATIONS_TABLE = "migrations";
const MIGRATIONS_FOLDER = "./migrations";

export function getCLIOptions({ table, folder, schema }: Options) {
  const schemaOption = new Option(
    "--schema <string>",
    "schema to migrate"
  ).default(schema === undefined ? MIGRATIONS_SCHEMA : schema);

  const tableOption = new Option(
    "--table <string>",
    "migrations history table name"
  ).default(table ?? MIGRATIONS_TABLE);

  const folderOption = new Option(
    "--folder <string>",
    "folder with migrations files"
  ).default(folder ?? MIGRATIONS_FOLDER);

  const runOption = new Option(
    "--run-always",
    "create run-always migration instead of run-once"
  ).default(false);

  return { schemaOption, tableOption, folderOption, runOption };
}
