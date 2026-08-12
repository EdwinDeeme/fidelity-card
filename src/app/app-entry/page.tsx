"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AppEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const token = window.localStorage.getItem("customer_card_token");

    if (token) {
      router.replace(`/join/${encodeURIComponent(token)}`);
      return;
    }

    router.replace("/");
  }, [router]);

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "linear-gradient(160deg, #fff6ef 0%, #fffdf8 100%)",
      }}
    >
      <p style={{ margin: 0, color: "#752a2f", fontWeight: 700 }}>Abriendo...</p>
    </main>
  );
}
