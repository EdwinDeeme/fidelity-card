"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import QRCode from "qrcode";

type CardData = {
  card_public_id: string;
  customer_name?: string;
  stamp_count: number;
  stamp_limit: number;
  reward_name: string;
  reward_description?: string;
  status: string;
};

type RewardTier = {
  label: string;
  target: number | null;
};

function parseRewardTiers(rewardName: string): RewardTier[] {
  return rewardName
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((label) => {
      const match = label.match(/(\d+)/);
      return {
        label,
        target: match ? Number(match[1]) : null,
      };
    });
}

export default function LoyaltyCardPage() {
  const params = useParams<{ token: string }>();
  const token = params.token;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [card, setCard] = useState<CardData | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState("");

  useEffect(() => {
    void (async () => {
      try {
        const response = await fetch(`/api/v1/join/${token}?t=${Date.now()}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setError("Enlace inválido o expirado");
          return;
        }

        const result = await response.json();
        setCard(result);

        if (result.card_public_id) {
          const qrData = await QRCode.toDataURL(result.card_public_id, {
            width: 180,
            margin: 0,
            color: {
              dark: "#752a2f",
              light: "#fffdf8",
            },
          });
          setQrDataUrl(qrData);
        }
      } catch {
        setError("Error al cargar la tarjeta");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(160deg, #fff6ef 0%, #fffdf8 100%)",
        }}
      >
        <p style={{ color: "#9c495a", fontSize: 16 }}>Cargando...</p>
      </div>
    );
  }

  if (error || !card) {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "linear-gradient(160deg, #fff6ef 0%, #fffdf8 100%)",
          padding: 16,
        }}
      >
        <div style={{ textAlign: "center" }}>
          <h2 style={{ color: "#752a2f", margin: 0 }}>Algo salió mal</h2>
          <p style={{ color: "#9c495a", marginTop: 6 }}>{error}</p>
        </div>
      </div>
    );
  }

  const totalStamps = Math.max(1, card.stamp_limit);
  const filledStamps = Math.min(card.stamp_count, totalStamps);
  const stamps = Array.from({ length: totalStamps }).map((_, i) => i < filledStamps);
  const stampProgress = `${filledStamps}/${totalStamps}`;
  const stampRows: boolean[][] = [];

  for (let i = 0; i < stamps.length; i += 5) {
    stampRows.push(stamps.slice(i, i + 5));
  }

  const tiers = parseRewardTiers(card.reward_name);
  const description = card.reward_description?.trim() || "Programa de fidelidad";

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(160deg, #fff6ef 0%, #fffdf8 100%)",
        padding: "16px 12px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 430,
          display: "grid",
          gap: 14,
        }}
      >
        <article
          style={{
            background: "linear-gradient(135deg, #d4666e 0%, #c85a5a 100%)",
            color: "#fff",
            borderRadius: 20,
            padding: 16,
            boxShadow: "0 16px 28px rgba(117, 42, 47, 0.25)",
            border: "1px solid rgba(255,255,255,0.35)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-start",
              gap: 10,
            }}
          >
            <div
              style={{
                minHeight: 66,
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
              }}
            >
              <p style={{ margin: 0, fontSize: 12, opacity: 0.9, letterSpacing: "0.06em", textTransform: "uppercase" }}>
                Cliente
              </p>
              <h1 style={{ margin: 0, fontSize: 22, lineHeight: 1.1 }}>
                {card.customer_name || "Cliente"}
              </h1>
            </div>

            {qrDataUrl ? (
              <div style={{ textAlign: "center" }}>
                <div
                  style={{
                    background: "#fff",
                    padding: 5,
                    borderRadius: 8,
                  }}
                >
                  <img
                    src={qrDataUrl}
                    alt="QR"
                    style={{ width: 56, height: 56, display: "block" }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          <p
            style={{
              margin: "12px 0 10px",
              fontSize: 13,
              textAlign: "center",
              opacity: 0.95,
            }}
          >
            {description}
          </p>

          <div style={{ display: "grid", gap: 7 }}>
            {stampRows.map((row, rowIndex) => (
              <div
                key={rowIndex}
                style={{
                  display: "grid",
                  gridTemplateColumns: `repeat(${row.length}, 1fr)`,
                  gap: 7,
                }}
              >
                {row.map((isFilled, index) => (
                  <div
                    key={`${rowIndex}-${index}`}
                    style={{
                      aspectRatio: "1",
                      borderRadius: "50%",
                      background: isFilled ? "#fff" : "rgba(255,255,255,0.2)",
                      display: "grid",
                      placeItems: "center",
                      overflow: "hidden",
                      boxShadow: isFilled ? "0 5px 10px rgba(0,0,0,0.18)" : "none",
                    }}
                  >
                    {isFilled ? (
                      <img
                        src="/stamp-seal.png"
                        alt="Sello"
                        style={{ width: "84%", height: "84%", objectFit: "contain" }}
                      />
                    ) : null}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <p style={{ margin: "10px 0 0", textAlign: "center", fontSize: 14, fontWeight: 700 }}>
            Progreso {stampProgress}
          </p>
        </article>

        <section
          style={{
            background: "#fffdf8",
            border: "1px solid #efc8b6",
            borderRadius: 16,
            padding: 12,
            boxShadow: "0 8px 18px rgba(117, 42, 47, 0.1)",
          }}
        >
          <p style={{ margin: "0 0 8px", color: "#752a2f", fontWeight: 700, textAlign: "center" }}>
            Premios disponibles
          </p>

          <div style={{ display: "grid", gap: 8 }}>
            {tiers.length > 0 ? (
              tiers.map((tier, i) => {
                const unlocked = tier.target !== null ? filledStamps >= tier.target : false;
                return (
                  <div
                    key={`${tier.label}-${i}`}
                    style={{
                      borderRadius: 12,
                      padding: "10px 12px",
                      border: unlocked ? "2px solid #d4666e" : "2px solid #f0dfd3",
                      background: unlocked ? "#fff1f3" : "#fff",
                    }}
                  >
                    <p style={{ margin: 0, color: "#752a2f", fontWeight: 700, fontSize: 13 }}>{tier.label}</p>
                    {tier.target !== null ? (
                      <p style={{ margin: "3px 0 0", color: "#9c495a", fontSize: 12 }}>
                        Requiere {tier.target} sellos
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div
                style={{
                  borderRadius: 12,
                  padding: "10px 12px",
                  border: "2px solid #f0dfd3",
                  background: "#fff",
                }}
              >
                <p style={{ margin: 0, color: "#752a2f", fontWeight: 700, fontSize: 13 }}>{card.reward_name}</p>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
