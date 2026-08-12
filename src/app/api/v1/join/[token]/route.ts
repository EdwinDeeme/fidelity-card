import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;

  // Primero, intentar como publicId (uso directo del salon)
  let card = await prisma.card.findUnique({
    where: { publicId: token },
  });

  // Si no existe como publicId, intentar como token hash (onboarding)
  if (!card) {
    const tokenHash = sha256(token);
    const onboarding = await prisma.onboardingToken.findUnique({
      where: { tokenHash },
      include: {
        card: true,
      },
    });

    if (!onboarding) {
      return fail(404, "TOKEN_NOT_FOUND", "Codigo no valido");
    }

    if (onboarding.consumedAt) {
      return fail(410, "TOKEN_ALREADY_USED", "Este codigo ya fue utilizado");
    }

    if (onboarding.expiresAt.getTime() < Date.now()) {
      return fail(410, "TOKEN_EXPIRED", "Este codigo expiro");
    }

    card = onboarding.card;
  }

  const response = ok({
    card_public_id: card.publicId,
    customer_name: card.customerName || undefined,
    stamp_count: card.stampCount,
    stamp_limit: card.stampLimit,
    reward_name: card.rewardName,
    reward_description: card.rewardDescription || undefined,
    status: card.status,
  });

  response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  response.headers.set("Pragma", "no-cache");
  response.headers.set("Expires", "0");

  return response;
}
