import { getOrElseW } from "fp-ts/Either";
import { pipe } from "fp-ts/function";
import * as t from "io-ts";
import { DependenciesFile } from "../lib/dependencies";

/**
 * returns value if succeed or undefined otherwise
 **/
function decode<A, O>(
  { decode }: t.Type<A, O, unknown>,
  value: unknown,
): undefined | A {
  return pipe(
    value,
    decode,
    getOrElseW(() => undefined),
  );
}

describe("Dependencies", () => {
  test("happy", async () => {
    expect(decode(DependenciesFile, `{"before":["path"]}`)).toEqual({
      before: ["path"],
    });

    expect(decode(DependenciesFile, `{"after":["path"]}`)).toEqual({
      after: ["path"],
    });

    expect(
      decode(DependenciesFile, `{"after":["path"], "before":["path"]}`),
    ).toEqual({
      after: ["path"],
      before: ["path"],
    });
  });

  test("sad", async () => {
    expect(decode(DependenciesFile, `{"after":[]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"after":[""]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"before":[]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"before":[""]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, ``)).toEqual(undefined);
    expect(decode(DependenciesFile, `{}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"some": ["type"]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"aafter":["path"]}`)).toEqual(undefined);
    expect(decode(DependenciesFile, `{"beforr":["path"]}`)).toEqual(undefined);

    // typos
    expect(
      decode(DependenciesFile, `{"aafter":["path"], "before":["path"]}`),
    ).toEqual(undefined);
    expect(
      decode(DependenciesFile, `{"after":["path"], "bbefore":["path"]}`),
    ).toEqual(undefined);
  });
});
