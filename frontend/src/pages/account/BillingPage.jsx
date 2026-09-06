import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import QRCode from "qrcode";
import {
  Wallet, Receipt, CreditCard, Landmark, Info, RefreshCw, Loader2, CheckCircle2, ArrowRight, TriangleAlert, Plus,
  Lock, Smartphone, Gift, Coins,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import CopyButton from "@/components/portal/CopyButton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchBillingOverview, fetchMyInvoices, fetchMyPayments, fetchWallet,
  cancelInvoice, cancelPayment, payInvoiceFromWallet, topUpWallet,
  fetchReferralInfo, fetchReferralPoints, redeemReferralPoints,
  fetchPayment, submitPaymentReference, fetchBlobUrl, fetchDialUri,
  startMpesaPush, refreshPayment,
} from "@/lib/portalApi";

/* Status chip palettes — soft background + readable text, same family as the package pages. */
const INVOICE_STYLE = {
  ISSUED: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-orange-100 text-orange-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-slate-100 text-slate-600",
};
const INVOICE_TEXT = { ISSUED: "Issued", PARTIAL: "Partially paid", PAID: "Paid", VOID: "Void" };

const PAYMENT_STYLE = {
  PENDING: "bg-amber-100 text-amber-800",
  PROCESSING: "bg-sky-100 text-sky-800",
  PAYMENT_SUBMITTED: "bg-violet-100 text-violet-800",
  PAID: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  REJECTED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-600",
  EXPIRED: "bg-orange-100 text-orange-700",
};
const PAYMENT_TEXT = {
  PENDING: "Pending",
  PROCESSING: "Waiting for confirmation",
  PAYMENT_SUBMITTED: "Submitted",
  PAID: "Paid",
  FAILED: "Payment failed",
  REJECTED: "Rejected",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
};

const CHANNEL_LABEL = {
  MOBILE_MONEY: "Mobile money",
  OFFLINE: "Bank transfer / offline",
  WALLET: "Account credit",
  MPESA: "M-Pesa (Daraja)",
};

const humanize = (s) =>
  String(s || "Unknown")
    .split("_")
    .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");

/* Single channel-label helper: known codes get friendly names, everything else humanized. */
const channelLabel = (code) => {
  if (!code) return "—";
  return CHANNEL_LABEL[code] || humanize(code);
};

const money = (v, cur = "USD") => {
  if (v === null || v === undefined || v === "") return null;
  return Number(v).toLocaleString("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 });
};

/* Member-facing amounts: UGX has no decimals ("37,000 UGX"); everything else uses USD style. */
const fmtAmount = (v, cur) => {
  const n = Number(v);
  if (v === null || v === undefined || v === "" || !Number.isFinite(n)) return null;
  if (cur === "UGX") return n.toLocaleString("en-US", { maximumFractionDigits: 0 }) + " UGX";
  return money(n, cur || "USD");
};

const curSymbol = (cur) => (cur === "UGX" ? "UGX" : "$");

/* Minimum top-up copy derived from live wallet data (UGX shows the ≈ USD equivalent via rateUsdUgx). */
const topupMinNote = (w) => {
  const min = w?.minTopup;
  if (!min || min.amount === null || min.amount === undefined) return null;
  const cur = min.currency || w?.walletCurrency || w?.currency || "USD";
  const amt = Number(min.amount);
  if (!Number.isFinite(amt)) return null;
  if (cur === "UGX") {
    const rate = Number(w?.rateUsdUgx);
    if (Number.isFinite(rate) && rate > 0) {
      return fmtAmount(amt, "UGX") + " (≈ USD " + (amt / rate).toFixed(2) + ")";
    }
    return fmtAmount(amt, "UGX");
  }
  if (cur === "USD") return fmtAmount(amt, "USD") + " USD";
  return fmtAmount(amt, cur);
};

const inputCls =
  "h-[46px] rounded-[10px] border border-border bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:bg-surface/60";

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const fmtDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

function Chip({ status, style, text }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " +
        (style[status] || "bg-surface-muted text-slate-600")
      }
    >
      {text[status] || humanize(status)}
    </span>
  );
}

function Tile({ icon: Icon, label, sub, children }) {
  return (
    <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
      <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
        <Icon className="h-3.5 w-3.5" /> {label}
      </p>
      <div className="mt-2 font-display text-[26px] font-extrabold leading-none text-foreground">{children}</div>
      {sub && <p className="mt-2 text-[12px] text-slate-400">{sub}</p>}
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
      {message}
    </p>
  );
}

function SectionError({ message, onRetry, busy }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/25 px-3 text-[12px] font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
      >
        <RefreshCw className={"h-3.5 w-3.5 " + (busy ? "animate-spin" : "")} /> Retry
      </button>
    </div>
  );
}

/* One dataset with an initial load and a manual reload (keeps old rows while refreshing). */
function useResource(fetcher, failMsg) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(failMsg));
    return () => {
      alive = false;
    };
  }, [fetcher, failMsg]);

  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      setData(await fetcher());
    } catch {
      setError(failMsg);
    } finally {
      setBusy(false);
    }
  };

  return { data, error, busy, reload };
}

/* Renders server-provided payment instructions of unknown shape (string, list, list of pairs). */
function Instructions({ value }) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "string") {
    return <p className="whitespace-pre-line text-sm leading-relaxed text-slate-600">{value}</p>;
  }
  if (Array.isArray(value)) {
    return (
      <ul className="space-y-2 text-sm">
        {value.map((item, i) => {
          if (typeof item === "string") return <li key={i}>{item}</li>;
          if (item && typeof item === "object") {
            const label = item.label || item.title || item.channel || item.name;
            const detail = item.value ?? item.details ?? item.instructions ?? item.text;
            if (label && detail) {
              return (
                <li key={i}>
                  <span className="font-semibold text-foreground">{label}: </span>
                  <span className="text-slate-600">{detail}</span>
                </li>
              );
            }
            return <li key={i} className="text-slate-600">{label || detail}</li>;
          }
          return null;
        })}
      </ul>
    );
  }
  return <p className="whitespace-pre-line text-sm text-slate-600">{JSON.stringify(value, null, 2)}</p>;
}

/* Renders a USSD top-up string as a scannable QR canvas (mirrors ParcelQR's qrcode usage). */

/* One row of the channel-state list inside the top-up dialog. WALLET/OFFLINE are informational
 * text rows; every other channel (CARD, MTN_MOMO, AIRTEL_MONEY, MPESA, …) renders disabled with
 * the provider's own status message verbatim — never enabled. */
function ChannelStatusRow({ channel }) {
  const code = channel.code || "";
  const label = channel.label || (code ? channelLabel(code) : "Payment channel");
  if (code === "WALLET" || code === "OFFLINE") {
    return (
      <li className="flex items-center justify-between gap-3 rounded-lg border border-[#e5eaf2] bg-surface/40 px-3.5 py-2.5">
        <span className="flex min-w-0 items-center gap-2 text-[13.5px] font-semibold text-slate-700">
          {code === "WALLET" ? (
            <Wallet className="h-4 w-4 shrink-0 text-slate-400" />
          ) : (
            <Landmark className="h-4 w-4 shrink-0 text-slate-400" />
          )}
          {label}
        </span>
        <span className="shrink-0 text-[12px] text-slate-500">
          {code === "WALLET" ? "Used for invoice payments" : "Finance confirms manually"}
        </span>
      </li>
    );
  }
  const message = channel.providerStatus?.message || "Not connected yet.";
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg border border-dashed border-[#e5eaf2] bg-surface/30 px-3.5 py-2.5">
      <span className="min-w-0">
        <span className="block text-[13.5px] font-semibold text-slate-500">{label}</span>
        <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-500">{message}</span>
      </span>
      <Lock className="h-3.5 w-3.5 shrink-0 text-slate-300" aria-hidden="true" />
    </li>
  );
}

