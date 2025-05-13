import { pipe } from "fp-ts/function";
import * as TE from "fp-ts/TaskEither";
import * as REC from "fp-ts/Record";
import { describe, expect, test } from "vitest";
import { Options } from "../lib/types";
import { createSqlLiteClient, queryAll, queryExec } from "./db";
import {
  getCLIOptions,
  MIGRATIONS_FOLDER,
  MIGRATIONS_SCHEMA,
  MIGRATIONS_TABLE,
} from "../lib/options";

describe("CLI", () => {
  const db = createSqlLiteClient(":memory:");

  const baseOptions: Options = {
    parameters: () => TE.of({ table: "test_table" }),
    select: <T>(sql: string) => pipe(db, queryAll<T>(sql), TE.fromEither),
    execute: (sql) => pipe(db, queryExec(sql), TE.fromEither),
  };

  const getDefaultCLIOptions = (options: Options) =>
    pipe(
      getCLIOptions(options),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-return
      REC.map(({ defaultValue }) => defaultValue)
    );

  test("CLI options have expected defaults with minimal Options object", () => {
    expect(getDefaultCLIOptions(baseOptions)).toStrictEqual({
      schemaOption: MIGRATIONS_SCHEMA,
      tableOption: MIGRATIONS_TABLE,
      folderOption: MIGRATIONS_FOLDER,
      runOption: false,
      useVersioningOption: false,
      forceOption: false,
    });
  });

  test("CLI options defaults correctly reflect what is in the Options object", () => {
    expect(
      getDefaultCLIOptions({
        ...baseOptions,
        schema: "default_schema",
        table: "default_table",
        folder: "default_folder",
        useVersioning: true,
        force: true,
      })
    ).toStrictEqual({
      schemaOption: "default_schema",
      tableOption: "default_table",
      folderOption: "default_folder",
      runOption: false,
      useVersioningOption: true,
      forceOption: true,
    });
  });
});
