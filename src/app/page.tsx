"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import QRCode from "qrcode";
import styles from "./page.module.css";

type DeferredInstallPrompt = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

type CardRow = {
  card_public_id: string;
  customer_name?: string;
  stamp_count: number;
  stamp_limit: number;
  status: string;
  reward_name: string;
};

type ScannerState = "idle" | "running" | "error";
type DeviceState = "unknown" | "active" | "needs-activation";
type UIMode = "scan" | "list" | "create" | "edit" | "handoff";

type CreateCardResponse = {
  card_public_id?: string;
  stamp_count?: number;
  stamp_limit?: number;
  join_url?: string;
  error?: { message?: string };
};

function shortCardId(publicId: string): string {
  return publicId.slice(0, 4).toUpperCase();
}

function translateScannerState(state: ScannerState): string {
  switch (state) {
    case "running":
      return "Escaneando";
    case "error":
      return "Error";
    default:
      return "Listo";
  }
}

function translateCardStatus(status: string): string {
  switch (status) {
    case "ACTIVE":
      return "Activa";
    case "REWARDED":
      return "Completada";
    case "REDEEMED":
      return "Canjeada";
    case "DISABLED":
      return "Desactivada";
    default:
      return status;
  }
}

function normalizeCardCode(rawValue: string): string {
  const code = rawValue.trim();
  if (!code) {
    return "";
  }

  if (!code.includes("/")) {
    return code;
  }

  const parts = code.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

export default function Home() {
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loadingCards, setLoadingCards] = useState(false);
  const [notice, setNotice] = useState("");
  const [deviceState, setDeviceState] = useState<DeviceState>("unknown");
  const [uiMode, setUiMode] = useState<UIMode>("scan");

  const [activationCode, setActivationCode] = useState("");
  const [pin, setPin] = useState("");
  const [deviceName, setDeviceName] = useState("Recepcion salon");
  const [activating, setActivating] = useState(false);

  // Create mode
  const [stampLimit, setStampLimit] = useState(9);
  const [customerName, setCustomerName] = useState("");
  const [rewardName, setRewardName] = useState("Manicura gratis");
  const [rewardDescription, setRewardDescription] = useState("Al completar 9 sellos");
  const [joinUrl, setJoinUrl] = useState("");
  const [joinQrDataUrl, setJoinQrDataUrl] = useState("");
  const [lastCreatedCard, setLastCreatedCard] = useState("");
  const [lastCreatedCustomerName, setLastCreatedCustomerName] = useState("");

  // Edit mode
  const [selectedCard, setSelectedCard] = useState<CardRow | null>(null);
  const [editStampLimit, setEditStampLimit] = useState(9);
  const [editCustomerName, setEditCustomerName] = useState("");
  const [editRewardName, setEditRewardName] = useState("");
  const [editRewardDescription, setEditRewardDescription] = useState("");
  const [editingSaving, setEditingSaving] = useState(false);

  // Scanner
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const [scannerState, setScannerState] = useState<ScannerState>("idle");
  const [scanResult, setScanResult] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [installPromptEvent, setInstallPromptEvent] = useState<DeferredInstallPrompt | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    void loadCards();
    return () => {
      stopScanner();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const standalone = window.matchMedia("(display-mode: standalone)").matches;
    const iosStandalone = (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
    setIsStandalone(standalone || iosStandalone);

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPromptEvent(event as DeferredInstallPrompt);
    };

    const handleInstalled = () => {
      setInstallPromptEvent(null);
      setIsStandalone(true);
      setNotice("La app web se instalo correctamente en el inicio.");
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function loadCards() {
    setLoadingCards(true);
    try {
      const response = await fetch("/api/v1/cards", {
        method: "GET",
      });

      if (response.status === 401) {
        setDeviceState("needs-activation");
        setCards([]);
        return false;
      }

      const data = (await response.json().catch(() => null)) as
        | { cards?: CardRow[]; error?: { message?: string } }
        | null;

      if (!response.ok) {
        setNotice(data?.error?.message ?? "No se pudieron cargar las tarjetas");
        return false;
      }

      setDeviceState("active");
      setCards(data?.cards ?? []);
      return true;
    } catch {
      setNotice("Error de conexion al cargar tarjetas");
      return false;
    } finally {
      setLoadingCards(false);
    }
  }

  async function handleActivateDevice(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivating(true);
    setNotice("");

    try {
      const response = await fetch("/api/v1/salon/devices/activate", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          activation_code: activationCode,
          pin,
          device_name: deviceName,
        }),
      });

      const data = (await response.json().catch(() => null)) as
        | { device_id?: string; error?: { message?: string } }
        | null;

      if (!response.ok) {
        setNotice(data?.error?.message ?? "No se pudo activar el dispositivo");
        return;
      }

      setDeviceState("active");
      setActivationCode("");
      setPin("");

      // Verificar de inmediato que el navegador haya persistido la cookie de sesion.
      const sessionOk = await loadCards();
      if (!sessionOk) {
        setDeviceState("needs-activation");
        setNotice(
          "Se activo el dispositivo, pero el navegador del movil no guardo la sesion. Abre en Chrome/Safari normal y permite cookies."
        );
        return;
      }

      setNotice("Dispositivo activado correctamente");
    } catch {
      setNotice("Error de conexion al activar el dispositivo");
    } finally {
      setActivating(false);
    }
  }

  async function handleCreateCard(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setNotice("");
    setJoinUrl("");
    setJoinQrDataUrl("");

    const createdCustomerName = customerName.trim();

    try {
      const response = await fetch("/api/v1/cards", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stamp_limit: stampLimit,
          customer_name: customerName.trim() || undefined,
          reward_name: rewardName,
          reward_description: rewardDescription,
        }),
      });

      const data = (await response.json()) as CreateCardResponse;

      if (!response.ok) {
        setNotice(data.error?.message ?? "No se pudo crear la tarjeta");
        return;
      }

      setJoinUrl(data.join_url ?? "");
      setLastCreatedCard(data.card_public_id ?? "");
      setLastCreatedCustomerName(createdCustomerName || "Cliente sin nombre");

      if (data.join_url) {
        const qrDataUrl = await QRCode.toDataURL(data.join_url, {
          width: 640,
          margin: 1,
          color: {
            dark: "#752a2f",
            light: "#fffdf8",
          },
        });
        setJoinQrDataUrl(qrDataUrl);
      }

      setNotice("Tarjeta creada correctamente");

      // Limpiar formulario
      setCustomerName("");
      setRewardName("Manicura gratis");
      setRewardDescription("Al completar 9 sellos");
      setStampLimit(9);

      void loadCards();
      setUiMode("handoff");
    } catch {
      setNotice("Error de conexion al crear la tarjeta");
    }
  }

  function closeCreatedCardView() {
    setUiMode("scan");
    setJoinUrl("");
    setJoinQrDataUrl("");
    setLastCreatedCard("");
    setLastCreatedCustomerName("");
    void loadCards();
  }

  function openEditCard(card: CardRow) {
    setSelectedCard(card);
    setEditStampLimit(card.stamp_limit);
    setEditCustomerName(card.customer_name || "");
    setEditRewardName(card.reward_name);
    setEditRewardDescription("");
    setUiMode("edit");
    setNotice("");
  }

  async function handleSaveCard() {
    if (!selectedCard) return;

    setEditingSaving(true);
    setNotice("");

    try {
      const response = await fetch(`/api/v1/cards/${selectedCard.card_public_id}`, {
        method: "PATCH",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          stamp_limit: editStampLimit,
          customer_name: editCustomerName.trim() || null,
          reward_name: editRewardName,
          reward_description: editRewardDescription || null,
        }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setNotice(data?.error?.message ?? "Error al guardar");
        return;
      }

      setNotice("Tarjeta actualizada");
      setTimeout(() => {
        void loadCards();
        setUiMode("list");
        setSelectedCard(null);
        setNotice("");
      }, 1000);
    } catch {
      setNotice("Error de conexion al guardar");
    } finally {
      setEditingSaving(false);
    }
  }

  async function startScanner() {
    setNotice("");
    setScanResult("");

    if (!videoRef.current) {
      setScannerState("error");
      setNotice("No se pudo iniciar la camara");
      return;
    }

    stopScanner();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: {
            ideal: "environment",
          },
          width: {
            ideal: 720,
          },
          height: {
            ideal: 720,
          },
        },
        audio: false,
      });

      mediaStreamRef.current = stream;
      videoRef.current.srcObject = stream;
      await videoRef.current.play();
      setScannerState("running");

      const loop = async () => {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        if (!video || !canvas) {
          return;
        }

        try {
          if (video.readyState >= HTMLMediaElement.HAVE_ENOUGH_DATA) {
            const context = canvas.getContext("2d", { willReadFrequently: true });

            if (context) {
              const width = video.videoWidth;
              const height = video.videoHeight;

              if (width > 0 && height > 0) {
                canvas.width = width;
                canvas.height = height;
                context.drawImage(video, 0, 0, width, height);

                const frame = context.getImageData(0, 0, width, height);
                const found = jsQR(frame.data, frame.width, frame.height, {
                  inversionAttempts: "dontInvert",
                });
                const value = found?.data ?? "";

                if (value) {
                  setScanResult(value);
                  await submitStamp(value);
                  stopScanner();
                  return;
                }
              }
            }
          }
        } catch {
          setScannerState("error");
          setNotice("No se pudo leer el codigo QR. Intenta nuevamente.");
          stopScanner();
          return;
        }

        rafRef.current = requestAnimationFrame(() => {
          void loop();
        });
      };

      await loop();
    } catch {
      setScannerState("error");
      setNotice("Permiso de camara denegado o no disponible");
    }
  }

  function stopScanner() {
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerState("idle");
  }

  async function submitStamp(rawValue: string) {
    const idempotency = crypto.randomUUID();
    const publicId = normalizeCardCode(rawValue);

    if (!publicId) {
      setNotice("Codigo de tarjeta vacio");
      return;
    }

    try {
      const response = await fetch(`/api/v1/cards/${publicId}/stamps`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotency,
        },
        body: JSON.stringify({ action: "ADD" }),
      });

      const data = (await response.json()) as {
        stamp_count?: number;
        stamp_limit?: number;
        duplicated?: boolean;
        error?: { message?: string };
      };

      if (!response.ok) {
        setNotice(data.error?.message ?? "No se pudo agregar el sello");
        return;
      }

      if (data.duplicated) {
        setNotice("Sello ya registrado");
      } else {
        setNotice(`Sello agregado: ${data.stamp_count}/${data.stamp_limit}`);
      }

      await loadCards();
    } catch {
      setNotice("Error de conexion al registrar el sello");
    }
  }

  async function handleManualStamp() {
    if (!manualCode.trim()) {
      setNotice("Ingresa un codigo para registrar sello");
      return;
    }
    await submitStamp(manualCode);
    setManualCode("");
  }

  async function handleInstallApp() {
    if (isStandalone) {
      setNotice("La app ya esta instalada en el inicio de este dispositivo.");
      return;
    }

    if (installPromptEvent) {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;

      if (choice.outcome === "accepted") {
        setNotice("Instalacion iniciada desde el navegador.");
      } else {
        setNotice("Instalacion cancelada. Puedes intentarlo de nuevo cuando quieras.");
      }

      setInstallPromptEvent(null);
      return;
    }

    const userAgent = navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(userAgent);

    if (isIos) {
      setNotice("En iPhone abre Compartir y toca 'Anadir a pantalla de inicio' para instalar la app.");
      return;
    }

    setNotice("Si tu navegador no muestra instalacion automatica, abre el menu y busca 'Instalar app' o 'Anadir a pantalla de inicio'.");
  }

  return (
    <div className={styles.page}>
      <div className={styles.backgroundGlow} aria-hidden />
      <main className={styles.main}>
        <header className={styles.header}>
          <div className={styles.headerInner}>
            <img src="/stamp-seal.png" alt="Logo" className={styles.headerLogo} />
            <h1>Tarjetas de Fidelidad</h1>
          </div>
        </header>

        {deviceState !== "active" ? (
          <section className={styles.heroRow}>
            {notice ? <div className={styles.notice}>{notice}</div> : null}
            <article className={styles.activationCard}>
              <h2>Activar este dispositivo</h2>
              <p className={styles.activationHint}>
                Activa tu tablet, telefono o computadora con el codigo y PIN del salon.
              </p>
              <form className={styles.form} onSubmit={handleActivateDevice}>
                <label>
                  Codigo de activacion
                  <input
                    value={activationCode}
                    onChange={(e) => setActivationCode(e.target.value)}
                    placeholder="Codigo del salon"
                  />
                </label>

                <label>
                  PIN del salon
                  <input
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="PIN"
                  />
                </label>

                <label>
                  Nombre del dispositivo
                  <input
                    value={deviceName}
                    onChange={(e) => setDeviceName(e.target.value)}
                    placeholder="Recepcion salon"
                  />
                </label>

                <button type="submit" disabled={activating}>
                  <i className="fas fa-check"></i>
                  {activating ? "Activando..." : "Activar dispositivo"}
                </button>
              </form>
            </article>
          </section>
        ) : null}

        {deviceState === "active" ? (
          <>
            {uiMode !== "handoff" ? (
              <>
                <div className={styles.tabNav}>
                  <button
                    className={`${styles.tabButton} ${uiMode === "scan" ? styles.active : ""}`}
                    onClick={() => setUiMode("scan")}
                  >
                    <i className="fas fa-camera"></i>
                    Escanear
                  </button>
                  <button
                    className={`${styles.tabButton} ${uiMode === "list" ? styles.active : ""}`}
                    onClick={() => setUiMode("list")}
                  >
                    <i className="fas fa-list"></i>
                    Tarjetas
                  </button>
                  <button
                    className={`${styles.tabButton} ${uiMode === "create" ? styles.active : ""}`}
                    onClick={() => setUiMode("create")}
                  >
                    <i className="fas fa-plus-circle"></i>
                    Crear Nueva
                  </button>
                </div>

                <div className={styles.utilityBar}>
                  <button type="button" className={styles.installButton} onClick={() => void handleInstallApp()}>
                    <i className="fas fa-download"></i>
                    {isStandalone ? "App instalada" : "Instalar app en inicio"}
                  </button>
                </div>
              </>
            ) : null}

            <section className={styles.contentPane}>
            {notice ? <div className={styles.notice}>{notice}</div> : null}

            {uiMode === "handoff" ? (
              <article className={styles.handoffCard}>
                <p className={styles.handoffEyebrow}>Tarjeta lista para el cliente</p>
                <h2>Tarjeta de Fidelidad de {lastCreatedCustomerName}</h2>
                <p className={styles.handoffHint}>Pide al cliente que escanee este QR para abrir su tarjeta.</p>

                {joinQrDataUrl ? (
                  <div className={styles.handoffQrWrap}>
                    <img className={styles.handoffQrImage} src={joinQrDataUrl} alt="QR de tarjeta del cliente" />
                  </div>
                ) : null}

                {joinUrl ? (
                  <a href={joinUrl} target="_blank" rel="noreferrer" className={styles.handoffLink}>
                    Abrir enlace de tarjeta
                  </a>
                ) : null}

                <button type="button" className={styles.handoffButton} onClick={closeCreatedCardView}>
                  <i className="fas fa-arrow-left"></i>
                  Volver a la App
                </button>
              </article>
            ) : null}

            {/* LIST MODE */}
            {uiMode === "list" && (
              <>
                <section className={styles.card}>
                  <div className={styles.listHeader}>
                    <h2>Tarjetas Activas ({cards.length})</h2>
                    <button type="button" className={styles.ghostButton} onClick={() => void loadCards()}>
                      <i className="fas fa-sync-alt"></i>
                      Actualizar
                    </button>
                  </div>

                  {loadingCards ? <p>Cargando...</p> : null}

                  <div className={styles.list}>
                    {cards.map((card) => (
                      <div key={card.card_public_id} className={styles.listItem}>
                        <div className={styles.listItemInfo} onClick={() => openEditCard(card)}>
                          <p className={styles.cardId}>#{shortCardId(card.card_public_id)}</p>
                          <p className={styles.meta}>{card.customer_name || "Sin nombre"}</p>
                          <p className={styles.meta}>{card.reward_name}</p>
                          <p className={styles.meta}>Estado: {translateCardStatus(card.status)}</p>
                          <div className={styles.progressWrap}>
                            <p className={styles.progress}>
                              {card.stamp_count} / {card.stamp_limit} sellos
                            </p>
                          </div>
                        </div>
                        <div className={styles.listItemActions}>
                          <a
                            href={`/join/${card.card_public_id}`}
                            className={styles.viewCardButton}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <i className="fas fa-eye"></i>
                            Ver
                          </a>
                          <button
                            type="button"
                            className={styles.ghostButton}
                            style={{ padding: "8px 12px", fontSize: "0.8rem" }}
                            onClick={() => openEditCard(card)}
                          >
                            <i className="fas fa-edit"></i>
                            Editar
                          </button>
                        </div>
                      </div>
                    ))}
                    {!loadingCards && cards.length === 0 ? (
                      <div className={styles.emptyState}>No hay tarjetas registradas aún</div>
                    ) : null}
                  </div>
                </section>
              </>
            )}

            {/* SCAN MODE */}
            {uiMode === "scan" && (
              <article className={styles.card}>
                <h2>Escanear QR</h2>
                <div className={styles.scannerActions}>
                  <button type="button" onClick={() => void startScanner()} disabled={deviceState !== "active"}>
                    <i className="fas fa-camera"></i>
                    Abrir camara
                  </button>
                  <button type="button" onClick={stopScanner} className={styles.ghostButton}>
                    <i className="fas fa-times"></i>
                    Detener
                  </button>
                </div>

                <div className={styles.scannerViewport}>
                  <video ref={videoRef} className={styles.video} muted playsInline />
                </div>
                <canvas ref={canvasRef} className={styles.hiddenCanvas} aria-hidden />

                <p className={styles.helper}>Estado: {translateScannerState(scannerState)}</p>
                <p className={styles.helper}>Apunta al QR dentro del cuadro para registrar el sello.</p>

                {scanResult ? <p className={styles.scanResult}>Ultimo QR leido: {normalizeCardCode(scanResult)}</p> : null}

                <div className={styles.manualRow}>
                  <input
                    placeholder="O ingresa el codigo manualmente"
                    value={manualCode}
                    onChange={(e) => setManualCode(e.target.value)}
                    disabled={deviceState !== "active"}
                  />
                  <button type="button" onClick={() => void handleManualStamp()} disabled={deviceState !== "active"}>
                    <i className="fas fa-plus"></i>
                    Agregar
                  </button>
                </div>
              </article>
            )}

            {/* CREATE MODE */}
            {uiMode === "create" && (
              <article className={styles.card}>
                <h2>Nueva Tarjeta</h2>
                <form className={styles.form} onSubmit={handleCreateCard}>
                  <label>
                    Sellos requeridos
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={stampLimit}
                      onChange={(e) => setStampLimit(Number(e.target.value || "9"))}
                    />
                  </label>

                  <label>
                    Nombre del cliente (opcional)
                    <input
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      placeholder="Ej: Maria Garcia"
                    />
                  </label>

                  <label>
                    Nombre de recompensa
                    <input value={rewardName} onChange={(e) => setRewardName(e.target.value)} />
                  </label>

                  <label>
                    Descripcion
                    <input
                      value={rewardDescription}
                      onChange={(e) => setRewardDescription(e.target.value)}
                    />
                  </label>

                  <button type="submit">
                    <i className="fas fa-star"></i>
                    Crear Tarjeta
                  </button>
                </form>

              </article>
            )}

            {/* EDIT MODE */}
            {uiMode === "edit" && selectedCard && (
              <article className={styles.card}>
                <h2>Editar Tarjeta #{shortCardId(selectedCard.card_public_id)}</h2>

                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    void handleSaveCard();
                  }}
                  className={styles.form}
                >
                  <label>
                    Nombre del cliente
                    <input
                      value={editCustomerName}
                      onChange={(e) => setEditCustomerName(e.target.value)}
                      placeholder="Ej: Maria Garcia"
                    />
                  </label>

                  <label>
                    Sellos requeridos
                    <input
                      type="number"
                      min={1}
                      max={20}
                      value={editStampLimit}
                      onChange={(e) => setEditStampLimit(Number(e.target.value || "9"))}
                    />
                  </label>

                  <label>
                    Recompensa
                    <input value={editRewardName} onChange={(e) => setEditRewardName(e.target.value)} />
                  </label>

                  <label>
                    Descripcion
                    <input
                      value={editRewardDescription}
                      onChange={(e) => setEditRewardDescription(e.target.value)}
                    />
                  </label>

                  <div style={{ display: "flex", gap: 8, marginTop: 16 }}>
                    <button type="submit" disabled={editingSaving}>
                      <i className="fas fa-save"></i>
                      {editingSaving ? "Guardando..." : "Guardar Cambios"}
                    </button>
                    <button
                      type="button"
                      className={styles.ghostButton}
                      onClick={() => {
                        setUiMode("list");
                        setSelectedCard(null);
                      }}
                    >
                      <i className="fas fa-times"></i>
                      Cancelar
                    </button>
                  </div>
                </form>

                <div style={{ marginTop: 24, padding: "12px", background: "#fdf0ed", borderRadius: 8 }}>
                  <p style={{ margin: 0, fontSize: 12, color: "#9c495a" }}>
                    <i className="fas fa-info-circle"></i> <strong>Nota:</strong> No puedes quitar sellos, solo editar cantidad requerida y datos
                  </p>
                </div>
              </article>
            )}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}
