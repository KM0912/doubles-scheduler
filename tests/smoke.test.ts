import { describe, expect, it } from "vitest";
import { PACKAGE_NAME } from "../src/index";

describe("smoke", () => {
  it("exports package name", () => {
    expect(PACKAGE_NAME).toBe("doubles-scheduler");
  });
});
