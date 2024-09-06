import * as AP from "fp-ts/Apply";
import * as A from "fp-ts/Array";
import * as E from "fp-ts/Either";
import { constant, constVoid, flow, pipe, tuple } from "fp-ts/function";
import * as IO from "fp-ts/IO";
import * as IOO from "fp-ts/IOOption";
import * as O from "fp-ts/Option";
import * as RA from "fp-ts/ReadonlyArray";
import * as ROA from "fp-ts/ReadonlyArray";
import * as RNEA from "fp-ts/ReadonlyNonEmptyArray";
import * as S from "fp-ts/string";
import { evolve } from "fp-ts/struct";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";
import path from "path";
import { DependenciesFile } from "./dependencies";
import { ignoreENOENTWith, readDir, readFile } from "./fs";
import { fromValidation, getTable } from "./helpers";
import { loadTemplate } from "./template";
import {
  Context,
  Dependecies,
  MigrationRow,
  MigrationsContext,
  Parameters,
  RunAlways,
  RunOnce,
  useVersioning,
} from "./types";

interface Migrations {
  once: string[];
  always: string[];
}

export function queryCompletedMigrations({
  select,
  schema,
  table,
}: Context): TE.TaskEither<
  Error,
  O.Option<RNEA.ReadonlyNonEmptyArray<string>>
> {
  return pipe(
    select<Pick<MigrationRow, "name">>(`
      select distinct name as "name"
      from ${getTable(schema, table)}
      order by created_at, name;
    `),
    TE.map(
      flow(
        A.map((row) => row.name),
        RNEA.fromArray,
      ),
    ),
  );
}

export interface GetMigrationsPathOptions
  extends Pick<MigrationsContext, "schema" | "folder"> {
  runAlways?: boolean;
}

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

function checkMigrationFiles(files: string[]): E.Either<Error, string[]> {
  const sqlFiles = pipe(
    files,
    A.filter((file) => path.basename(file).endsWith(".sql")),
    A.sort(S.Ord),
  );

  const rxMigrationFiles = /^\d+[-_].*\.sql$/;
  const migrationFiles = pipe(
    sqlFiles,
    A.filter((file: string) => rxMigrationFiles.test(path.basename(file))),
  );

  const diff = pipe(sqlFiles, A.difference(S.Eq)(migrationFiles));
  if (diff.length) {
    return E.left(
      Error(
        `Found migration files that do not start with a number and will not be ran: \n${diff.join(
          "\n",
        )}`,
      ),
    );
  }

  return E.right(migrationFiles);
}

function getMigrationsFiles(
  context: GetMigrationsPathOptions,
  runAlways = false,
): TE.TaskEither<Error, string[]> {
  const migrationsPath = getMigrationsPath({ ...context, runAlways });

  return pipe(
    migrationsPath,
    readDir,
    T.map(ignoreENOENTWith(constant<string[]>([]))),
    TE.flatMapEither(checkMigrationFiles),
    TE.map(A.map((fileName) => path.join(migrationsPath, fileName))),
  );
}

function getMigrations(
  context: GetMigrationsPathOptions,
): TE.TaskEither<Error, Migrations> {
  return pipe(
    {
      once: getMigrationsFiles(context),
      always: getMigrationsFiles(context, true),
    },
    AP.sequenceS(TE.ApplyPar),
  );
}

const useEmptyMigrations = (): readonly Migrations[] => [];

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

interface ExpandedDependencies {
  before: readonly Migrations[];
  after: readonly Migrations[];
}

const useEmptyDependecies = (): ExpandedDependencies => ({
  before: [],
  after: [],
});

const applyDefaults = (dependencies: DependenciesFile) =>
  Object.assign(useEmptyDependecies(), dependencies);

function getDependencies(context: GetMigrationsPathOptions) {
  return pipe(
    context,
    getMigrationsPath,
    (migrationsPath) => path.join(migrationsPath, Dependecies),
    readFile,
    /* eslint-disable-next-line @typescript-eslint/unbound-method  */
    TE.flatMapEither(flow(DependenciesFile.decode, fromValidation)),
    TE.flatMap(
      flow(
        applyDefaults,
        evolve({
          before: getDependenciesMigrations,
          after: getDependenciesMigrations,
        }),
        AP.sequenceS(TE.ApplyPar),
      ),
    ),
    T.map(ignoreENOENTWith(useEmptyDependecies)),
  );
}

