import { program } from "commander";
import { version } from "../package.json";

import { Options, MigrationsContext, CreateMigrationContext } from "./types";
import { getCLIOptions } from "./options";
import { createMigration } from "./create";
import { runMigrations } from "./migrate";
import { toMessage } from "./helpers";

export function runCli(options: Options) {
  const { schemaOption, tableOption, folderOption, runOption, forceOption } =
    getCLIOptions(options);

  program.name(options.name ?? "migrate").version(options.version ?? version);

  program
    .command("up")
    .description("run all migrations")
    .addOption(schemaOption)
    .addOption(tableOption)
    .addOption(folderOption)
    .addOption(forceOption)
    .action(async (context: MigrationsContext) => {
      try {
        console.info(
          `Appling migrations ${
            context.schema !== null ? `to ${context.schema}` : ""
          }`,
        );

        const runnedMigrationsNumber = await runMigrations(
          { ...options, ...context },
          (name) => {
            console.info(`> ${name}`);
          },
        );
        if (runnedMigrationsNumber === 0) {
          console.info("No migrations to run. DB is up to date.");
        } else {
          console.info(
            `${runnedMigrationsNumber} migrations applied. DB is up to date.`,
          );
        }
        await options.end?.();
      } catch (error) {
        await options.end?.();
        console.error("Failed to run migrations:", toMessage(error));
        process.exit(1);
      }
    });

  program
    .command("create")
    .description("create a new migration file")
    .addOption(schemaOption)
    .addOption(tableOption)
    .addOption(folderOption)
    .addOption(runOption)
    .argument("[name...]", "name of the new migration", "new migration")
    .action(async (name: string[], context: CreateMigrationContext) => {
      try {
        const newMigrationName = await createMigration(context, name.join(" "));
        console.info(`New migration has been created at: ${newMigrationName}`);
      } catch (error) {
        console.error("Failed to create migration:", toMessage(error));
        process.exit(1);
      }
    });

  program.parse();
}
