import { createHmac, timingSafeEqual } from "node:crypto";

const SALON_SESSION_COOKIE = "salon_session";

function sign(payload: string, secret: string): string {
  return createHmac("sha256", secret).update(payload).digest("base64url");
}

export function buildSessionCookieValue(deviceId: string, secret: string): string {
  const payload = deviceId;
  const sig = sign(payload, secret);
  return `${payload}.${sig}`;
}

export function parseSessionCookieValue(
  rawCookieValue: string | undefined,
  secret: string
): { valid: boolean; deviceId?: string } {
  if (!rawCookieValue) {
    return { valid: false };
  }

  const [payload, providedSig] = rawCookieValue.split(".");
  if (!payload || !providedSig) {
    return { valid: false };
  }

  const expectedSig = sign(payload, secret);
  const a = Buffer.from(expectedSig);
  const b = Buffer.from(providedSig);

  if (a.length !== b.length) {
    return { valid: false };
  }

  if (!timingSafeEqual(a, b)) {
    return { valid: false };
  }

  return { valid: true, deviceId: payload };
}

export const SESSION_COOKIE_NAME = SALON_SESSION_COOKIE;
