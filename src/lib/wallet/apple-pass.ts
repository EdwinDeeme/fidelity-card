import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

// eslint-disable-next-line @typescript-eslint/no-var-requires
const archiver = require("archiver");

export type ApplePassConfig = {
  passTypeIdentifier: string; // com.apple.loyalty.card
  teamIdentifier: string; // Apple Team ID
  serialNumber: string; // Unique per pass
  organizationName: string; // Salon name
  description: string; // Card description
  logoFile: string; // Path to logo.png
  iconFile: string; // Path to icon.png
  certificatePem: string; // PKCS#12 cert as PEM
  certificateKey: string; // Private key PEM
};

export type ApplePassState = {
  serialNumber: string;
  stampCount: number;
  stampLimit: number;
  rewardName: string;
  status: "ACTIVE" | "REWARDED" | "REDEEMED" | "DISABLED";
};

/**
 * Generate Apple Wallet .pkpass file
 * Returns a Buffer containing the signed ZIP archive
 */
export async function generateApplePass(
  config: ApplePassConfig,
  state: ApplePassState
): Promise<Buffer> {
  // Build pass.json
  const passJson = buildPassJson(config, state);

  // Create temporary manifest and signature
  const manifest = buildManifest(passJson, config);
  const signature = await buildSignature(manifest, config);

  // Create ZIP archive
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("data", (chunk: Buffer) => chunks.push(chunk));
    archive.on("end", () => resolve(Buffer.concat(chunks)));
    archive.on("error", reject);

    // Add pass.json
    archive.append(JSON.stringify(passJson), { name: "pass.json" });

    // Add manifest.json
    archive.append(JSON.stringify(manifest), { name: "manifest.json" });

    // Add signature
    archive.append(signature, { name: "signature" });

    // Add logo and icon
    try {
      const logoBuf = readFileSync(config.logoFile);
      archive.append(logoBuf, { name: "logo.png" });

      const iconBuf = readFileSync(config.iconFile);
      archive.append(iconBuf, { name: "icon.png" });
    } catch (e) {
      console.error("Error reading logo/icon files:", e);
      // Continue anyway - logo/icon optional
    }

    archive.finalize();
  });
}

function buildPassJson(config: ApplePassConfig, state: ApplePassState): object {
  const primaryField = {
    key: "stamps",
    label: "Sellos",
    value: `${state.stampCount}/${state.stampLimit}`,
    changeMessage: "Sellos actualizado a %@",
    textAlignment: "PKTextAlignmentCenter",
  };

  const auxiliaryFields = [
    {
      key: "reward",
      label: "Recompensa",
      value: state.rewardName,
      textAlignment: "PKTextAlignmentLeft",
    },
  ];

  if (state.status === "REWARDED") {
    auxiliaryFields.push({
      key: "status_label",
      label: "Estado",
      value: "¡Reclamá tu recompensa!",
      textAlignment: "PKTextAlignmentLeft",
    });
  }

  return {
    formatVersion: 1,
    passTypeIdentifier: config.passTypeIdentifier,
    serialNumber: state.serialNumber,
    teamIdentifier: config.teamIdentifier,
    organizationName: config.organizationName,
    description: config.description,
    logoText: config.organizationName,
    foregroundColor: "rgb(255, 255, 255)",
    backgroundColor: "rgb(245, 240, 230)", // Warm beige
    labelColor: "rgb(255, 100, 100)", // Red accents
    generic: {
      primaryFields: [primaryField],
      auxiliaryFields,
    },
    barcodes: [
      {
        format: "PKBarcodeFormatPDF417",
        message: state.serialNumber,
        messageEncoding: "utf-8",
      },
    ],
    webServiceURL: process.env.APPLE_WALLET_WEB_SERVICE_URL,
    authenticationToken: generateAuthToken(),
    relevantDate: new Date().toISOString(),
  };
}

function buildManifest(
  passJson: object,
  config: ApplePassConfig
): Record<string, string> {
  const files: Record<string, string> = {
    "pass.json": sha1Hash(JSON.stringify(passJson)),
  };

  // Add hashes for logo/icon if they exist
  try {
    const logoBuf = readFileSync(config.logoFile);
    files["logo.png"] = sha1Hash(logoBuf);

    const iconBuf = readFileSync(config.iconFile);
    files["icon.png"] = sha1Hash(iconBuf);
  } catch (e) {
    // Files optional
  }

  return files;
}

async function buildSignature(
  manifest: Record<string, string>,
  config: ApplePassConfig
): Promise<Buffer> {
  // Note: Real PKCS#7 signature requires OpenSSL or node-pkcs7
  // For MVP, we'll create a stub signature
  // In production, implement proper signing with certificates
  
  const crypto = require("crypto");
  const manifestJson = JSON.stringify(manifest);
  
  // Create a simple HMAC-based signature for testing
  // This is NOT secure for production - use OpenSSL command in real scenario
  const sign = crypto.createHmac("sha256", config.certificateKey || "dev-key");
  sign.update(manifestJson);
  
  return sign.digest();
}

function sha1Hash(data: Buffer | string): string {
  const hash = createHash("sha1");
  hash.update(data);
  return hash.digest("hex");
}

function generateAuthToken(): string {
  // Random 32-byte token for Web Service authentication
  const crypto = require("crypto");
  return crypto.randomBytes(32).toString("hex");
}
