import * as E from "fp-ts/Either";
import * as T from "fp-ts/Task";
import * as TE from "fp-ts/TaskEither";

const isEither = (a: unknown): a is E.Either<Error, unknown> =>
  Boolean(
    a &&
      typeof a === "object" &&
      "_tag" in a &&
      (a._tag === "Left" || a._tag === "Right"),
  );

export function testTaskEither<E, A>(
  createTest: () => T.Task<A> | TE.TaskEither<E, A>,
) {
  return async () => {
    const test = createTest();
    const result = await test();

    if (isEither(result) && E.isLeft(result)) {
      throw result.left;
    }
  };
}
