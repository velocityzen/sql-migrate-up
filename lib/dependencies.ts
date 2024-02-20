import * as J from "fp-ts/Json";
import * as E from "fp-ts/Either";
import { pipe, flow } from "fp-ts/function";
import * as t from "io-ts";
import { excess } from "io-ts-excess";
import { nonEmptyArray, NonEmptyString, withMessage } from "io-ts-types";
import { Dependecies } from "./types";

const nonEmptyArrayOfStrings = nonEmptyArray(NonEmptyString);

const DependenciesObject = t.union([
  excess(
    t.type({
      before: nonEmptyArrayOfStrings,
      after: nonEmptyArrayOfStrings,
    }),
  ),
  excess(
    t.type({
      before: nonEmptyArrayOfStrings,
    }),
  ),
  excess(
    t.type({
      after: nonEmptyArrayOfStrings,
    }),
  ),
]);

export const DependenciesFile = withMessage(
  Json(DependenciesObject),
  () => `failed to parse ${Dependecies} files`,
);
export type DependenciesFile = t.TypeOf<typeof DependenciesFile>;

function Json<A, O = A, I = unknown>(
  codec: t.Type<A, O, I>,
  name = `${codec.name} from JSON`,
): t.Type<A, string, unknown> {
  return new t.Type(
    name,
    codec.is,
    (u, c) =>
      pipe(
        t.string.validate(u, c),
        E.flatMap(J.parse),
        E.match(
          () => t.failure(u, c, "failed to parse json from string"),
          (some) => codec.validate(some as I, c),
        ),
      ),
    flow(
      codec.encode,
      J.stringify,
      E.getOrElse(() => ""),
    ),
  );
}
