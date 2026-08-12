import { WalletCardState, WalletProvider } from "@/lib/wallet/provider";

export class GoogleWalletProvider implements WalletProvider {
  platform = "google" as const;

  async createCardArtifacts(_state: WalletCardState): Promise<void> {
    // TODO(fase-5): Crear/validar LoyaltyClass y LoyaltyObject.
  }

  async getAddToWalletUrl(_input: {
    cardPublicId: string;
    onboardingToken: string;
  }): Promise<string> {
    // TODO(fase-5): Generar JWT firmado y URL https://pay.google.com/gp/v/save/{jwt}.
    return "";
  }

  async updateCard(_state: WalletCardState): Promise<void> {
    // TODO(fase-5): PATCH LoyaltyObject con nuevo balance/estado.
  }

  async revokeCard(_cardPublicId: string): Promise<void> {
    // TODO(fase-5): Cambiar state del LoyaltyObject a inactivo/revocado segun API.
  }
}
