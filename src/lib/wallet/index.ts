import { AppleWalletProvider } from "@/lib/wallet/apple-provider";
import { GoogleWalletProvider } from "@/lib/wallet/google-provider";
import { WalletProvider } from "@/lib/wallet/provider";

export function getWalletProviders(): WalletProvider[] {
  return [new AppleWalletProvider(), new GoogleWalletProvider()];
}
