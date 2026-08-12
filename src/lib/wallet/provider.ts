export type WalletPlatform = "apple" | "google";

export type WalletCardState = {
  publicId: string;
  stampCount: number;
  stampLimit: number;
  status: "ACTIVE" | "REWARDED" | "REDEEMED" | "DISABLED";
  rewardName: string;
  rewardDescription?: string | null;
};

export interface WalletProvider {
  platform: WalletPlatform;
  createCardArtifacts(state: WalletCardState): Promise<void>;
  getAddToWalletUrl(input: { cardPublicId: string; onboardingToken: string }): Promise<string>;
  updateCard(state: WalletCardState): Promise<void>;
  revokeCard(cardPublicId: string): Promise<void>;
}