export function getAllMigrations(
  context: GetMigrationsPathOptions,
): TE.TaskEither<Error, O.Option<RNEA.ReadonlyNonEmptyArray<Migrations>>> {
  return pipe(
    getMigrations(context),
    TE.bindTo("local"),
    TE.bind("dependencies", () => getDependencies(context)),
    TE.map(({ local, dependencies }) =>
      pipe(
        dependencies.before,
        ROA.concat(ROA.of(local)),
        ROA.concat(dependencies.after),
        RNEA.fromReadonlyArray,
      ),
    ),
  );
}

function checkVersionFor(context: Context) {
  return (
    completed: RNEA.ReadonlyNonEmptyArray<string>,
  ): O.Option<Set<string>> => {
    if (!useVersioning(context)) {
      return O.some(new Set(completed));
    }

    const rxVersion = /^version-(.*)/;

    const { completedVersion, completedMigrations } = pipe(
      completed,
      ROA.partition<string>((row) => rxVersion.test(row)),
      ({ right: versions, left: completedMigrations }) => {
        const latest = versions.at(-1) ?? "";

        return {
          completedVersion: rxVersion.exec(latest)?.[1],
          completedMigrations,
        };
      },
    );

    if (completedVersion === context.version) {
      return O.none;
    }

    return O.some(new Set(completedMigrations));
  };
}

export function filterCompletedFor(
  context: Context,
  migrations: RNEA.ReadonlyNonEmptyArray<Migrations>,
) {
  return (
    completed: RNEA.ReadonlyNonEmptyArray<string>,
  ): O.Option<RNEA.ReadonlyNonEmptyArray<Migrations>> =>
    pipe(
      completed,
      checkVersionFor(context),
      O.match(
        () => O.none,
        (completed) =>
          pipe(
            migrations,
            RA.map(
              ({ once, always }: Migrations): Migrations => ({
                once: once.filter((name) => !completed.has(name)),
                always,
              }),
            ),
            RA.filter(hasMigrations),
            RNEA.fromReadonlyArray,
          ),
      ),
    );
}

export function hasMigrations(m: undefined | Migrations): boolean {
  return m !== undefined && (m.once.length > 0 || m.always.length > 0);
}

const foldMigrations: (
  migrations: RNEA.ReadonlyNonEmptyArray<Migrations>,
) => readonly [string, boolean][] = RA.foldMap(
  RA.getMonoid<[string, boolean]>(),
)(({ once, always }) =>
  pipe(
    once,
    RA.map((filePath) => tuple(filePath, true)),
    RA.concat(
      pipe(
        always,
        RA.map((filePath) => tuple(filePath, false)),
      ),
    ),
  ),
);

export function applyMigrationsWith(
  context: Context,
  onMigrationApplied?: (fileName: string) => IO.IO<void>,
) {
  return (
    migrations: RNEA.ReadonlyNonEmptyArray<Migrations>,
  ): TE.TaskEither<Error, number> =>
    pipe(
      TE.of(context),
      TE.bind("templateData", (context) => context.parameters(context)),
      TE.flatMap(({ templateData }) =>
        pipe(
          migrations,
          foldMigrations,
          TE.traverseSeqArray((migration) =>
            pipe(
              migration,
              applyMigrationWith(context, templateData),
              TE.tapIO(() =>
                pipe(
                  onMigrationApplied,
                  IOO.fromNullable,
                  IOO.flatMapIO((on) => on(migration[0])),
                ),
              ),
            ),
          ),
        ),
      ),
      TE.map((res) => res.length),
    );
}

function applyMigrationWith(
  { exec, schema, table, now }: Context,
  data: Parameters,
) {
  return ([filePath, saveMigration]: [string, boolean]): TE.TaskEither<
    Error,
    void
  > =>
    pipe(
      loadTemplate(filePath, data),
      TE.flatMap(exec),
      TE.flatMap(() =>
        pipe(
          saveMigration,
          O.fromPredicate(Boolean),
          O.match(
            // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
            () => TE.right(constVoid()),
            () =>
              exec(`
                insert into ${getTable(schema, table)}
                values ('${filePath}', ${now ? now : "CURRENT_TIMESTAMP"});
              `),
          ),
        ),
      ),
    );
}
