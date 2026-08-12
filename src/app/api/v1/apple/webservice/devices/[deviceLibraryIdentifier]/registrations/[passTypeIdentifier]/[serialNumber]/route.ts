import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * POST /api/v1/apple/webservice/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber
 * Called by Apple Wallet when user adds a pass to their device
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      deviceLibraryIdentifier: string;
      passTypeIdentifier: string;
      serialNumber: string;
    }>;
  }
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;

  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.APPLE_WALLET_AUTH_TOKEN;

    if (!authHeader || !authHeader.includes(expectedToken || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { pushToken } = body || {};

    if (!pushToken) {
      return NextResponse.json(
        { error: "Push token required" },
        { status: 400 }
      );
    }

    // Find the Apple Pass
    const applePass = await prisma.applePass.findUnique({
      where: { serialNumber },
    });

    if (!applePass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    // Find the Card
    const card = await prisma.card.findUnique({
      where: { publicId: applePass.cardPublicId },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    // Create or update AppleDevice
    const device = await prisma.appleDevice.upsert({
      where: { deviceLibraryId: deviceLibraryIdentifier },
      create: {
        deviceLibraryId: deviceLibraryIdentifier,
        pushToken,
      },
      update: { pushToken },
    });

    // Create AppleRegistration
    const registration = await prisma.appleRegistration.upsert({
      where: {
        deviceLibraryId_cardId: {
          deviceLibraryId: deviceLibraryIdentifier,
          cardId: card.id,
        },
      },
      create: {
        deviceLibraryId: deviceLibraryIdentifier,
        cardId: card.id,
        applePassId: applePass.id,
      },
      update: { applePassId: applePass.id },
    });

    console.log(
      `✓ Device ${deviceLibraryIdentifier} registered for pass ${serialNumber}`
    );

    return NextResponse.json(
      {
        status: "registered",
        deviceLibraryId: deviceLibraryIdentifier,
        passSerialNumber: serialNumber,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error registering Apple device:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/v1/apple/webservice/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber
 * Called by Apple Wallet when user removes a pass from their device
 */
export async function DELETE(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{
      deviceLibraryIdentifier: string;
      passTypeIdentifier: string;
      serialNumber: string;
    }>;
  }
) {
  const { deviceLibraryIdentifier, serialNumber } = await params;

  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.APPLE_WALLET_AUTH_TOKEN;

    if (!authHeader || !authHeader.includes(expectedToken || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Find and delete the registration
    const applePass = await prisma.applePass.findUnique({
      where: { serialNumber },
    });

    if (!applePass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    const card = await prisma.card.findUnique({
      where: { publicId: applePass.cardPublicId },
    });

    if (!card) {
      return NextResponse.json(
        { error: "Card not found" },
        { status: 404 }
      );
    }

    await prisma.appleRegistration.delete({
      where: {
        deviceLibraryId_cardId: {
          deviceLibraryId: deviceLibraryIdentifier,
          cardId: card.id,
        },
      },
    });

    console.log(
      `✓ Device ${deviceLibraryIdentifier} unregistered for pass ${serialNumber}`
    );

    return NextResponse.json({ status: "unregistered" }, { status: 200 });
  } catch (error) {
    console.error("Error unregistering Apple device:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
