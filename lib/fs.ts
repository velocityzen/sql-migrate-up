import fs from "fs/promises";
import * as TE from "fp-ts/TaskEither";
import * as E from "fp-ts/Either";
import { LazyArg } from "fp-ts/lib/function";
import { mkdirp as mkdirpPromise } from "mkdirp";

export const mkdirp = TE.tryCatchK(mkdirpPromise, E.toError);

export const touch = TE.tryCatchK(
  (path: string) => fs.open(path, "a").then((fd) => fd.close()),
  E.toError,
);

export function instanceOfNodeError(
  value: unknown,
): value is Error & NodeJS.ErrnoException {
  return value !== null && typeof value === "object" && "code" in value;
}

export function toError(value: unknown) {
  return instanceOfNodeError(value) ? value : E.toError(value);
}

export const readDir = TE.tryCatchK(
  (path: string) => fs.readdir(path),
  toError,
);

export const readFile = TE.tryCatchK(
  (filePath: string) => fs.readFile(filePath, "utf8"),
  toError,
);

export function addFileNameToErrorMessage<E extends Error>(file: string) {
  return (error: E): E => {
    error.message += ` File "${file}"`;
    return error;
  };
}

export function ignoreENOENTWith<T>(f: LazyArg<T>) {
  return (e: E.Either<Error, T>): E.Either<Error, T> => {
    if (
      E.isLeft(e) &&
      instanceOfNodeError(e.left) &&
      e.left.code === "ENOENT"
    ) {
      return E.right(f());
    }

    return e;
  };
}
