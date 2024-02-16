import * as AP from "fp-ts/Apply";
import * as O from "fp-ts/Option";
import * as E from "fp-ts/Either";
import * as A from "fp-ts/Array";
import * as ROA from "fp-ts/ReadonlyArray";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import { LazyArg, identity, flow, pipe } from "fp-ts/function";
import { evolve } from "fp-ts/struct";
import fs from "fs/promises";
import path from "path";
import { DependenciesFile } from "./dependencies";
import { fromValidation, instanceOfNodeError } from "./helpers";
import {
  Dependecies,
  MigrationRow,
  MigrationsContext,
  RunAlways,
  RunContext,
  RunOnce,
  doUseVersioning,
} from "./types";

const readFile = TE.tryCatchK(
  (filePath: string) => fs.readFile(filePath, "utf8"),
  (e) => (instanceOfNodeError(e) ? e : E.toError(e)),
);

const useEmptyMigrations = (): readonly Migrations[] => [];

type Migrations = {
  once: string[];
  always: string[];
};

export function getAllMigrations(
  context: RunContext,
): TE.TaskEither<Error, readonly Migrations[]> {
  return pipe(
    getMigrations(context),
    TE.bindTo("local"),
    TE.bind("dependecies", () => getDependecies(context)),
    TE.map(({ local, dependecies }) =>
      pipe(
        dependecies.before,
        ROA.concat(ROA.of(local)),
        ROA.concat(dependecies.after),
      ),
    ),
  );
}

function getDependecies(context: RunContext) {
  return pipe(
    context,
    getMigrationsPath,
    (migrationsPath) => path.join(migrationsPath, Dependecies),
    readFile,
    TE.flatMapEither(flow(DependenciesFile.decode, fromValidation)),
    TE.map(applyDefaults),
    TE.map(
      evolve({
        before: getDependenciesMigrations,
        after: getDependenciesMigrations,
      }),
    ),
    TE.flatMap(AP.sequenceS(TE.ApplyPar)),
    T.map(ignoreFileDoesNotExistError(useEmptyDependecies)),
  );
}

const getDependenciesMigrations = flow(
  O.fromNullable<string[] | undefined>,
  O.map(
    TE.traverseArray((folder: string) =>
      getMigrations({
        folder,
        schema: null,
      }),
    ),
  ),
  O.getOrElse(() => TE.of(useEmptyMigrations())),
);

function getMigrations(
  context: GetMigrationsPathOptions,
): TE.TaskEither<Error, Migrations> {
  return pipe(
    [getMigrationFiles(context), getMigrationFiles(context, true)],
    TE.sequenceArray,
    TE.map(([once, always]) => ({
      once,
      always,
    })),
  );
}

async function getMigrationsFilesPromise(
  context: GetMigrationsPathOptions,
  runAlways = false,
): Promise<string[]> {
  const migrationsPath = getMigrationsPath({ ...context, runAlways });
  const rxSqlFiles = /\.sql$/;
  const rxMigrationFiles = /^\d+[-_].*\.sql$/;

  try {
    const files = await fs.readdir(migrationsPath);
    const allSqlFiles = files
      .filter((file) => rxSqlFiles.test(path.basename(file)))
      .sort((a, b) => a.localeCompare(b));

    const migrationFiles = allSqlFiles.filter((file) =>
      rxMigrationFiles.test(path.basename(file)),
    );

    const difference = allSqlFiles.filter(
      (element) => !migrationFiles.includes(element),
    );

    if (difference.length) {
      throw new Error(
        `Found migration files that do not start with a number and will not be ran: \n${difference.join(
          "\n",
        )}`,
      );
    }

    return migrationFiles.map((fileName) =>
      path.join(migrationsPath, fileName),
    );
  } catch (e) {
    if (instanceOfNodeError(e) && e.code === "ENOENT") {
      return [];
    }

    throw e;
  }
}

const getMigrationFiles = TE.tryCatchK(getMigrationsFilesPromise, E.toError);

type GetMigrationsPathOptions = Pick<MigrationsContext, "schema" | "folder"> & {
  runAlways?: boolean;
};

export function getMigrationsPath({
  folder,
  schema,
  runAlways,
}: GetMigrationsPathOptions): string {
  const sufix =
    runAlways === true ? RunAlways : runAlways === false ? RunOnce : "";

  if (typeof folder === "function") {
    return path.join(folder(schema), sufix);
  }

  if (schema === null) {
    return path.join(folder, sufix);
  }

  return path.join(folder, schema, sufix);
}

function ignoreFileDoesNotExistError<E, A>(c: LazyArg<A>) {
  return (e: E.Either<E, A>) => {
    if (
      E.isLeft(e) &&
      instanceOfNodeError(e.left) &&
      e.left.code === "ENOENT"
    ) {
      return E.right(c());
    }

    return e;
  };
}

type ExpandedDependecies = {
  before: readonly Migrations[];
  after: readonly Migrations[];
};

const useEmptyDependecies = (): ExpandedDependecies => ({
  before: [],
  after: [],
});

const applyDefaults = (dependecies: DependenciesFile) =>
  Object.assign(useEmptyDependecies(), dependecies);

const rxVersion = /^version-(.*)/;
const splitMigrationsAndVersions = A.partition<MigrationRow>((row) =>
  rxVersion.test(row.name),
);

export function filterCompleted(
  completed: Set<string>,
): (m: Migrations) => Migrations {
  if (completed.size === 0) {
    // no files in history
    return identity;
  }

  return ({ once, always }: Migrations): Migrations => ({
    once: once.filter((name) => !completed.has(name)),
    always,
  });
}

export function hasMigrations(m: Migrations): boolean {
  return m.once.length > 0 || m.always.length > 0;
}

export function getDbMigrationsFiles(
  rows: MigrationRow[],
  context: RunContext,
): O.Option<Set<string>> {
  if (doUseVersioning(context)) {
    const { right: versions, left: migrationRows } =
      splitMigrationsAndVersions(rows);

    const latest = versions.at(-1);

    if (latest) {
      const match = latest.name.match(rxVersion);
      if (match?.[1] === context.version) {
        // version matches, all good, bye!
        return O.none;
      }
    }

    return getSomeNames(migrationRows);
  }

  return getSomeNames(rows);
}

function getSomeNames(rows: MigrationRow[]) {
  return O.some(new Set(rows.map((row) => row.name)));
}
