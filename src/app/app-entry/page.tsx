"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

function readCookie(name: string): string {
  const cookieName = `${name}=`;
  const parts = document.cookie.split(";");

  for (const part of parts) {
    const cookie = part.trim();
    if (cookie.startsWith(cookieName)) {
      return decodeURIComponent(cookie.slice(cookieName.length));
    }
  }

  return "";
}

export default function AppEntryPage() {
  const router = useRouter();

  useEffect(() => {
    const localToken = window.localStorage.getItem("customer_card_token") || "";
    const cookieToken = readCookie("customer_card_token");
    const token = localToken || cookieToken;

    if (token) {
      window.localStorage.setItem("customer_card_token", token);
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
