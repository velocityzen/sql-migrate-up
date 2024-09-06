import BetterSqlite3, { Database as DatabaseClient } from "better-sqlite3";
import * as E from "fp-ts/Either";
import { constVoid, flow } from "fp-ts/function";

// export type DatabaseClient = BetterSqlite3.Database;
export type DatabaseStatement<
  Parameters,
  Row = unknown,
> = BetterSqlite3.Statement<Parameters[], Row>;

export function createSqlLiteClient(where: string): DatabaseClient {
  return new BetterSqlite3(where);
}

export function queryAll<Result>(
  query: string,
): (db: DatabaseClient) => E.Either<Error, Result[]> {
  return E.tryCatchK((db) => db.prepare<[], Result>(query).all(), E.toError);
}

export function queryExec(
  query: string,
): (db: DatabaseClient) => E.Either<Error, void> {
  return flow(
    E.tryCatchK((db) => db.exec(query), E.toError),
    // eslint-disable-next-line @typescript-eslint/no-confusing-void-expression
    E.as(constVoid()),
  );
}
