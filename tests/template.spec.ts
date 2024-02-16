import { applyData } from "../lib/template";

describe("template", () => {
  test("applies data", () => {
    const res = applyData("file", "{{var}}", { var: "value" });
    expect(res).toBe("value");
  });

  test("applies more data", () => {
    const res = applyData("file", "{{var}}  {{other}}", {
      var: "value1",
      other: "value2",
    });
    expect(res).toBe("value1  value2");
  });

  test("throws error when missing data", () => {
    const test = () =>
      applyData("file", "{{var}}  {{other}}", {
        var: "value1",
      });

    expect(test).toThrow(`Found extra parameters (other) in "file"`);
  });
});
