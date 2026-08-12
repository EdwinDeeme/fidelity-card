import { WalletCardState, WalletProvider } from "@/lib/wallet/provider";
import { generateApplePass, type ApplePassConfig, type ApplePassState } from "@/lib/wallet/apple-pass";
import { prisma } from "@/lib/prisma";

// For MVP, we'll use a mock APNs client
// In production, implement real APNs with apple-push-notifications or similar
class MockAPNsClient {
  send(notification: any, token: string): Promise<void> {
    console.log(`📱 Mock APNs: Sending to ${token}:`, notification);
    return Promise.resolve();
  }
}

export class AppleWalletProvider implements WalletProvider {
  platform = "apple" as const;
  private apnClient: MockAPNsClient;

  constructor() {
    // Initialize mock APNs client for MVP
    this.apnClient = new MockAPNsClient();
  }

  async createCardArtifacts(state: WalletCardState): Promise<void> {
    const config = this.buildPassConfig();
    const passState = this.mapCardStateToPassState(state);

    try {
      const pkpassBuffer = await generateApplePass(config, passState);

      // Store pkpass in database
      await prisma.applePass.upsert({
        where: { cardPublicId: state.publicId },
        create: {
          cardPublicId: state.publicId,
          serialNumber: passState.serialNumber,
          passTypeId: config.passTypeIdentifier,
          pkpassData: Buffer.from(pkpassBuffer),
          status: "ACTIVE",
        },
        update: {
          pkpassData: Buffer.from(pkpassBuffer),
          stampCount: state.stampCount,
        },
      });

      console.log(`✓ Apple Pass created for card ${state.publicId}`);
    } catch (error) {
      console.error("Error creating Apple Pass:", error);
      throw new Error("Failed to create Apple Wallet pass");
    }
  }

  async getAddToWalletUrl(input: {
    cardPublicId: string;
    onboardingToken: string;
  }): Promise<string> {
    // Return URL to download .pkpass file
    return `/api/v1/join/${input.onboardingToken}/apple/pass`;
  }

  async updateCard(state: WalletCardState): Promise<void> {
    try {
      // Regenerate pass with updated state
      const config = this.buildPassConfig();
      const passState = this.mapCardStateToPassState(state);

      const pkpassBuffer = await generateApplePass(config, passState);

      // Update stored pass
      await prisma.applePass.update({
        where: { cardPublicId: state.publicId },
        data: {
          pkpassData: Buffer.from(pkpassBuffer),
          stampCount: state.stampCount,
          updatedAt: new Date(),
        },
      });

      // Push update notification to registered devices
      await this.pushUpdateNotification(state.publicId);

      console.log(`✓ Apple Pass updated for card ${state.publicId}`);
    } catch (error) {
      console.error("Error updating Apple Pass:", error);
      throw new Error("Failed to update Apple Wallet pass");
    }
  }

  async revokeCard(cardPublicId: string): Promise<void> {
    try {
      // Mark pass as voided
      await prisma.applePass.update({
        where: { cardPublicId },
        data: { status: "VOIDED" },
      });

      // Notify registered devices
      const registrations = await prisma.appleRegistration.findMany({
        where: { applePass: { cardPublicId } },
        include: { device: true },
      });

      for (const reg of registrations) {
        if (reg.device.pushToken) {
          const notification = {
            alert: "Tu tarjeta ha sido deshabilitada",
            badge: 0,
          };
          await this.apnClient.send(notification, reg.device.pushToken);
        }
      }

      console.log(`✓ Apple Pass revoked for card ${cardPublicId}`);
    } catch (error) {
      console.error("Error revoking Apple Pass:", error);
      throw new Error("Failed to revoke Apple Wallet pass");
    }
  }

  private async pushUpdateNotification(cardPublicId: string): Promise<void> {
    const registrations = await prisma.appleRegistration.findMany({
      where: { applePass: { cardPublicId } },
      include: { device: true },
    });

    for (const reg of registrations) {
      if (!reg.device.pushToken) continue;

      const notification = {
        alert: "Tu tarjeta de fidelización ha sido actualizada",
        badge: 1,
        sound: "default",
      };

      try {
        await this.apnClient.send(notification, reg.device.pushToken);
      } catch (error) {
        console.error(`Failed to send APNs to ${reg.device.pushToken}:`, error);
      }
    }
  }

  private buildPassConfig(): ApplePassConfig {
    return {
      passTypeIdentifier: process.env.APPLE_PASS_TYPE_ID || "pass.com.salonnails.loyalty",
      teamIdentifier: process.env.APPLE_TEAM_ID || "",
      serialNumber: `card-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: "Salon Nails",
      description: "Tarjeta de Fidelización",
      logoFile: `${process.cwd()}/public/apple-wallet/logo.png`,
      iconFile: `${process.cwd()}/public/apple-wallet/icon.png`,
      certificatePem: process.env.APPLE_CERT_PEM || "",
      certificateKey: process.env.APPLE_KEY_PEM || "",
    };
  }

  private mapCardStateToPassState(state: WalletCardState): ApplePassState {
    return {
      serialNumber: state.publicId,
      stampCount: state.stampCount,
      stampLimit: state.stampLimit,
      rewardName: state.rewardName,
      status: state.status,
    };
  }
}
