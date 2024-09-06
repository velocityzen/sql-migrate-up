import * as E from "fp-ts/Either";
import * as TE from "fp-ts/TaskEither";
import { toMessage } from "./helpers";

/**
 *  fp-ts helper to bridge Tasks and commander.
 *  Throws on left.
 **/
export function createActionFor<R, A = Record<string, unknown>, C = void>(
  createTask: (args: A, context: C) => TE.TaskEither<Error, R>,
  errorMessage = "Failed",
) {
  return async (args: A, context: C) => {
    const task = createTask(args, context);
    const result = await task();

    if (E.isLeft(result)) {
      console.info(`${errorMessage}: `, toMessage(result.left));
      process.exit(1);
    }
  };
}
