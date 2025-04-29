/*  eslint-disable @typescript-eslint/no-confusing-void-expression */
import { pipe } from "fp-ts/function";
import { expectLeftEither, expectRightEither } from "jest-fp-ts-matchers";
import { describe, expect, test } from "vitest";
import { applyTemplateData } from "../lib/template";

describe("template", () => {
  test("applies data", () =>
    pipe(
      "{{var}}",
      applyTemplateData({ var: "value" }),
      expectRightEither((res) => {
        expect(res).toBe("value");
      }),
    ));

  test("applies more data", () =>
    pipe(
      "{{var}}  {{other}}",
      applyTemplateData({
        var: "value1",
        other: "value2",
      }),
      expectRightEither((res) => {
        expect(res).toBe("value1  value2");
      }),
    ));

  test("error when missing data", () =>
    pipe(
      "{{var}}  {{other}}",
      applyTemplateData({
        var: "value1",
      }),
      expectLeftEither((err) => {
        expect(err.message).toBe(`Found extra parameters (other)`);
      }),
    ));
});
