import { program } from "commander";
import * as C from "fp-ts/Console";
import { constVoid, flow, pipe } from "fp-ts/function";
import * as O from "fp-ts/Option";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { ParserOptions } from "sql-parser-cst";
import { version } from "../package.json";
import { createActionFor } from "./commander";
import { createMigration, CreateMigrationContext } from "./create";
import { migrateUp } from "./migrate";
import { getCLIOptions } from "./options";
import { testMigrations } from "./test";
import { MigrationsContext, Options } from "./types";

export function cli(options: Options, parserOptions?: ParserOptions) {
  const {
    schemaOption,
    tableOption,
    folderOption,
    runOption,
    useVersioningOption,
    forceOption,
  } = getCLIOptions(options);

  program.name(options.name ?? "migrate").version(options.version ?? version);

  program
    .command("up")
    .description("run all migrations")
    .addOption(schemaOption)
    .addOption(tableOption)
    .addOption(folderOption)
    .addOption(useVersioningOption)
    .addOption(forceOption)
    .action(
      createActionFor(
        (context: MigrationsContext) =>
          pipe(
            TE.of({ ...options, ...context }),
            TE.tapIO(({ schema }) =>
              C.info(
                `Appling migrations ${schema !== null ? `to schema "${schema}"` : ""}`,
              ),
            ),
            TE.flatMap((context) =>
              migrateUp(context, (name) => C.info(`> ${name}`)),
            ),
            TE.tapIO(
              flow(
                O.fromPredicate(Boolean),
                O.match(
                  () => C.info("No migrations to run. DB is up to date."),
                  (totalMigrationsApplied) =>
                    C.info(
                      `${totalMigrationsApplied} migrations applied. DB is up to date.`,
                    ),
                ),
              ),
            ),
            T.tap(() =>
              pipe(
                options.end,
                O.fromNullable,
                O.match(
                  // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
                  () => T.of(constVoid()),
                  (end) => end(),
                ),
              ),
            ),
          ),
        "Failed to run migration",
      ),
    );

  program
    .command("test")
    .description("tests all migrations for errors")
    .addOption(schemaOption)
    .addOption(folderOption)
    .action(
      createActionFor((context: MigrationsContext) =>
        pipe(
          TE.of({ ...options, ...context }),
          TE.tapIO(({ schema }) =>
            C.info(
              `Checking migrations ${schema !== null ? `for schema "${schema}"` : ""}`,
            ),
          ),
          TE.flatMap((context) => testMigrations(context, parserOptions)),
          TE.tapIO(() => C.info("Clean")),
        ),
      ),
    );

  program
    .command("create")
    .description("create a new migration file")
    .addOption(schemaOption)
    .addOption(tableOption)
    .addOption(folderOption)
    .addOption(runOption)
    .argument("[name...]", "name of the new migration", ["new migration"])
    .action(
      createActionFor(
        (name: string[], context: CreateMigrationContext) =>
          pipe(
            createMigration(context, name.join(" ")),
            TE.tapIO((newMigrationName) =>
              C.info(`New migration has been created at: ${newMigrationName}`),
            ),
            TE.asUnit,
          ),
        "Failed to create migration",
      ),
    );

  program.parse();
}
