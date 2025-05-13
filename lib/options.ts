import { Option } from "commander";
import { CliOptions } from "./types";

export const MIGRATIONS_SCHEMA = "public";
export const MIGRATIONS_TABLE = "migrations";
export const MIGRATIONS_FOLDER = "./migrations";

export function getCliOptions({
  table,
  folder,
  schema,
  useVersioning,
}: CliOptions) {
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

  const useVersioningOption = new Option(
    "--use-versioning",
    "use migrations versioning"
  ).default(useVersioning ?? false);

  const forceOption = new Option(
    "--force",
    "force run migration with the same version"
  ).default(false);

  return {
    schemaOption,
    tableOption,
    folderOption,
    runOption,
    useVersioningOption,
    forceOption,
  };
}
