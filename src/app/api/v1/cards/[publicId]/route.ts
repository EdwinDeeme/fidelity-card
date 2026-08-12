import { NextRequest } from "next/server";
import { fail, ok } from "@/lib/http";
import { prisma } from "@/lib/prisma";
import { requireSalonDevice } from "@/lib/auth";
import { z } from "zod";

const updateCardSchema = z.object({
  stamp_limit: z.number().int().min(1).max(20).optional(),
  customer_name: z.string().min(2).max(120).optional().nullable(),
  reward_name: z.string().min(3).optional(),
  reward_description: z.string().optional().nullable(),
});

export async function GET(request: NextRequest, props: { params: Promise<{ publicId: string }> }) {
  const params = await props.params;
  const device = await requireSalonDevice();
  if (!device) {
    return fail(401, "UNAUTHORIZED", "Sesion de salon requerida");
  }

  try {
    const card = await prisma.card.findUnique({
      where: { publicId: params.publicId },
      select: {
        publicId: true,
        stampCount: true,
        stampLimit: true,
        status: true,
        rewardName: true,
        customerName: true,
        rewardDescription: true,
      },
    });

    if (!card) {
      return fail(404, "NOT_FOUND", "Tarjeta no encontrada");
    }

    return ok({
      card_public_id: card.publicId,
      customer_name: card.customerName || undefined,
      stamp_count: card.stampCount,
      stamp_limit: card.stampLimit,
      status: card.status,
      reward_name: card.rewardName,
      reward_description: card.rewardDescription || undefined,
    });
  } catch {
    return fail(503, "DATABASE_UNAVAILABLE", "La base de datos no está disponible");
  }
}

export async function PATCH(request: NextRequest, props: { params: Promise<{ publicId: string }> }) {
  const params = await props.params;
  const device = await requireSalonDevice();
  if (!device) {
    return fail(401, "UNAUTHORIZED", "Sesion de salon requerida");
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return fail(400, "INVALID_JSON", "Body inválido");
  }

  const parsed = updateCardSchema.safeParse(body);
  if (!parsed.success) {
    return fail(400, "VALIDATION_ERROR", "Datos inválidos");
  }

  try {
    const card = await prisma.card.findUnique({
      where: { publicId: params.publicId },
    });

    if (!card) {
      return fail(404, "NOT_FOUND", "Tarjeta no encontrada");
    }

    const updated = await prisma.card.update({
      where: { publicId: params.publicId },
      data: {
        stampLimit: parsed.data.stamp_limit ?? card.stampLimit,
        customerName: parsed.data.customer_name !== undefined ? parsed.data.customer_name : card.customerName,
        rewardName: parsed.data.reward_name ?? card.rewardName,
        rewardDescription: parsed.data.reward_description !== undefined ? parsed.data.reward_description : card.rewardDescription,
      },
      select: {
        publicId: true,
        stampCount: true,
        stampLimit: true,
        status: true,
        rewardName: true,
        customerName: true,
        rewardDescription: true,
      },
    });

    return ok({
      card_public_id: updated.publicId,
      customer_name: updated.customerName || undefined,
      stamp_count: updated.stampCount,
      stamp_limit: updated.stampLimit,
      status: updated.status,
      reward_name: updated.rewardName,
      reward_description: updated.rewardDescription || undefined,
    });
  } catch {
    return fail(503, "DATABASE_UNAVAILABLE", "La base de datos no está disponible");
  }
}
