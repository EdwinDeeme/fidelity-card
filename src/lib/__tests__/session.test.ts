import { describe, expect, it } from "vitest";
import { buildSessionCookieValue, parseSessionCookieValue } from "@/lib/session";

describe("session helpers", () => {
  const secret = "a-very-long-session-secret-that-is-not-short";

  it("firma y valida cookie", () => {
    const cookie = buildSessionCookieValue("device-123", secret);
    const parsed = parseSessionCookieValue(cookie, secret);

    expect(parsed.valid).toBe(true);
    expect(parsed.deviceId).toBe("device-123");
  });

  it("rechaza firma alterada", () => {
    const cookie = buildSessionCookieValue("device-123", secret);
    const tampered = cookie.replace("device-123", "device-xyz");
    const parsed = parseSessionCookieValue(tampered, secret);

    expect(parsed.valid).toBe(false);
  });
});
