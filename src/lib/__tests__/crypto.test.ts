import { describe, expect, it } from "vitest";
import { randomPublicId, randomToken, sha256 } from "@/lib/crypto";

describe("crypto helpers", () => {
  it("genera public id no incremental", () => {
    const a = randomPublicId(20);
    const b = randomPublicId(20);

    expect(a).not.toEqual(b);
    expect(a).toMatch(/^[a-f0-9]+$/);
    expect(a.length).toBe(40);
  });

  it("genera onboarding token url-safe", () => {
    const token = randomToken(32);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("hash sha256 estable", () => {
    const x = sha256("abc");
    const y = sha256("abc");
    expect(x).toEqual(y);
    expect(x.length).toBe(64);
  });
});
