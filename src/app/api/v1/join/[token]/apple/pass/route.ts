import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sha256 } from "@/lib/crypto";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  try {
    // Validate onboarding token
    const tokenHash = sha256(token);
    const onboardingToken = await prisma.onboardingToken.findUnique({
      where: { tokenHash },
      include: { card: true },
    });

    if (
      !onboardingToken ||
      onboardingToken.consumedAt ||
      new Date() > onboardingToken.expiresAt
    ) {
      return NextResponse.json({ error: "Token inválido o expirado" }, { status: 401 });
    }

    // Get Apple Pass
    const applePass = await prisma.applePass.findUnique({
      where: { cardPublicId: onboardingToken.card.publicId },
    });

    if (!applePass) {
      return NextResponse.json(
        { error: "Pass no disponible" },
        { status: 404 }
      );
    }

    // Return pkpass file
    return new NextResponse(applePass.pkpassData, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Content-Disposition": `attachment; filename="salon-loyalty.pkpass"`,
        "Cache-Control": "no-cache, no-store, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error fetching Apple Pass:", error);
    return NextResponse.json(
      { error: "Error al obtener el pass" },
      { status: 500 }
    );
  }
}
