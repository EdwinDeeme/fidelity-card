import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Web Service endpoint for Apple Wallet
 * POST /api/v1/apple/webservice/passes/:passTypeIdentifier/:serialNumber/log
 * Called by Wallet app to log events (e.g., pass viewed)
 */
export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
  }
) {
  const { passTypeIdentifier, serialNumber } = await params;

  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.APPLE_WALLET_AUTH_TOKEN;

    if (!authHeader || !authHeader.includes(expectedToken || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { logs } = body || {};

    // Log the events from the Wallet app
    console.log(`Apple Wallet log for pass ${serialNumber}:`, logs);

    // Find the Apple Pass and update if needed
    const applePass = await prisma.applePass.findUnique({
      where: { serialNumber },
    });

    if (!applePass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    // Track that pass was viewed/accessed
    await prisma.cardEvent.create({
      data: {
        cardId: (
          await prisma.card.findUnique({
            where: { publicId: applePass.cardPublicId },
          })
        )!.id,
        eventType: "ONBOARDING_COMPLETED",
        actorType: "WALLET_APP",
        actorRef: serialNumber,
        metadata: { logs },
      },
    });

    return NextResponse.json({ status: "success" }, { status: 200 });
  } catch (error) {
    console.error("Error in Apple Web Service log endpoint:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * GET /api/v1/apple/webservice/passes/:passTypeIdentifier/:serialNumber
 * Called by Wallet to check for pass updates
 * Returns latest pass data if updated
 */
export async function GET(
  req: NextRequest,
  {
    params,
  }: {
    params: Promise<{ passTypeIdentifier: string; serialNumber: string }>;
  }
) {
  const { serialNumber } = await params;

  try {
    const authHeader = req.headers.get("authorization");
    const expectedToken = process.env.APPLE_WALLET_AUTH_TOKEN;

    if (!authHeader || !authHeader.includes(expectedToken || "")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const lastModifiedStr = req.nextUrl.searchParams.get("lastModified");
    const lastModified = lastModifiedStr ? new Date(lastModifiedStr) : null;

    const applePass = await prisma.applePass.findUnique({
      where: { serialNumber },
    });

    if (!applePass) {
      return NextResponse.json({ error: "Pass not found" }, { status: 404 });
    }

    // Check if pass has been modified since lastModified
    if (lastModified && applePass.updatedAt <= lastModified) {
      // No changes, return 304 Not Modified
      return NextResponse.json({}, { status: 304 });
    }

    // Return updated pass file
    return new NextResponse(applePass.pkpassData, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.apple.pkpass",
        "Last-Modified": applePass.updatedAt.toUTCString(),
      },
    });
  } catch (error) {
    console.error("Error in Apple Web Service GET:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
