import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { env } from "@/lib/env";
import { parseSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";

export async function requireSalonDevice() {
  const cookieStore = await cookies();
  const raw = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  const parsed = parseSessionCookieValue(raw, env.SALON_SESSION_SECRET);
  if (!parsed.valid || !parsed.deviceId) {
    return null;
  }

  let device = null;

  try {
    device = await prisma.salonDevice.findUnique({
      where: { id: parsed.deviceId },
    });
  } catch {
    return null;
  }

  if (!device || device.status !== "ACTIVE") {
    return null;
  }

  return device;
}
