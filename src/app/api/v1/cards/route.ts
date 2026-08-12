import { NextRequest } from "next/server";
import { Prisma } from "@prisma/client";
import { randomPublicId, randomToken, sha256 } from "@/lib/crypto";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireSalonDevice } from "@/lib/auth";
import { createCardSchema } from "@/lib/validators";

export async function GET() {
  const device = await requireSalonDevice();
  if (!device) {
    return fail(401, "UNAUTHORIZED", "Sesion de salon requerida");
  }

  let cards;

  try {
    cards = await prisma.card.findMany({
      where: {
        status: {
          in: ["ACTIVE", "REWARDED"],
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
      select: {
        publicId: true,
        stampCount: true,
        stampLimit: true,
        status: true,
        rewardName: true,
        customerName: true,
      },
      take: 100,
    });
  } catch {
    return fail(503, "DATABASE_UNAVAILABLE", "La base de datos local no esta disponible todavia");
  }

  return ok({
    cards: cards.map((card) => ({
      card_public_id: card.publicId,
      customer_name: card.customerName || undefined,
      stamp_count: card.stampCount,
      stamp_limit: card.stampLimit,
      status: card.status,
      reward_name: card.rewardName,
    })),
  });
}

export async function POST(request: NextRequest) {
  const device = await requireSalonDevice();
  if (!device) {
    return fail(401, "UNAUTHORIZED", "Sesion de salon requerida");
  }

  const payload = await request.json().catch(() => null);
  const parsed = createCardSchema.safeParse(payload);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Datos de tarjeta invalidos");
  }

  const joinToken = randomToken(32);
  const joinTokenHash = sha256(joinToken);

  const created = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const card = await tx.card.create({
      data: {
        publicId: randomPublicId(20),
        customerName: parsed.data.customer_name || null,
        stampLimit: parsed.data.stamp_limit,
        rewardName: parsed.data.reward_name,
        rewardDescription: parsed.data.reward_description,
        status: "ACTIVE",
        stampCount: 0,
      },
    });

    await tx.onboardingToken.create({
      data: {
        tokenHash: joinTokenHash,
        cardId: card.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });

    await tx.cardEvent.create({
      data: {
        cardId: card.id,
        eventType: "CARD_CREATED",
        actorType: "SALON_DEVICE",
        actorRef: device.id,
        metadata: {},
      },
    });

    return card;
  });

  const normalizedBaseUrl = request.nextUrl.origin.replace(/\/+$/, "");
  const joinUrl = `${normalizedBaseUrl}/join/${created.publicId}`;

  return ok(
    {
      card_public_id: created.publicId,
      stamp_count: created.stampCount,
      stamp_limit: created.stampLimit,
      status: created.status,
      join_url: joinUrl,
    },
    201
  );
}
