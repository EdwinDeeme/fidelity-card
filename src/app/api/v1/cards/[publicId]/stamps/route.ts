import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireSalonDevice } from "@/lib/auth";
import { stampSchema } from "@/lib/validators";

const IDEMPOTENCY_HEADER = "idempotency-key";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ publicId: string }> }
) {
  const device = await requireSalonDevice();
  if (!device) {
    return fail(401, "UNAUTHORIZED", "Sesion de salon requerida");
  }

  const idempotencyKey = request.headers.get(IDEMPOTENCY_HEADER);
  if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 80) {
    return fail(400, "INVALID_IDEMPOTENCY_KEY", "Idempotency-Key obligatorio");
  }

  const payload = await request.json().catch(() => null);
  const parsed = stampSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Operacion invalida");
  }

  const { publicId } = await context.params;

  try {
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const card = await tx.card.findUnique({
        where: { publicId },
      });

      if (!card) {
        return { type: "not_found" as const };
      }

      if (card.status !== "ACTIVE" && card.status !== "REWARDED") {
        return { type: "invalid_status" as const, card };
      }

      const duplicate = await tx.cardEvent.findFirst({
        where: {
          cardId: card.id,
          idempotencyKey,
        },
      });

      if (duplicate) {
        const latest = await tx.card.findUnique({ where: { id: card.id } });
        return { type: "duplicate" as const, card: latest ?? card };
      }

      const nextStamp = card.stampCount + 1;
      const nextStatus = nextStamp >= card.stampLimit ? "REWARDED" : "ACTIVE";

      const updated = await tx.card.update({
        where: { id: card.id },
        data: {
          stampCount: nextStamp,
          status: nextStatus,
          updateTag: {
            increment: BigInt(1),
          },
        },
      });

      await tx.cardEvent.create({
        data: {
          cardId: card.id,
          eventType: "STAMP_ADDED",
          idempotencyKey,
          actorType: "SALON_DEVICE",
          actorRef: device.id,
          metadata: {
            before: card.stampCount,
            after: updated.stampCount,
          },
        },
      });

      return { type: "ok" as const, card: updated };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
    });

    if (result.type === "not_found") {
      return fail(404, "CARD_NOT_FOUND", "No se encontro la tarjeta");
    }

    if (result.type === "invalid_status") {
      return fail(409, "CARD_INVALID_STATUS", "La tarjeta no permite agregar sellos");
    }

    return ok({
      duplicated: result.type === "duplicate",
      card_public_id: result.card.publicId,
      stamp_count: result.card.stampCount,
      stamp_limit: result.card.stampLimit,
      status: result.card.status,
    });
  } catch {
    return fail(409, "CONCURRENCY_CONFLICT", "No se pudo procesar por concurrencia. Intenta de nuevo");
  }
}
