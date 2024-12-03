import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { toMessage } from "./helpers";

/**
 *  fp-ts helper to bridge Tasks and commander.
 *  Throws on left.
 **/
export function createActionFor<R, A = Record<string, unknown>, C = void>(
  createTask: (
    args: A,
    context: C,
  ) => TE.TaskEither<Error | readonly Error[], R>,
  errorMessage = "Failed",
) {
  return async (args: A, context: C) => {
    const task = createTask(args, context);
    const result = await task();

    if (E.isLeft(result)) {
      const errors = Array.isArray(result.left) ? result.left : [result.left];
      errors.forEach((error) => {
        console.info(`${errorMessage}: `, toMessage(error));
      });
      process.exit(1);
    }
  };
}
