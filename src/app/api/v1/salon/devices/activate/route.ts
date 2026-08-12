import { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { buildSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";
import { sha256 } from "@/lib/crypto";
import { activateDeviceSchema } from "@/lib/validators";

const ACTIVATION_CODE_HASH_ENV = "SALON_ACTIVATION_CODE_HASH";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = activateDeviceSchema.safeParse(payload);

  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Datos de activacion invalidos");
  }

  const expectedActivationHash = process.env[ACTIVATION_CODE_HASH_ENV];
  if (!expectedActivationHash || expectedActivationHash.length !== 64) {
    return fail(500, "CONFIG_ERROR", "Activation code hash no configurado");
  }

  const inputActivationHash = sha256(parsed.data.activation_code);
  const inputPinHash = sha256(parsed.data.pin);

  if (inputActivationHash !== expectedActivationHash) {
    return fail(401, "INVALID_ACTIVATION_CODE", "Codigo de activacion invalido");
  }

  if (inputPinHash !== env.SALON_PIN_HASH) {
    return fail(401, "INVALID_PIN", "PIN invalido");
  }

  const deviceSecret = crypto.randomUUID().replaceAll("-", "") + crypto.randomUUID().replaceAll("-", "");

  const device = await prisma.salonDevice.create({
    data: {
      deviceName: parsed.data.device_name,
      deviceSecretHash: sha256(deviceSecret),
    },
  });

  const sessionCookie = buildSessionCookieValue(device.id, env.SALON_SESSION_SECRET);

  const response = ok({
    device_id: device.id,
    status: device.status,
  });

  const isSecureRequest = request.nextUrl.protocol === "https:";

  response.cookies.set({
    name: SESSION_COOKIE_NAME,
    value: sessionCookie,
    httpOnly: true,
    sameSite: "lax",
    secure: isSecureRequest,
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  return response;
}
