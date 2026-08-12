import { NextRequest } from "next/server";
import { fail } from "@/lib/http";

export async function POST(
  _request: NextRequest,
  _context: { params: Promise<{ token: string }> }
) {
  return fail(
    501,
    "APPLE_WALLET_NOT_IMPLEMENTED",
    "Apple Wallet estara disponible en la Fase 4"
  );
}
