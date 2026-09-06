import { useEffect, useRef, useState } from "react";
import QRCode from "qrcode";
import { Download, QrCode } from "lucide-react";

/**
 * Parcel QR code — encodes the public tracking URL for a parcel.
 *
 * - `variant="card"`   : shows the QR image plus a Download button (used right
 *                        after parcel creation).
 * - `variant="button"` : a compact icon button that downloads the PNG directly
 *                        (used in parcel tables / member dashboards).
 *
 * The link base comes from VITE_TRACKING_BASE_URL when set (the member site's
 * public origin), otherwise the current origin — both host a tracking page.
 */
export default function ParcelQR({ trackingId, variant = "card", size = 176, label }) {
  const [dataUrl, setDataUrl] = useState(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState(false);
  const canvasRef = useRef(null);

  const linkBase = (import.meta.env.VITE_TRACKING_BASE_URL || window.location.origin).replace(/\/+$/, "");
  const trackingUrl = `${linkBase}/track?id=${encodeURIComponent(trackingId)}`;

  useEffect(() => {
    let active = true;
    setReady(false);
    QRCode.toCanvas(canvasRef.current, trackingUrl, {
      width: 256,
      margin: 1,
      errorCorrectionLevel: "M",
      color: { dark: "#0f172a", light: "#ffffff" },
    })
      .then(() => active && setReady(true))
      .catch(() => active && setError(true));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [trackingId]);

  const download = async (e) => {
    e?.preventDefault?.();
    try {
      const url = await QRCode.toDataURL(trackingUrl, {
        width: 1024,
        margin: 2,
        errorCorrectionLevel: "M",
      });
      const a = document.createElement("a");
      a.href = url;
      a.download = `parcel-${trackingId}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch {
      /* ignore download errors */
    }
  };

  if (variant === "button") {
    return (
      <button
        type="button"
        onClick={download}
        title={label || `Download QR for ${trackingId}`}
        aria-label={label || `Download QR for ${trackingId}`}
        className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-white text-slate-500 transition-colors hover:border-primary/40 hover:text-primary"
      >
        <QrCode className="h-4 w-4" />
      </button>
    );
  }

  return (
    <div className="inline-flex flex-col items-center gap-3 rounded-xl border border-border bg-white p-4 shadow-sm">
      <div className="rounded-lg border border-border/70 bg-white p-2">
        <canvas ref={canvasRef} style={{ width: size, height: size }} aria-label={`QR code for parcel ${trackingId}`} />
      </div>
      <p className="max-w-full truncate font-mono text-xs text-muted-foreground">{trackingId}</p>
      <button
        type="button"
        onClick={download}
        disabled={!ready || error}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:bg-primary/90 disabled:opacity-50"
      >
        <Download className="h-4 w-4" /> Download QR code
      </button>
      {error && <p className="text-xs text-destructive">Could not generate the QR code.</p>}
    </div>
  );
}
