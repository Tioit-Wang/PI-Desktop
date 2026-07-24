import { describe, expect, it } from "vitest";
import { err, ok } from "./errors.js";

describe("result helpers", () => {
  it("creates ok results", () => {
    expect(ok(1)).toEqual({ ok: true, data: 1 });
  });

  it("creates error results", () => {
    const result = err("NOT_FOUND", "missing");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe("NOT_FOUND");
    }
  });
});
