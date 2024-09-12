export type { Parameters, Context, MigrationsContext } from "./types";
export { migrateUp } from "./migrate";
export { testMigrations } from "./test";

export { cli } from "./cli";
import { cli } from "./cli";
export default cli;

export * from "./promise";