function PaymentPayDialog({ payment, onClose, onDone }) {
  const paymentId = payment?.paymentId || payment?._id || "";
  const [detail, setDetail] = useState(null); // { payment, mobileMoney? }
  const [loadError, setLoadError] = useState("");
  const [qrUrl, setQrUrl] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [screenshot, setScreenshot] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [subError, setSubError] = useState("");
  const [done, setDone] = useState(null); // success message once submitted
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let alive = true;
    let objectUrl = "";
    setBusy(true);
    fetchPayment(paymentId)
      .then(async (d) => {
        if (!alive) return;
        setDetail(d);
        setLoadError("");
        if (d?.mobileMoney?.qrUrl) {
          try {
            objectUrl = await fetchBlobUrl(d.mobileMoney.qrUrl);
            if (alive) setQrUrl(objectUrl);
          } catch { /* QR optional */ }
        }
      })
      .catch((err) => alive && setLoadError(err?.response?.data?.message || "Could not load this payment."))
      .finally(() => alive && setBusy(false));
    return () => {
      alive = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId]);

  const mm = detail?.mobileMoney || null;
  const prov = detail?.providerPayment || null;
  const st = detail?.payment?.status;
  const manualChannel = detail?.payment?.channel === "MOBILE_MONEY" || detail?.payment?.channel === "OFFLINE";

  /* M-Pesa: phone + start/retry state and light polling of OUR backend only. */
  const [phone, setPhone] = useState("");
  const [mpesaBusy, setMpesaBusy] = useState(false);
  const [mpesaError, setMpesaError] = useState("");
  const isMpesaWait = prov && (st === "PENDING" || st === "PROCESSING");

  useEffect(() => {
    if (!isMpesaWait || done) return;
    let alive = true;
    const t = setInterval(async () => {
      if (!alive) return;
      try {
        const fresh = await fetchPayment(paymentId);
        if (alive) setDetail(fresh);
      } catch { /* transient — keep polling */ }
    }, 4000);
    return () => {
      alive = false;
      clearInterval(t);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paymentId, isMpesaWait, done]);

  const sendMpesa = async () => {
    if (!phone.trim()) {
      setMpesaError("Enter your M-Pesa phone number.");
      return;
    }
    setMpesaBusy(true);
    setMpesaError("");
    try {
      const res = await startMpesaPush(paymentId, phone.trim());
      toast.success(res.message || "Check your phone to complete the payment.");
      const fresh = await fetchPayment(paymentId);
      setDetail(fresh);
      setDone(null);
    } catch (err) {
      setMpesaError(err?.response?.data?.message || "Unable to start the M-Pesa payment. Check your phone number and try again.");
    } finally {
      setMpesaBusy(false);
    }
  };

  const checkAgain = async () => {
    setMpesaBusy(true);
    setMpesaError("");
    try {
      const res = await refreshPayment(paymentId);
      const fresh = await fetchPayment(paymentId);
      setDetail(fresh);
      if (res?.message) toast.info(res.message);
    } catch (err) {
      setMpesaError(err?.response?.data?.message || "M-Pesa is not responding right now — still waiting for confirmation.");
    } finally {
      setMpesaBusy(false);
    }
  };

  const dialNow = async () => {
    if (!mm?.dialUrl) return;
    try {
      const telUri = await fetchDialUri(mm.dialUrl);
      window.location.href = telUri; // user-initiated (button tap)
    } catch (err) {
      setSubError(err?.response?.data?.message || "Could not open the dialer right now.");
    }
  };

  const submitRef = async () => {
    if (!reference.trim()) {
      setSubError("Enter the transaction reference from your payment.");
      return;
    }
    setSubmitting(true);
    setSubError("");
    try {
      const res = await submitPaymentReference(paymentId, {
        reference: reference.trim(),
        note: note.trim() || undefined,
        screenshot: screenshot || undefined,
      });
      setDone(res.message || "Reference submitted — awaiting verification.");
      toast.success("Reference submitted — our finance team will verify your payment.");
      onDone();
    } catch (err) {
      setSubError(err?.response?.data?.message || "Could not submit the reference. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && !submitting && onClose()}>
      <DialogContent className="max-w-md rounded-2xl">
        {busy ? (
          <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading payment…
          </div>
        ) : loadError ? (
          <div className="space-y-3 py-4">
            <ErrorBox message={loadError} />
            <Button variant="outline" onClick={onClose} className="w-full">Close</Button>
          </div>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CreditCard className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
                </span>
                {mm ? mm.network || "Mobile money" : channelLabel(detail?.payment?.channel)}
              </DialogTitle>
              <DialogDescription>
                Payment{" "}
                <span className="font-mono font-semibold text-foreground">
                  {detail?.payment?.paymentId || paymentId}
                </span>
                {" · "}
                <Chip status={st} style={PAYMENT_STYLE} text={PAYMENT_TEXT} />
              </DialogDescription>
            </DialogHeader>

            {done ? (
              <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                <div className="text-[13.5px] font-semibold leading-relaxed text-emerald-800">
                  {done}
                  {reference.trim() && (
                    <span className="mt-1 block font-mono text-[12.5px] text-emerald-700">Ref: {reference.trim()}</span>
                  )}
                </div>
              </div>
            ) : null}

            {!done && mm ? (
              <>
                <div className="rounded-xl border border-primary/20 bg-primary/5 px-4 py-4 text-center">
                  <p className="text-[12px] font-bold uppercase tracking-wider text-slate-500">Amount to pay</p>
                  <p className="mt-1 font-display text-[26px] font-extrabold text-foreground">
                    {fmtAmount(mm.amount, mm.currency) || "—"}
                  </p>
                  {qrUrl ? (
                    <img
                      src={qrUrl}
                      alt="Scan to pay with mobile money"
                      className="mx-auto mt-3 h-44 w-44 rounded-lg border border-[#e5eaf2] bg-white p-1"
                    />
                  ) : null}
                  <p className="mt-2 text-[12px] font-semibold text-slate-500">Scan with your phone to continue</p>
                  {mm.ussd ? (
                    <div className="mx-auto mt-2 flex max-w-[260px] items-center gap-2 rounded-lg bg-white px-3 py-2">
                      <span className="min-w-0 flex-1 truncate font-mono text-[14px] font-bold text-foreground">{mm.ussd}</span>
                      <CopyButton value={mm.ussd} label="Copy" />
                    </div>
                  ) : null}
                  {mm.dialUrl ? (
                    <button
                      type="button"
                      onClick={dialNow}
                      className="mt-3 inline-flex h-11 w-full items-center justify-center gap-2 rounded-[10px] bg-accent text-[15px] font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90"
                    >
                      <Smartphone className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} /> Pay on phone
                    </button>
                  ) : null}
                </div>

                <div className="space-y-2 rounded-xl border border-[#e5eaf2] bg-surface/40 px-4 py-3.5">
                  <p className="flex items-center gap-1.5 text-[13px] font-bold text-foreground">
                    <Info className="h-4 w-4 text-primary" /> Completed the payment?
                  </p>
                  <p className="text-[12.5px] leading-relaxed text-slate-500">
                    Enter the transaction reference from your mobile money message{mm.invoiceReference ? ` (invoice ${mm.invoiceReference})` : ""}. Submitting it sends your payment for verification — it is credited only after finance confirms it.
                  </p>
                </div>
              </>
            ) : null}

            {!done && prov ? (
              prov.status === "PAID" ? (
                <div className="flex gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3.5">
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                  <div className="text-[13.5px] font-semibold leading-relaxed text-emerald-800">
                    {prov.message}
                    {prov.receipt && <span className="mt-1 block font-mono text-[12.5px] text-emerald-700">Receipt: {prov.receipt}</span>}
                  </div>
                </div>
              ) : prov.status === "PROCESSING" ? (
                <div className="space-y-3 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3.5">
                  <div className="flex items-start gap-3">
                    <Loader2 className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-sky-600" />
                    <div>
                      <p className="text-[14px] font-bold text-sky-900">Waiting for confirmation</p>
                      <p className="mt-0.5 text-[13px] leading-relaxed text-sky-800">{prov.message}</p>
                      {prov.phoneMasked && (
                        <p className="mt-1 text-[12px] text-sky-700">Request sent to {prov.phoneMasked}</p>
                      )}
                      <button
                        type="button"
                        onClick={checkAgain}
                        disabled={mpesaBusy}
                        className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-sky-800 underline-offset-2 hover:underline"
                      >
                        {mpesaBusy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Check again
                      </button>
                    </div>
                  </div>
                  {mpesaError && <ErrorBox message={mpesaError} />}
                </div>
              ) : prov.status === "CANCELLED" ? (
                <div className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3.5">
                  <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                  <p className="text-[13.5px] font-semibold leading-relaxed text-slate-700">
                    {prov.message || "Payment was cancelled."}
                  </p>
                </div>
              ) : (
                /* PENDING / FAILED / EXPIRED — start or retry an M-Pesa request */
                <div className="space-y-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-4">
                  <p className="text-sm font-bold text-foreground">
                    {prov.status === "PENDING" ? "Pay with M-Pesa" : prov.status === "EXPIRED" ? "M-Pesa request expired" : "M-Pesa payment failed"}
                  </p>
                  <p className="text-[13px] text-slate-600">
                    Amount due:{" "}
                    <span className="font-bold text-foreground">
                      {fmtAmount(prov.settlementAmount, prov.settlementCurrency) || fmtAmount(detail?.payment?.amount, detail?.payment?.currency)}
                    </span>
                    {prov.settlementCurrency && detail?.payment?.currency && prov.settlementCurrency !== detail?.payment?.currency && (
                      <span className="text-slate-400"> (charged in {prov.settlementCurrency})</span>
                    )}
                  </p>
                  {prov.providerResultDesc && prov.status !== "PENDING" && (
                    <p className="rounded-md bg-surface px-3 py-2 text-[12px] text-slate-500">{prov.providerResultDesc}</p>
                  )}
                  <div>
                    <Label htmlFor="mpesa-phone" className="text-[13px] font-semibold">M-Pesa phone number</Label>
                    <Input
                      id="mpesa-phone"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="e.g. 0712XXXXXX or +2547XXXXXXXX"
                      className="mt-1.5"
                      maxLength={20}
                      inputMode="tel"
                    />
                    <p className="mt-1 text-[11.5px] text-slate-400">
                      We send a payment request to this phone — you confirm with your M-Pesa PIN in the M-Pesa prompt.
                      SwiftKifisha never asks for your PIN.
                    </p>
                  </div>
                  {mpesaError && <ErrorBox message={mpesaError} />}
                  <Button
                    type="button"
                    onClick={sendMpesa}
                    disabled={mpesaBusy || !phone.trim()}
                    className="h-11 w-full gap-2 bg-accent font-bold text-accent-foreground hover:bg-accent/90"
                  >
                    {mpesaBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {mpesaBusy ? "Sending request…" : "Send payment request"}
                  </Button>
                </div>
              )
            ) : null}

            {!done && manualChannel && st !== "PAYMENT_SUBMITTED" ? (
              <div className="space-y-3">
                <div>
                  <Label htmlFor="pay-ref" className="text-[13px] font-semibold">Transaction reference</Label>
                  <Input
                    id="pay-ref"
                    value={reference}
                    onChange={(e) => setReference(e.target.value)}
                    placeholder="e.g. MM-77881245-UGX"
                    className="mt-1.5"
                    maxLength={80}
                  />
                </div>
                <div>
                  <Label htmlFor="pay-note" className="text-[13px] font-semibold">Note (optional)</Label>
                  <Textarea
                    id="pay-note"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Anything finance should know?"
                    className="mt-1.5 min-h-[64px] resize-none text-sm"
                    maxLength={500}
                  />
                </div>
                <div>
                  <Label htmlFor="pay-shot" className="text-[13px] font-semibold">Payment screenshot (optional)</Label>
                  <input
                    id="pay-shot"
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif"
                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                    className="mt-1.5 block w-full text-[13px] text-slate-500 file:mr-3 file:rounded-lg file:border-0 file:bg-primary/10 file:px-3 file:py-1.5 file:text-[13px] file:font-bold file:text-primary"
                  />
                </div>
                {subError && <ErrorBox message={subError} />}
                <Button
                  type="button"
                  onClick={submitRef}
                  disabled={submitting || !reference.trim()}
                  className="h-11 w-full gap-2 bg-accent font-bold text-accent-foreground hover:bg-accent/90"
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Submitting…" : "I've completed payment — send for verification"}
                </Button>
              </div>
            ) : null}

            {!done && st === "PAYMENT_SUBMITTED" && (
              <div className="flex gap-3 rounded-xl border border-violet-200 bg-violet-50 px-4 py-3.5">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <p className="text-[13px] font-semibold leading-relaxed text-violet-800">
                  Submitted with reference{" "}
                  <span className="font-mono">{detail?.payment?.submission?.reference}</span> — finance is verifying
                  your payment.
                </p>
              </div>
            )}

            {!done && st === "REJECTED" && detail?.payment?.rejectReason && (
              <div className="flex gap-3 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-rose-500" />
                <p className="text-[13px] font-semibold leading-relaxed text-rose-700">
                  This submission was rejected: {detail.payment.rejectReason}
                </p>
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={onClose} disabled={submitting} className="w-full sm:w-auto">
                {done ? "Done" : "Close"}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function BillingPage() {
  const overview = useResource(fetchBillingOverview, "Could not load your billing summary — please try again.");
  const invoices = useResource(fetchMyInvoices, "Could not load your invoices — please try again.");
  const payments = useResource(fetchMyPayments, "Could not load your payments — please try again.");
  const wallet = useResource(fetchWallet, "Could not load your wallet — please try again.");
  const referralInfo = useResource(fetchReferralInfo, "Could not load your referral info — please try again.");
  const points = useResource(fetchReferralPoints, "Could not load your points — please try again.");

  const refreshAll = () => {
    overview.reload();
    invoices.reload();
    payments.reload();
    wallet.reload();
  };

  /* Pay-from-wallet dialog (re-fetches the wallet so the shown balance is current). */
  const [payTarget, setPayTarget] = useState(null); // invoice
  const [payWallet, setPayWallet] = useState(null);
  const [payWalletError, setPayWalletError] = useState("");
  const [payWalletBusy, setPayWalletBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const openPay = (inv) => {
    setPayTarget(inv);
    setPayError("");
    setPayWallet(null);
    setPayWalletError("");
    loadPayWallet();
  };
  const loadPayWallet = () => {
    setPayWalletBusy(true);
    setPayWalletError("");
    fetchWallet()
      .then((w) => setPayWallet(w))
      .catch(() => setPayWalletError("Could not load your current wallet balance — try again."))
      .finally(() => setPayWalletBusy(false));
  };
  const closePay = () => {
    if (paying) return;
    setPayTarget(null);
    setPayWallet(null);
    setPayWalletError("");
    setPayError("");
  };
  const confirmPay = async () => {
    if (!payTarget) return;
    setPaying(true);
    setPayError("");
    try {
      const res = await payInvoiceFromWallet(payTarget.invoiceId || payTarget._id);
      toast.success(res.message || "Payment successful");
      setPayTarget(null);
      setPayWallet(null);
      refreshAll();
    } catch (err) {
      setPayError(err?.response?.data?.message || "The payment could not be completed right now. Please try again.");
    } finally {
      setPaying(false);
    }
  };
  const walletShort = payWallet !== null && Number(payWallet.balance) < Number(payTarget?.balance || 0);

  /* Cancel-invoice dialog (optional reason). */
  const [cancelTarget, setCancelTarget] = useState(null); // invoice
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const openCancel = (inv) => {
    setCancelTarget(inv);
    setCancelReason("");
    setCancelError("");
  };
  const closeCancel = () => {
    if (cancelling) return;
    setCancelTarget(null);
    setCancelReason("");
    setCancelError("");
  };
  const confirmCancel = async () => {
    if (!cancelTarget) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await cancelInvoice(cancelTarget.invoiceId || cancelTarget._id, cancelReason.trim());
      toast.success(res.message || "Invoice cancelled");
      setCancelTarget(null);
      setCancelReason("");
      refreshAll();
    } catch (err) {
      setCancelError(err?.response?.data?.message || "The invoice could not be cancelled right now. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  /* Cancel-payment dialog (pending only). */
  const [paymentCancelTarget, setPaymentCancelTarget] = useState(null); // payment
  const [paymentCancelling, setPaymentCancelling] = useState(false);
  const [paymentCancelError, setPaymentCancelError] = useState("");

  const openPaymentCancel = (pay) => {
    setPaymentCancelTarget(pay);
    setPaymentCancelError("");
  };
  const closePaymentCancel = () => {
    if (paymentCancelling) return;
    setPaymentCancelTarget(null);
    setPaymentCancelError("");
  };

  /* Pay & submit dialog (manual mobile-money / bank transfer payments). */
  const [manualPayTarget, setManualPayTarget] = useState(null);
  const openManualPay = (pay) => {
    setManualPayTarget(pay);
  };
  const closeManualPay = () => {
    setManualPayTarget(null);
  };
  const confirmPaymentCancel = async () => {
    if (!paymentCancelTarget) return;
    setPaymentCancelling(true);
    setPaymentCancelError("");
    try {
      const res = await cancelPayment(paymentCancelTarget.paymentId || paymentCancelTarget._id);
      toast.success(res.message || "Payment cancelled");
      setPaymentCancelTarget(null);
      refreshAll();
    } catch (err) {
      setPaymentCancelError(
        err?.response?.data?.message || "The payment could not be cancelled right now. Please try again.",
      );
    } finally {
      setPaymentCancelling(false);
    }
  };

  /* Top-up wallet dialog (fresh wallet fetch on open). */
  const [topupOpen, setTopupOpen] = useState(false);
  const [topupWallet, setTopupWallet] = useState(null); // fresh GET /wallet
  const [topupWalletError, setTopupWalletError] = useState("");
  const [topupWalletBusy, setTopupWalletBusy] = useState(false);
  const [topupAmount, setTopupAmount] = useState("");
  const [topupFieldError, setTopupFieldError] = useState("");
  const [topupError, setTopupError] = useState("");
  const [topupSubmitting, setTopupSubmitting] = useState(false);
  const [topupResult, setTopupResult] = useState(null); // { message, payment, paymentInstructions, ... }
  const [topupChannel, setTopupChannel] = useState(""); // "MOBILE_MONEY" | "OFFLINE" | "" until wallet loads

  const loadTopupWallet = () => {
    setTopupWalletBusy(true);
    setTopupWalletError("");
    fetchWallet()
      .then((w) => {
        setTopupWallet(w);
        const rows = Array.isArray(w.channels) ? w.channels : [];
        const hasMobileMoney = rows.some((c) => c.code === "MOBILE_MONEY");
        // Backend default: MOBILE_MONEY when enabled, else OFFLINE.
        setTopupChannel((cur) => cur || (hasMobileMoney ? "MOBILE_MONEY" : "OFFLINE"));
      })
      .catch(() => setTopupWalletError("Could not load your wallet — try again."))
      .finally(() => setTopupWalletBusy(false));
  };

  const openTopup = () => {
    setTopupResult(null);
    setTopupAmount("");
    setTopupChannel("");
    setTopupFieldError("");
    setTopupError("");
    setTopupWallet(null);
    setTopupWalletError("");
    setTopupOpen(true);
    loadTopupWallet();
  };

  const closeTopup = () => {
    if (topupSubmitting) return;
    const hadResult = Boolean(topupResult);
    setTopupOpen(false);
    setTopupResult(null);
    setTopupAmount("");
    setTopupChannel("");
    setTopupFieldError("");
    setTopupError("");
    setTopupWallet(null);
    setTopupWalletError("");
    if (hadResult) refreshAll();
  };

  const submitTopup = async (ev) => {
    ev.preventDefault();
    if (!topupWallet) return;
    setTopupFieldError("");
    setTopupError("");
    const cur = topupWallet.walletCurrency || topupWallet.currency || "USD";
    const amount = Number(topupAmount);
    if (!topupAmount.trim() || !Number.isFinite(amount) || amount <= 0) {
      setTopupFieldError("Enter the amount you want to add.");
      return;
    }
    if (topupWallet.minTopup && amount < Number(topupWallet.minTopup.amount)) {
      setTopupFieldError("Minimum top-up is " + topupMinNote(topupWallet) + ".");
      return;
    }
    setTopupSubmitting(true);
    try {
      const res = await topUpWallet({ amount, channel: topupChannel || undefined });
      setTopupResult(res);
      toast.success(res.message || "Top-up request sent");
    } catch (err) {
      // 400 messages carry the backend's own wording — show it verbatim.
      setTopupError(err?.response?.data?.message || "The top-up could not be submitted right now. Please try again.");
    } finally {
      setTopupSubmitting(false);
    }
  };

  /* Redeem-points dialog (min 1,000 pts → USD wallet credit at $0.001/pt). */
  const [redeemOpen, setRedeemOpen] = useState(false);
  const [redeemAmount, setRedeemAmount] = useState("");
  const [redeemFieldError, setRedeemFieldError] = useState("");
  const [redeemError, setRedeemError] = useState("");
  const [redeeming, setRedeeming] = useState(false);

  const openRedeem = () => {
    setRedeemAmount("");
    setRedeemFieldError("");
    setRedeemError("");
    setRedeemOpen(true);
  };
  const closeRedeem = () => {
    if (redeeming) return;
    setRedeemOpen(false);
    setRedeemAmount("");
    setRedeemFieldError("");
    setRedeemError("");
  };
  const submitRedeem = async (ev) => {
    ev.preventDefault();
    setRedeemFieldError("");
    setRedeemError("");
    const pts = Number(redeemAmount);
    if (!redeemAmount.trim() || !Number.isInteger(pts) || pts <= 0) {
      setRedeemFieldError("Enter a whole number of points to redeem.");
      return;
    }
    if (pts < 1000) {
      setRedeemFieldError("Minimum redemption is 1,000 points.");
      return;
    }
    const balance = Number(points.data?.balance);
    if (Number.isFinite(balance) && pts > balance) {
      setRedeemFieldError("You only have " + balance + " points — try a smaller amount.");
      return;
    }
    setRedeeming(true);
    try {
      const res = await redeemReferralPoints(pts);
      toast.success(res.message || "Points redeemed — credit added to your wallet");
      setRedeemOpen(false);
      setRedeemAmount("");
      // Redeemed credit lands in the USD wallet, so refresh points + wallet + overview.
      points.reload();
      wallet.reload();
      overview.reload();
    } catch (err) {
      // 400 (below min) / 409 (over balance) carry the backend's wording — show it verbatim.
      setRedeemError(err?.response?.data?.message || "The redemption could not be completed right now. Please try again.");
    } finally {
      setRedeeming(false);
    }
  };

  /* Top-up dialog derived values (live channels → chooser options, momo config, built USSD string). */
  const topupAmountNum = Number(topupAmount);
  const topupAmountValid =
    topupWallet !== null &&
    topupAmount.trim() !== "" &&
    Number.isFinite(topupAmountNum) &&
    topupAmountNum > 0 &&
    (!topupWallet.minTopup || topupAmountNum >= Number(topupWallet.minTopup.amount));
  const topupChannelRows = Array.isArray(topupWallet?.channels) ? topupWallet.channels : [];
  const mmChannel = topupChannelRows.find((c) => c.code === "MOBILE_MONEY") || null;
  const offlineChannel = topupChannelRows.find((c) => c.code === "OFFLINE") || null;
  const momoConfig = topupWallet?.momo || null; // public summary {method, network, enabled} only
  const topupWalletCur = topupWallet ? topupWallet.walletCurrency || topupWallet.currency || "USD" : "USD";
  const showTopupChooser = Boolean(mmChannel || offlineChannel);
  // The public code/QR for an exact amount is delivered per payment (see the
  // payment card after a top-up) — never built from private config here.
  const ussdCode = null;

  /* Derived numbers — tiles lean on the live lists when the overview is unavailable. */
  const ov = overview.data;
  const invoiceRows = invoices.data;
  const paymentRows = payments.data;
  const walletData = wallet.data;

  // Member-facing wallet display: walletCurrency (UGX for Uganda members, else USD) with per-currency balances.
  const walletCur = walletData?.walletCurrency || walletData?.currency || "USD";
  const walletBalances = walletData?.balances || {};
  const memberBalance = walletBalances[walletCur] ?? walletData?.balance ?? null;
  const usdTotalText =
    walletCur !== "USD" && walletBalances.USD != null
      ? "USD total " + (money(walletBalances.USD, "USD") || "—")
      : null;

  const walletTile = ov?.wallet
    ? { balance: ov.wallet.balance, currency: ov.wallet.currency }
    : walletData && walletData.balance != null
      ? { balance: walletData.balance, currency: walletData.currency }
      : null;
  const openRows = (invoiceRows || []).filter((i) => i.status === "ISSUED" || i.status === "PARTIAL");
  const openBalance =
    invoiceRows !== null
      ? openRows.reduce((sum, i) => sum + (Number(i.balance) || 0), 0)
      : ov && ov.openBalance != null
        ? Number(ov.openBalance)
        : null;
  const openCount =
    ov && ov.openInvoiceCount != null ? ov.openInvoiceCount : invoiceRows !== null ? openRows.length : null;
  const pendingCount =
    ov && ov.unpaidPayments != null
      ? ov.unpaidPayments
      : paymentRows !== null
        ? paymentRows.filter((p) => p.status === "PENDING").length
        : null;

  const instructions = ov?.paymentInstructions;
  const configuredChannels = Array.isArray(ov?.channels)
    ? ov.channels.filter((c) => c.configured).map((c) => c.label || c.code)
    : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">Billing</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Invoices, payments and your account credit in one place.
        </p>
      </header>

      {/* Summary tiles */}
      <section aria-label="Billing summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Tile icon={Wallet} label="Wallet (USD)" sub="Account credit · US-dollar total">
          {!overview.error && walletTile === null && overview.data === null && walletData === null ? (
            <Skeleton className="h-8 w-28" />
          ) : walletTile ? (
            money(walletTile.balance, walletTile.currency)
          ) : (
            "—"
          )}
        </Tile>
        <Tile icon={Receipt} label="Open balance" sub={"Sum of " + (openCount == null ? "open invoices" : openCount === 1 ? "1 open invoice" : openCount + " open invoices")}>
          {!invoices.error && invoiceRows === null ? (
            <Skeleton className="h-8 w-28" />
          ) : (
            <span className={openBalance > 0 ? "text-amber-600" : ""}>
              {openBalance === null ? "—" : money(openBalance, "USD")}
            </span>
          )}
        </Tile>
        <Tile icon={CreditCard} label="Pending payments" sub="Awaiting confirmation">
          {!payments.error && paymentRows === null ? (
            <Skeleton className="h-8 w-16" />
          ) : pendingCount == null ? (
            "—"
          ) : (
            <span className={pendingCount > 0 ? "text-amber-600" : ""}>{pendingCount}</span>
          )}
        </Tile>
      </section>

      {/* Invoices */}
      <section aria-label="Invoices" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Receipt className="h-5 w-5 text-primary" /> Invoices
          </h2>
          {invoiceRows !== null && invoiceRows.length > 0 && (
            <span className="text-[13px] text-slate-400">{invoiceRows.length} on file</span>
          )}
        </div>

        {invoices.error ? (
          <SectionError message={invoices.error} onRetry={invoices.reload} busy={invoices.busy} />
        ) : null}

        {invoiceRows === null && !invoices.error && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[118px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {invoiceRows !== null && invoiceRows.length === 0 && (
          <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <Receipt className="h-5 w-5 text-slate-300" />
            </span>
            <p className="mt-3 font-display text-[15px] font-bold text-foreground">No invoices yet</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              When a package is ready to ship, checking it out creates your invoice here.
            </p>
            <Link
              to="/account/packages"
              className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-bold text-white shadow-sm transition hover:bg-accent/90"
            >
              Browse packages <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        )}

        {invoiceRows !== null && invoiceRows.length > 0 && (
          <ul className="space-y-3">
            {invoiceRows.map((inv) => {
              const payable =
                (inv.status === "ISSUED" || inv.status === "PARTIAL") && Number(inv.balance || 0) > 0;
              return (
                <li key={inv._id} className="rounded-xl border border-[#e5eaf2] bg-white px-5 py-4">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <Link
                          to={"/account/invoices/" + encodeURIComponent(inv.invoiceId || inv._id)}
                          className="font-mono text-[14px] font-bold tracking-tight text-foreground transition-colors hover:text-primary"
                        >
                          {inv.invoiceId || inv._id}
                        </Link>
                        <Chip status={inv.status} style={INVOICE_STYLE} text={INVOICE_TEXT} />
                        {inv.status === "PAID" && inv.paidAt && (
                          <span className="text-[12px] text-slate-400">Paid {fmtDate(inv.paidAt)}</span>
                        )}
                      </div>
                      <p className="mt-1.5 text-[13px] text-slate-500">
                        {Array.isArray(inv.packageRefs) && inv.packageRefs.length > 0
                          ? inv.packageRefs.join(", ") + " · "
                          : ""}
                        Created {fmtDate(inv.createdAt)}
                      </p>
                      {inv.dueNote && (
                        <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] font-semibold text-amber-700">
                          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {inv.dueNote}
                        </p>
                      )}
                    </div>
                    <div className="shrink-0 space-y-1 text-right">
                      <p className="text-[15px]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Total </span>
                        <span className="font-mono font-semibold text-foreground">
                          {money(inv.total, inv.currency) || "—"}
                        </span>
                      </p>
                      <p className="text-[15px]">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Balance </span>
                        <span className={"font-mono font-semibold " + (Number(inv.balance) > 0 ? "text-amber-700" : "text-slate-500")}>
                          {money(inv.balance, inv.currency) || "—"}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border/60 pt-3">
                    <Link
                      to={"/account/invoices/" + encodeURIComponent(inv.invoiceId || inv._id)}
                      className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e5eaf2] bg-white px-3.5 text-[13px] font-bold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      View
                    </Link>
                    {payable && (
                      <button
                        type="button"
                        onClick={() => openPay(inv)}
                        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
                      >
                        <Wallet className="h-3.5 w-3.5" /> Pay from wallet
                      </button>
                    )}
                    {inv.status === "ISSUED" && (
                      <button
                        type="button"
                        onClick={() => openCancel(inv)}
                        className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/5"
                      >
                        Cancel invoice
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Payments */}
      <section aria-label="Payments" id="payments" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <CreditCard className="h-5 w-5 text-primary" /> Payments
          </h2>
          {paymentRows !== null && paymentRows.length > 0 && (
            <span className="text-[13px] text-slate-400">{paymentRows.length} on record</span>
          )}
        </div>

        {payments.error ? (
          <SectionError message={payments.error} onRetry={payments.reload} busy={payments.busy} />
        ) : null}

        {paymentRows === null && !payments.error && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-[86px] w-full rounded-xl" />
            ))}
          </div>
        )}

        {paymentRows !== null && paymentRows.length === 0 && (
          <div className="flex min-h-[200px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <CreditCard className="h-5 w-5 text-slate-300" />
            </span>
            <p className="mt-3 font-display text-[15px] font-bold text-foreground">No payments yet</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Payments you make toward your invoices will appear here.
            </p>
          </div>
        )}

        {paymentRows !== null && paymentRows.length > 0 && (
          <ul className="space-y-2">
            {paymentRows.map((pay) => (
              <li key={pay._id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#e5eaf2] bg-white px-5 py-3.5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[13.5px] font-bold text-foreground">
                      {pay.paymentId || pay._id}
                    </span>
                    <Chip status={pay.status} style={PAYMENT_STYLE} text={PAYMENT_TEXT} />
                    <span className="rounded-full bg-surface-muted px-2 py-0.5 text-[10.5px] font-bold uppercase tracking-wide text-slate-500">
                      {pay.type === "TOPUP" ? "Wallet top-up" : "Invoice payment"}
                    </span>
                  </div>
                  <p className="mt-1 text-[13px] text-slate-500">
                    {channelLabel(pay.channel)}
                    {pay.invoiceId && String(pay.invoiceId).startsWith("SKI-") ? (
                      <>
                        {" · "}
                        <Link
                          to={"/account/invoices/" + encodeURIComponent(pay.invoiceId)}
                          className="font-semibold text-primary hover:underline"
                        >
                          {pay.invoiceId}
                        </Link>
                      </>
                    ) : null}
                    {pay.status === "PAID" && pay.paidAt ? " · paid " + fmtDate(pay.paidAt) : " · " + fmtDate(pay.createdAt)}
                  </p>
                  {pay.rejectReason && (
                    <p className="mt-1 text-[12.5px] text-destructive">{pay.rejectReason}</p>
                  )}
                  {pay.note && <p className="mt-1 text-[12.5px] italic text-slate-400">"{pay.note}"</p>}
                </div>
                <div className="flex shrink-0 items-center gap-3">
                  <span className="font-mono text-[15px] font-bold text-foreground">
                    {fmtAmount(pay.amount, pay.currency) || "—"}
                  </span>
                  {pay.status === "PENDING" && pay.channel === "MPESA" && (
                    <button
                      type="button"
                      onClick={() => openManualPay(pay)}
                      className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
                    >
                      Pay with M-Pesa
                    </button>
                  )}
                  {(pay.status === "PROCESSING" || pay.status === "EXPIRED" || pay.status === "FAILED") && pay.channel === "MPESA" && (
                    <button
                      type="button"
                      onClick={() => openManualPay(pay)}
                      className="inline-flex h-9 items-center rounded-lg bg-sky-50 px-3 text-[13px] font-bold text-sky-700 transition-colors hover:bg-sky-100"
                    >
                      {pay.status === "PROCESSING" ? "View status" : "Try M-Pesa again"}
                    </button>
                  )}
                  {pay.status === "PENDING" && (pay.channel === "MOBILE_MONEY" || pay.channel === "OFFLINE") && (
                    <button
                      type="button"
                      onClick={() => openManualPay(pay)}
                      className="inline-flex h-9 items-center rounded-lg bg-accent px-3 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
                    >
                      Pay & submit
                    </button>
                  )}
                  {pay.status === "PENDING" && (
                    <button
                      type="button"
                      onClick={() => openPaymentCancel(pay)}
                      className="inline-flex h-9 items-center rounded-lg px-3 text-[13px] font-bold text-destructive transition-colors hover:bg-destructive/5"
                    >
                      Cancel
                    </button>
                  )}
                  {pay.status === "PAYMENT_SUBMITTED" && (
                    <button
                      type="button"
                      onClick={() => openManualPay(pay)}
                      className="inline-flex h-9 items-center rounded-lg border border-violet-200 bg-violet-50 px-3 text-[13px] font-bold text-violet-700 transition-colors hover:bg-violet-100"
                    >
                      View submission
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Wallet */}
      <section aria-label="Wallet" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Wallet className="h-5 w-5 text-primary" /> Wallet
          </h2>
          <button
            type="button"
            onClick={openTopup}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
          >
            <Plus className="h-3.5 w-3.5" /> Top up wallet
          </button>
        </div>

        {wallet.error ? (
          <SectionError message={wallet.error} onRetry={wallet.reload} busy={wallet.busy} />
        ) : null}

        {walletData === null && !wallet.error && (
          <div className="space-y-3 rounded-xl border border-[#e5eaf2] bg-white p-6">
            <Skeleton className="h-10 w-48" />
            <Skeleton className="h-40 w-full rounded-lg" />
          </div>
        )}

        {walletData !== null && (
          <div className="overflow-hidden rounded-xl border border-[#e5eaf2] bg-white">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 bg-surface/40 px-5 py-4">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Available balance</p>
                <p className="mt-1 font-display text-[24px] font-extrabold leading-none text-foreground">
                  {fmtAmount(memberBalance, walletCur) || "—"}
                </p>
              </div>
              <div className="text-right">
                <p className="rounded-full bg-surface-muted px-3 py-1 text-[12px] font-bold uppercase tracking-wide text-slate-500">
                  {walletCur}
                </p>
                {usdTotalText && <p className="mt-1.5 text-[12px] text-slate-400">{usdTotalText}</p>}
              </div>
            </div>

            {(!walletData.entries || walletData.entries.length === 0) && (
              <p className="px-5 py-8 text-center text-sm text-muted-foreground">
                No wallet activity yet — credits and debits will appear here as they happen.
              </p>
            )}

            {walletData.entries && walletData.entries.length > 0 && (
              <ul className="divide-y divide-border/60">
                {walletData.entries.map((e, i) => {
                  const credit = e.type === "CREDIT";
                  const amt = fmtAmount(Math.abs(Number(e.amount) || 0), e.currency || walletCur);
                  return (
                    <li key={e._id || i} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground">{e.reason || (credit ? "Credit" : "Debit")}</p>
                        <p className="text-[12.5px] text-slate-400">
                          {e.actor ? "by " + e.actor + " · " : ""}
                          {fmtDateTime(e.createdAt)}
                        </p>
                      </div>
                      <span className={"font-mono text-[14.5px] font-bold " + (credit ? "text-emerald-600" : "text-slate-600")}>
                        {credit ? "+" : "−"}
                        {amt || "—"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Refer & earn */}
      <section aria-label="Refer and earn" className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
            <Gift className="h-5 w-5 text-primary" /> Refer & earn
          </h2>
          {points.data !== null && !points.error && Number(points.data.balance) >= 1000 && (
            <button
              type="button"
              onClick={openRedeem}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-[13px] font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              <Coins className="h-3.5 w-3.5" /> Redeem points
            </button>
          )}
        </div>

        <div className="grid items-start gap-4 lg:grid-cols-2">
          {/* Referral code & link */}
          <div className="rounded-xl border border-[#e5eaf2] bg-white p-5">
            {referralInfo.error ? (
              <SectionError message={referralInfo.error} onRetry={referralInfo.reload} busy={referralInfo.busy} />
            ) : referralInfo.data === null ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-8 w-56" />
                <Skeleton className="h-8 w-full" />
              </div>
            ) : (
              <>
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your referral code</p>
                <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
                  <span className="font-mono text-[20px] font-extrabold tracking-tight text-foreground">
                    {referralInfo.data.code}
                  </span>
                  <CopyButton value={referralInfo.data.code} label="Copy" />
                </div>

                <p className="mt-4 text-[11px] font-bold uppercase tracking-wider text-slate-400">Your link</p>
                <div className="mt-1.5 flex items-center justify-between gap-3 rounded-lg border border-[#e5eaf2] bg-surface/40 px-3 py-2">
                  <code className="min-w-0 flex-1 break-all font-mono text-[12px] text-slate-600">
                    {referralInfo.data.link}
                  </code>
                  <CopyButton value={referralInfo.data.link} label="Copy" />
                </div>

                {referralInfo.data.stats &&
                  (referralInfo.data.stats.invitedSignups != null || referralInfo.data.stats.accepted != null) && (
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      {referralInfo.data.stats.invitedSignups != null && (
                        <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-bold text-slate-600">
                          {referralInfo.data.stats.invitedSignups} signed up
                        </span>
                      )}
                      {referralInfo.data.stats.accepted != null && (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[12px] font-bold text-emerald-700">
                          {referralInfo.data.stats.accepted} approved
                        </span>
                      )}
                    </div>
                  )}

                <p className="mt-3 text-[13px] leading-relaxed text-slate-600">
                  Share your link — your friend earns their mailboxes, and once their membership is approved you
                  earn 1,000 points (≈ USD 1.00 shipping credit).
                </p>
              </>
            )}
          </div>

          {/* Points balance & history */}
          <div className="rounded-xl border border-[#e5eaf2] bg-white p-5">
            {points.error ? (
              <SectionError message={points.error} onRetry={points.reload} busy={points.busy} />
            ) : points.data === null ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <>
                <div className="flex flex-wrap items-baseline gap-1.5">
                  <span className="font-display text-[26px] font-extrabold leading-none text-foreground">
                    {points.data.balance}
                  </span>
                  <span className="text-sm font-semibold text-slate-400">pts</span>
                </div>
                <p className="mt-1 text-[12px] text-slate-400">1,000 points = USD 1.00 of wallet credit</p>

                {!points.data.entries || points.data.entries.length === 0 ? (
                  <p className="mt-4 rounded-lg bg-surface/50 px-3.5 py-3 text-[13px] leading-relaxed text-slate-500">
                    No points yet — when a friend you referred is approved, 1,000 points land here.
                  </p>
                ) : (
                  <ul className="mt-3 divide-y divide-border/60 border-t border-border/70">
                    {points.data.entries.map((en, i) => {
                      const credit = en.type === "CREDIT";
                      return (
                        <li key={en._id || i} className="flex items-center justify-between gap-3 py-2.5">
                          <div className="min-w-0">
                            <p className="text-[13.5px] font-semibold text-foreground">
                              {en.reason || (credit ? "Points earned" : "Points redeemed")}
                            </p>
                            <p className="text-[12px] text-slate-400">{fmtDateTime(en.createdAt)}</p>
                          </div>
                          <span
                            className={
                              "font-mono text-[13.5px] font-bold " +
                              (credit ? "text-emerald-600" : "text-slate-600")
                            }
                          >
                            {credit ? "+" : "−"}
                            {Math.abs(Number(en.points) || 0)} pts
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}

                {Number(points.data.balance) < 1000 && (
                  <p className="mt-3 text-[12px] leading-relaxed text-slate-500">
                    Redeeming starts at 1,000 points — each approved friend earns you exactly that.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Payment channels */}
      <section aria-label="Payment channels" className="space-y-3">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Landmark className="h-5 w-5 text-primary" /> Payment channels
        </h2>

        {instructions ? (
          <div className="rounded-xl border border-primary/20 bg-primary/5 px-5 py-4">
            <div className="flex gap-3">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-bold text-foreground">How to pay for this checkout</p>
                <Instructions value={instructions} />
                {configuredChannels.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <span className="text-[12px] font-bold uppercase tracking-wider text-slate-400">Channels</span>
                    {configuredChannels.map((c) => (
                      <span key={c} className="rounded-full bg-white px-2.5 py-1 text-[12px] font-bold text-emerald-700">
                        {c}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl border border-[#e5eaf2] bg-surface/50 px-5 py-4">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
            <p className="text-sm leading-relaxed text-slate-600">
              Payment instructions are not configured yet — finance will confirm your payment manually once it lands.
              MTN Mobile Money / Airtel Money / card are not connected yet (provider credentials required).
            </p>
          </div>
        )}
      </section>

      {/* --------------------------- pay from wallet dialog --------------------------- */}
      <Dialog open={Boolean(payTarget)} onOpenChange={(o) => !o && closePay()}>
        <DialogContent className="max-w-md rounded-2xl">
          {payTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Wallet className="h-5 w-5 text-primary" /> Pay from wallet
                </DialogTitle>
                <DialogDescription>
                  Pay invoice <span className="font-mono font-semibold text-foreground">{payTarget.invoiceId || payTarget._id}</span>{" "}
                  with your account credit.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 rounded-xl bg-surface/60 px-4 py-3.5 text-sm">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Balance due</span>
                  <span className="font-mono font-bold text-foreground">
                    {money(payTarget.balance, payTarget.currency) || "—"}
                  </span>
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Wallet balance</span>
                  {payWalletBusy ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                    </span>
                  ) : payWallet ? (
                    <span className="font-mono font-bold text-foreground">
                      {money(payWallet.balance, payWallet.currency) || "—"}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </p>
                {payWalletError && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-destructive">{payWalletError}</span>
                    <button
                      type="button"
                      onClick={loadPayWallet}
                      className="text-[12.5px] font-bold text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>

              {walletShort && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-[12.5px] font-semibold leading-relaxed text-amber-800">
                    Your wallet balance is below the balance due — the server will reject the payment until your
                    account credit covers it.
                  </p>
                </div>
              )}

              {payError && <ErrorBox message={payError} />}

              <DialogFooter>
                <Button variant="outline" onClick={closePay} disabled={paying}>
                  Cancel
                </Button>
                <Button
                  onClick={confirmPay}
                  disabled={paying || payWallet === null}
                  className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {paying ? "Paying…" : "Confirm payment"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --------------------------- cancel invoice dialog --------------------------- */}
      <Dialog open={Boolean(cancelTarget)} onOpenChange={(o) => !o && closeCancel()}>
        <DialogContent className="max-w-md rounded-2xl">
          {cancelTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Receipt className="h-5 w-5 text-destructive" /> Cancel invoice
                </DialogTitle>
                <DialogDescription>
                  Cancel invoice{" "}
                  <span className="font-mono font-semibold text-foreground">{cancelTarget.invoiceId || cancelTarget._id}</span>?
                  Only unpaid invoices that haven't shipped can be cancelled — we'll tell you if this one no longer qualifies.
                </DialogDescription>
              </DialogHeader>

              <Textarea
                rows={2}
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Reason (optional) — helps our team understand"
                maxLength={500}
                className="rounded-xl border-border bg-white"
              />

              {cancelError && <ErrorBox message={cancelError} />}

              <DialogFooter>
                <Button variant="outline" onClick={closeCancel} disabled={cancelling}>
                  Keep invoice
                </Button>
                <Button
                  onClick={confirmCancel}
                  disabled={cancelling}
                  className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {cancelling ? "Cancelling…" : "Cancel invoice"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --------------------------- cancel payment dialog --------------------------- */}
      <Dialog open={Boolean(paymentCancelTarget)} onOpenChange={(o) => !o && closePaymentCancel()}>
        <DialogContent className="max-w-md rounded-2xl">
          {paymentCancelTarget && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <CreditCard className="h-5 w-5 text-destructive" /> Cancel payment
                </DialogTitle>
                <DialogDescription>
                  Cancel pending payment{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {paymentCancelTarget.paymentId || paymentCancelTarget._id}
                  </span>
                  ? If you already sent money by bank transfer, don't cancel — contact finance instead.
                </DialogDescription>
              </DialogHeader>

              {paymentCancelError && <ErrorBox message={paymentCancelError} />}

              <DialogFooter>
                <Button variant="outline" onClick={closePaymentCancel} disabled={paymentCancelling}>
                  Keep payment
                </Button>
                <Button
                  onClick={confirmPaymentCancel}
                  disabled={paymentCancelling}
                  className="gap-2 bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {paymentCancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {paymentCancelling ? "Cancelling…" : "Cancel payment"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {manualPayTarget && (
        <PaymentPayDialog payment={manualPayTarget} onClose={closeManualPay} onDone={refreshAll} />
      )}

      {/* --------------------------- top up wallet dialog --------------------------- */}
      <Dialog open={topupOpen} onOpenChange={(o) => !o && closeTopup()}>
        <DialogContent className="max-w-md rounded-2xl">
          {topupResult ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600" /> Top-up request sent
                </DialogTitle>
                <DialogDescription>
                  Payment{" "}
                  <span className="font-mono font-semibold text-foreground">
                    {topupResult.payment?.paymentId || topupResult.payment?._id || "…"}
                  </span>
                  {" · "}
                  {fmtAmount(
                    topupResult.payment?.amount,
                    topupResult.payment?.currency || topupWallet?.walletCurrency || "USD",
                  ) || "—"}
                  {topupResult.payment?.status ? (
                    <>
                      {" · "}
                      <Chip status={topupResult.payment.status} style={PAYMENT_STYLE} text={PAYMENT_TEXT} />
                    </>
                  ) : null}
                  {topupResult.payment?.channel ? (
                    <>
                      {" · "}
                      <span className="inline-flex rounded-full bg-surface-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                        {channelLabel(topupResult.payment.channel)}
                      </span>
                    </>
                  ) : null}
                </DialogDescription>
              </DialogHeader>

              <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                <p className="text-[12.5px] font-semibold leading-relaxed text-amber-800">
                  Your top-up is pending — it will be credited to the wallet after we confirm the transfer. Finance
                  verifies these payments in the queue before the ledger is credited.
                </p>
              </div>

              {topupResult.paymentInstructions ? (
                <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
                  <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1 space-y-2">
                    <p className="text-sm font-bold text-foreground">How to pay</p>
                    <Instructions value={topupResult.paymentInstructions} />
                  </div>
                </div>
              ) : (
                <div className="flex gap-3 rounded-xl border border-[#e5eaf2] bg-surface/50 px-4 py-3.5">
                  <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
                  <p className="text-sm leading-relaxed text-slate-600">
                    Payment instructions are not configured yet — finance will confirm your payment manually once it
                    lands. MTN Mobile Money / Airtel Money / card are not connected yet (provider credentials
                    required).
                  </p>
                </div>
              )}

              <p className="text-[13px] leading-relaxed text-slate-500">
                Track it any time under Payments on this page —{" "}
                <a href="#payments" onClick={closeTopup} className="font-bold text-primary hover:underline">
                  View in Payments
                </a>
                .
              </p>

              <DialogFooter className="sm:justify-between">
                {(topupResult.payment?.channel === "MOBILE_MONEY" || topupResult.payment?.channel === "OFFLINE") &&
                topupResult.payment?.status === "PENDING" ? (
                  <Button
                    type="button"
                    onClick={() => {
                      const p = topupResult.payment;
                      setTopupResult(null);
                      setTopupOpen(false);
                      setManualPayTarget(p);
                    }}
                    className="gap-2 bg-accent font-bold text-accent-foreground hover:bg-accent/90"
                  >
                    <Smartphone className="h-4 w-4" /> Scan & pay now
                  </Button>
                ) : (
                  <span />
                )}
                <Button type="button" onClick={closeTopup} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Wallet className="h-5 w-5 text-primary" /> Top up wallet
                </DialogTitle>
                <DialogDescription>
                  Add credit to your account wallet. A payment request is created now; the wallet is credited after
                  finance verifies the transfer.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-2.5 rounded-xl bg-surface/60 px-4 py-3.5 text-sm">
                <p className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Wallet currency</span>
                  {topupWalletBusy ? (
                    <span className="flex items-center gap-1.5 text-slate-400">
                      <Loader2 className="h-3.5 w-3.5 animate-spin" /> Checking…
                    </span>
                  ) : (
                    <span className="font-bold text-foreground">
                      {topupWallet ? topupWallet.walletCurrency || topupWallet.currency || "USD" : "—"}
                    </span>
                  )}
                </p>
                <p className="flex items-center justify-between gap-3">
                  <span className="text-slate-500">Current balance</span>
                  {topupWallet ? (
                    <span className="font-mono font-bold text-foreground">
                      {fmtAmount(
                        topupWallet.balances?.[topupWallet.walletCurrency || "USD"] ?? topupWallet.balance,
                        topupWallet.walletCurrency || topupWallet.currency || "USD",
                      ) || "—"}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </p>
                {topupWallet && topupMinNote(topupWallet) && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Minimum top-up</span>
                    <span className="font-semibold text-foreground">{topupMinNote(topupWallet)}</span>
                  </p>
                )}
                {topupWalletError && (
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-[12.5px] text-destructive">{topupWalletError}</span>
                    <button
                      type="button"
                      onClick={loadTopupWallet}
                      className="text-[12.5px] font-bold text-primary hover:underline"
                    >
                      Retry
                    </button>
                  </p>
                )}
              </div>

              <form onSubmit={submitTopup} noValidate className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="tu-amount" className="text-[14px] font-semibold text-foreground">
                    Amount to top up
                  </Label>
                  <div className="relative">
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[14px] font-bold text-slate-400"
                    >
                      {topupWallet ? curSymbol(topupWallet.walletCurrency || topupWallet.currency || "USD") : "…"}
                    </span>
                    <Input
                      id="tu-amount"
                      type="number"
                      min="0"
                      step="any"
                      value={topupAmount}
                      onChange={(e) => setTopupAmount(e.target.value)}
                      placeholder={
                        topupWallet && (topupWallet.walletCurrency || topupWallet.currency) === "UGX"
                          ? "e.g. 50000"
                          : "e.g. 25.00"
                      }
                      className={inputCls + " pl-14" + (topupFieldError ? " border-destructive/60" : "")}
                      disabled={!topupWallet}
                    />
                  </div>
                  {topupFieldError && (
                    <p className="text-[12.5px] font-medium text-destructive">{topupFieldError}</p>
                  )}
                  {topupWallet &&
                    !topupWalletError &&
                    (topupWallet.walletCurrency || topupWallet.currency) === "UGX" &&
                    Number(topupWallet.rateUsdUgx) > 0 && (
                      <p className="text-[12px] text-slate-400">
                        Guide rate: 1 USD ≈ {Number(topupWallet.rateUsdUgx).toLocaleString("en-US")} UGX — the exact
                        rate is fixed when finance verifies the payment.
                      </p>
                    )}
                </div>

                {showTopupChooser && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                      How do you want to pay?
                    </p>
                    <div role="radiogroup" aria-label="Top-up payment option" className="space-y-1.5">
                      {mmChannel && (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={topupChannel === "MOBILE_MONEY"}
                          onClick={() => setTopupChannel("MOBILE_MONEY")}
                          className={
                            "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors " +
                            (topupChannel === "MOBILE_MONEY"
                              ? "border-primary/40 bg-primary/5"
                              : "border-[#e5eaf2] bg-white hover:border-slate-300")
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " +
                              (topupChannel === "MOBILE_MONEY" ? "border-primary" : "border-slate-300")
                            }
                          >
                            {topupChannel === "MOBILE_MONEY" && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-bold text-foreground">
                              Mobile money (MTN / Airtel)
                            </span>
                            {momoConfig?.networkLabel && (
                              <span className="mt-0.5 block truncate text-[12px] text-slate-500">
                                {momoConfig.networkLabel ? momoConfig.networkLabel : "Mobile money"}
                              </span>
                            )}
                          </span>
                        </button>
                      )}
                      {offlineChannel && (
                        <button
                          type="button"
                          role="radio"
                          aria-checked={topupChannel === "OFFLINE"}
                          onClick={() => setTopupChannel("OFFLINE")}
                          className={
                            "flex w-full items-center gap-3 rounded-lg border px-3.5 py-3 text-left transition-colors " +
                            (topupChannel === "OFFLINE"
                              ? "border-primary/40 bg-primary/5"
                              : "border-[#e5eaf2] bg-white hover:border-slate-300")
                          }
                        >
                          <span
                            aria-hidden="true"
                            className={
                              "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 " +
                              (topupChannel === "OFFLINE" ? "border-primary" : "border-slate-300")
                            }
                          >
                            {topupChannel === "OFFLINE" && (
                              <span className="h-2 w-2 rounded-full bg-primary" />
                            )}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block text-[13.5px] font-bold text-foreground">
                              Bank transfer / offline
                            </span>
                            <span className="mt-0.5 block text-[12px] text-slate-500">
                              Send money from your bank account — we confirm it manually
                            </span>
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {topupChannel === "OFFLINE" && offlineChannel && (
                  <div className="space-y-2 rounded-xl border border-[#e5eaf2] bg-white p-4">
                    <p className="flex items-center gap-2 text-sm font-bold text-foreground">
                      <Landmark className="h-4 w-4 text-primary" /> Bank transfer / offline
                    </p>
                    {offlineChannel.instructions ? (
                      <div className="flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
                        <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="text-sm font-bold text-foreground">How to pay</p>
                          <Instructions value={offlineChannel.instructions} />
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-2.5 rounded-lg border border-[#e5eaf2] bg-surface/50 px-3.5 py-3">
                        <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                        <p className="text-[13px] leading-relaxed text-slate-600">
                          Payment instructions are not configured yet — finance will confirm your payment manually
                          once it lands. MTN Mobile Money / Airtel Money / card are not connected yet (provider
                          credentials required).
                        </p>
                      </div>
                    )}
                    <p className="text-[12px] leading-relaxed text-slate-400">
                      Send the amount and keep the payment reference — your wallet is credited after finance
                      confirms the transfer.
                    </p>
                  </div>
                )}

                {topupChannelRows.some((ch) => ch.code !== "MOBILE_MONEY" && ch.code !== "OFFLINE") && (
                  <div className="space-y-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Payment channels</p>
                    <ul className="space-y-1.5">
                      {topupChannelRows
                        .filter((ch) => ch.code !== "MOBILE_MONEY" && ch.code !== "OFFLINE")
                        .map((ch) => (
                          <ChannelStatusRow key={ch.code || ch.label || "channel"} channel={ch} />
                        ))}
                    </ul>
                  </div>
                )}

                {topupError && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
                    {topupError}
                  </p>
                )}

                <DialogFooter>
                  <Button variant="outline" type="button" onClick={closeTopup} disabled={topupSubmitting}>
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    disabled={topupSubmitting || topupWallet === null}
                    className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                  >
                    {topupSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {topupSubmitting ? "Submitting…" : "Request top-up"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --------------------------- redeem points dialog --------------------------- */}
      <Dialog open={redeemOpen} onOpenChange={(o) => !o && closeRedeem()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Coins className="h-5 w-5 text-primary" /> Redeem points
            </DialogTitle>
            <DialogDescription>
              Turn points into shipping credit — 1,000 points = USD 1.00 credited to your wallet.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 rounded-xl bg-surface/60 px-4 py-3.5 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Available points</span>
              <span className="font-mono font-bold text-foreground">
                {points.data ? points.data.balance + " pts" : "—"}
              </span>
            </p>
          </div>

          <form onSubmit={submitRedeem} noValidate className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="rd-points" className="text-[14px] font-semibold text-foreground">
                Points to redeem
              </Label>
              <div className="relative">
                <Input
                  id="rd-points"
                  type="number"
                  min="1000"
                  step="1"
                  value={redeemAmount}
                  onChange={(e) => setRedeemAmount(e.target.value)}
                  placeholder="e.g. 1000"
                  className={inputCls + " pr-14" + (redeemFieldError ? " border-destructive/60" : "")}
                />
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[13px] font-bold text-slate-400"
                >
                  pts
                </span>
              </div>
              {redeemFieldError && (
                <p className="text-[12.5px] font-medium text-destructive">{redeemFieldError}</p>
              )}
              {!redeemFieldError &&
                Number.isInteger(Number(redeemAmount)) &&
                Number(redeemAmount) >= 1000 && (
                  <p className="text-[12px] text-slate-400">
                    Adds ≈ {money(Number(redeemAmount) * 0.001, "USD")} to your USD wallet balance.
                  </p>
                )}
              <p className="text-[12px] text-slate-400">
                Minimum 1,000 points — credit lands in your wallet and can be used for shipping.
              </p>
            </div>

            {redeemError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
                {redeemError}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" type="button" onClick={closeRedeem} disabled={redeeming}>
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={redeeming || points.data === null}
                className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
              >
                {redeeming ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {redeeming ? "Redeeming…" : "Redeem points"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <p className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> Billing is live — totals and balances come straight from your account.
      </p>
    </div>
  );
}
