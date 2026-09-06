import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, RefreshCw, Loader2, Wallet, Receipt, CreditCard, Truck, MapPin, CalendarDays, Info, TriangleAlert, PackageSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fetchInvoice, cancelInvoice, payInvoiceFromWallet, fetchWallet } from "@/lib/portalApi";

/* Status chip palettes — soft background + readable text, same family as the other account pages. */
const INVOICE_STYLE = {
  ISSUED: "bg-amber-100 text-amber-800",
  PARTIAL: "bg-orange-100 text-orange-700",
  PAID: "bg-emerald-100 text-emerald-700",
  VOID: "bg-slate-100 text-slate-600",
};
const INVOICE_TEXT = { ISSUED: "Issued", PARTIAL: "Partially paid", PAID: "Paid", VOID: "Void" };

const PAYMENT_STYLE = {
  PENDING: "bg-amber-100 text-amber-800",
  PAID: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-rose-100 text-rose-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};
const PAYMENT_TEXT = { PENDING: "Pending", PAID: "Paid", FAILED: "Failed", CANCELLED: "Cancelled" };

const SHIPMENT_STYLE = {
  CREATED: "bg-slate-100 text-slate-600",
  READY_FOR_CARRIER: "bg-sky-100 text-sky-700",
  PICKED_UP: "bg-blue-100 text-blue-700",
  IN_TRANSIT: "bg-indigo-100 text-indigo-700",
  CUSTOMS_CLEARANCE: "bg-violet-100 text-violet-700",
  OUT_FOR_DELIVERY: "bg-purple-100 text-purple-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  EXCEPTION: "bg-rose-100 text-rose-700",
};

const PACKAGE_STYLE = {
  READY_FOR_PAYMENT: "bg-amber-100 text-amber-800",
  SHIPMENT_CREATED: "bg-lime-100 text-lime-700",
  DISPATCHED: "bg-green-100 text-green-700",
  DELIVERED: "bg-emerald-100 text-emerald-700",
  HOLD: "bg-orange-100 text-orange-700",
  EXCEPTION: "bg-rose-100 text-rose-700",
  RETURNED: "bg-slate-100 text-slate-600",
};

const CHANNEL_LABEL = { OFFLINE: "Bank transfer / offline", WALLET: "Account credit" };

const humanize = (s) =>
  String(s || "Unknown")
    .split("_")
    .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");

const money = (v, cur = "USD") => {
  if (v === null || v === undefined || v === "") return null;
  return Number(v).toLocaleString("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 });
};

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const fmtDateTime = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
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

function Field({ label, children }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-[14.5px] font-medium text-foreground">{children || "—"}</p>
    </div>
  );
}

const addrLines = (d) =>
  [d.recipientName, d.line1, d.line2, [d.city, d.region].filter(Boolean).join(", "),
    [d.postalCode, d.country].filter(Boolean).join(" "), d.phone]
    .filter((v) => v !== null && v !== undefined && v !== "")
    .join("\n");

export default function InvoiceDetailPage() {
  const { id } = useParams();
  const [phase, setPhase] = useState("loading"); // loading | ready | notfound | error
  const [invoice, setInvoice] = useState(null);
  const [payments, setPayments] = useState([]);
  const [shipment, setShipment] = useState(null);
  const [packages, setPackages] = useState([]);

  const load = async () => {
    setPhase("loading");
    try {
      const res = await fetchInvoice(id);
      setInvoice(res.invoice);
      setPayments(Array.isArray(res.payments) ? res.payments : []);
      setShipment(res.shipment || null);
      setPackages(Array.isArray(res.packages) ? res.packages : []);
      setPhase("ready");
    } catch (err) {
      setPhase(err?.response?.status === 404 ? "notfound" : "error");
    }
  };

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    fetchInvoice(id)
      .then((res) => {
        if (!alive) return;
        setInvoice(res.invoice);
        setPayments(Array.isArray(res.payments) ? res.payments : []);
        setShipment(res.shipment || null);
        setPackages(Array.isArray(res.packages) ? res.packages : []);
        setPhase("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setPhase(err?.response?.status === 404 ? "notfound" : "error");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  /* Pay-from-wallet dialog (re-fetches the wallet so the shown balance is current). */
  const [payOpen, setPayOpen] = useState(false);
  const [payWallet, setPayWallet] = useState(null);
  const [payWalletError, setPayWalletError] = useState("");
  const [payWalletBusy, setPayWalletBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState("");

  const openPay = () => {
    setPayError("");
    setPayWallet(null);
    setPayWalletError("");
    setPayOpen(true);
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
    setPayOpen(false);
  };
  const confirmPay = async () => {
    if (!invoice) return;
    setPaying(true);
    setPayError("");
    try {
      const res = await payInvoiceFromWallet(invoice.invoiceId || invoice._id);
      toast.success(res.message || "Payment successful");
      setPayOpen(false);
      load();
    } catch (err) {
      setPayError(err?.response?.data?.message || "The payment could not be completed right now. Please try again.");
    } finally {
      setPaying(false);
    }
  };
  const walletShort = payWallet !== null && Number(payWallet.balance) < Number(invoice?.balance || 0);

  /* Cancel-invoice dialog (optional reason). */
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");

  const openCancel = () => {
    setCancelReason("");
    setCancelError("");
    setCancelOpen(true);
  };
  const confirmCancel = async () => {
    if (!invoice) return;
    setCancelling(true);
    setCancelError("");
    try {
      const res = await cancelInvoice(invoice.invoiceId || invoice._id, cancelReason.trim());
      toast.success(res.message || "Invoice cancelled");
      setCancelOpen(false);
      setCancelReason("");
      load();
    } catch (err) {
      setCancelError(err?.response?.data?.message || "The invoice could not be cancelled right now. Please try again.");
    } finally {
      setCancelling(false);
    }
  };

  /* ------------------------------- states ------------------------------- */

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-9 w-80" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-44 w-full rounded-xl" />
          <Skeleton className="h-44 w-full rounded-xl" />
        </div>
        <Skeleton className="h-56 w-full rounded-xl" />
        <Skeleton className="h-40 w-full rounded-xl" />
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Receipt className="h-6 w-6 text-slate-300" />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-foreground">Invoice not found</p>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            We couldn't find this invoice on your account. It may have been removed, or the link may be wrong.
          </p>
          <Link
            to="/account/billing"
            className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Billing
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "error" || !invoice) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-display text-lg font-bold text-foreground">Could not load this invoice</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The billing service may be offline — give it another try.
          </p>
          <Button variant="outline" className="mt-5 gap-1.5" onClick={load}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  const payable =
    (invoice.status === "ISSUED" || invoice.status === "PARTIAL") && Number(invoice.balance || 0) > 0;
  const cancelable = invoice.status === "ISSUED";
  const dest = invoice.destinationAddress || {};
  const hasDest = Object.keys(dest).length > 0;

  const timeline = [...(shipment?.events || [])].sort((a, b) => {
    const ta = new Date(a.at).getTime();
    const tb = new Date(b.at).getTime();
    return (Number.isFinite(tb) ? tb : 0) - (Number.isFinite(ta) ? ta : 0);
  });

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <Link
        to="/account/billing"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Billing
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Invoice <span className="font-mono">{invoice.invoiceId || invoice._id}</span>
            <Chip status={invoice.status} style={INVOICE_STYLE} text={INVOICE_TEXT} />
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Created {fmtDate(invoice.createdAt)}
            {invoice.paidAt ? " · paid " + fmtDate(invoice.paidAt) : ""}
            {invoice.currency ? " · " + invoice.currency : ""}
          </p>
          {invoice.dueNote && (
            <p className="mt-2 inline-flex items-start gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] font-semibold text-amber-800">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" /> {invoice.dueNote}
            </p>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {payable && (
            <button
              type="button"
              onClick={openPay}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
            >
              <Wallet className="h-4 w-4" /> Pay from wallet
            </button>
          )}
          {cancelable && (
            <button
              type="button"
              onClick={openCancel}
              className="inline-flex h-10 items-center rounded-lg border border-destructive/25 bg-white px-4 text-sm font-bold text-destructive transition-colors hover:bg-destructive/5"
            >
              Cancel invoice
            </button>
          )}
        </div>
      </header>

      {/* Deliver-to address */}
      <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Delivery address">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <MapPin className="h-5 w-5 text-primary" /> Deliver to
        </h2>
        {hasDest ? (
          <div className="mt-4 grid gap-x-8 gap-y-4 sm:grid-cols-2">
            <Field label="Recipient">{dest.recipientName}</Field>
            <Field label="Phone">{dest.phone}</Field>
            <Field label="Address"><span className="whitespace-pre-line">{addrLines(dest)}</span></Field>
            <div className="space-y-4">
              <Field label="City">{dest.city}</Field>
              <Field label="Region">{dest.region}</Field>
            </div>
            <Field label="Postal code">{dest.postalCode}</Field>
            <Field label="Country">{dest.country}</Field>
          </div>
        ) : (
          <p className="mt-4 text-sm text-muted-foreground">No destination address is on file for this invoice.</p>
        )}
      </section>

      {/* Line items */}
      <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Invoice line items">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Receipt className="h-5 w-5 text-primary" /> Line items
        </h2>

        {(invoice.lineItems || []).length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No line items were recorded on this invoice.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[420px] text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="py-2.5 pr-4">Item</th>
                  <th className="w-16 px-4 py-2.5 text-right">Qty</th>
                  <th className="w-36 px-4 py-2.5 text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.lineItems || []).map((li) => (
                  <tr key={li.code || li.label} className="border-b border-border/50 last:border-0">
                    <td className="py-3 pr-4">
                      <p className="font-semibold text-foreground">{li.label || "—"}</p>
                      {li.code && <p className="text-[12px] text-slate-400">{li.code}</p>}
                    </td>
                    <td className="px-4 py-3 text-right text-slate-600">{li.qty ?? "—"}</td>
                    <td className="px-4 py-3 text-right font-mono font-semibold text-foreground">
                      {money(li.amount, invoice.currency) || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="mt-4 space-y-1.5 border-t border-border/70 pt-4 text-sm sm:ml-auto sm:w-72">
          <p className="flex items-center justify-between gap-4">
            <span className="text-slate-500">Subtotal</span>
            <span className="font-mono font-semibold text-foreground">
              {money(invoice.subtotal, invoice.currency) || "—"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-4">
            <span className="font-bold text-foreground">Total</span>
            <span className="font-mono text-[16px] font-extrabold text-foreground">
              {money(invoice.total, invoice.currency) || "—"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-4 border-t border-border/60 pt-2">
            <span className="text-slate-500">Amount paid</span>
            <span className={"font-mono font-bold " + (Number(invoice.amountPaid) > 0 ? "text-emerald-600" : "text-slate-400")}>
              {money(invoice.amountPaid, invoice.currency) || "—"}
            </span>
          </p>
          <p className="flex items-center justify-between gap-4">
            <span className="font-semibold text-foreground">Balance due</span>
            <span className={"font-mono text-[16px] font-extrabold " + (Number(invoice.balance) > 0 ? "text-amber-700" : "text-slate-500")}>
              {money(invoice.balance, invoice.currency) || "—"}
            </span>
          </p>
        </div>
        {invoice.chargeableWeightKg != null && (
          <p className="mt-3 text-[12px] text-slate-400">Chargeable weight: {invoice.chargeableWeightKg} kg</p>
        )}
      </section>

      {/* Payments */}
      <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Payments on this invoice">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <CreditCard className="h-5 w-5 text-primary" /> Payments
        </h2>

        {payments.length === 0 ? (
          <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-8 text-center">
            <p className="text-sm font-semibold text-slate-600">No payments recorded yet</p>
            <p className="mt-1 max-w-md text-[13px] text-muted-foreground">
              Payments appear here once you pay from your wallet or finance confirms a manual transfer.
            </p>
          </div>
        ) : (
          <ul className="mt-4 space-y-2">
            {payments.map((pay) => (
              <li key={pay._id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border/70 bg-surface/40 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2.5">
                    <span className="font-mono text-[13.5px] font-bold text-foreground">
                      {pay.paymentId || pay._id}
                    </span>
                    <Chip status={pay.status} style={PAYMENT_STYLE} text={PAYMENT_TEXT} />
                  </div>
                  <p className="mt-1 text-[12.5px] text-slate-500">
                    {CHANNEL_LABEL[pay.channel] || humanize(pay.channel)}
                    {pay.status === "PAID" && pay.paidAt
                      ? " · paid " + fmtDateTime(pay.paidAt)
                      : " · " + fmtDateTime(pay.createdAt)}
                  </p>
                  {pay.rejectReason && <p className="mt-0.5 text-[12.5px] text-destructive">{pay.rejectReason}</p>}
                  {pay.note && <p className="mt-0.5 text-[12.5px] italic text-slate-400">"{pay.note}"</p>}
                </div>
                <span className="font-mono text-[14.5px] font-bold text-foreground">
                  {money(pay.amount, pay.currency) || "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Packages */}
      <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Packages on this invoice">
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <PackageSearch className="h-5 w-5 text-primary" /> Packages
        </h2>

        {packages.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">No packages are linked to this invoice.</p>
        ) : (
          <div className="mt-4 flex flex-wrap gap-2">
            {packages.map((p) => (
              <Link
                key={p._id || p.packageId}
                to={"/account/packages/" + encodeURIComponent(p.packageId || p._id)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#e5eaf2] bg-surface/40 px-3 py-2 transition-colors hover:border-primary/30"
                title={p.merchant || "View package"}
              >
                <span className="font-mono text-[12.5px] font-bold text-primary">
                  {p.packageId || p._id}
                </span>
                <Chip status={p.status} style={PACKAGE_STYLE} />
                {p.merchant && <span className="hidden text-[12px] text-slate-500 sm:inline">· {p.merchant}</span>}
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Shipment (only when one exists) */}
      {shipment && (
        <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Shipment tracking">
          <h2 className="flex flex-wrap items-center gap-2.5 font-display text-lg font-bold text-foreground">
            <Truck className="h-5 w-5 text-primary" /> Shipment
            <span className="font-mono text-[13.5px] font-semibold text-slate-500">
              {shipment.shipmentId || shipment._id}
            </span>
            <Chip status={shipment.status} style={SHIPMENT_STYLE} />
          </h2>

          {shipment.destinationAddress && Object.keys(shipment.destinationAddress).length > 0 && (
            <p className="mt-2 flex items-start gap-1.5 text-[13.5px] text-slate-500">
              <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-300" />
              <span className="whitespace-pre-line">{addrLines(shipment.destinationAddress)}</span>
            </p>
          )}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface/70 px-4 py-3">
            <span className="text-sm font-semibold text-slate-500">Tracking</span>
            <span className="text-[13px] text-slate-400">
              {shipment.dispatchedAt ? "Dispatched " + fmtDate(shipment.dispatchedAt) : "Created " + fmtDate(shipment.createdAt)}
            </span>
          </div>

          {timeline.length === 0 ? (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4 shrink-0 text-slate-300" />
              No tracking events yet — updates appear as the shipment moves.
            </p>
          ) : (
            <>
              <p className="mt-5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                Latest events <span className="font-normal normal-case">(newest first)</span>
              </p>
              <ol className="mt-3 space-y-0">
                {timeline.map((ev, i) => (
                  <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < timeline.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-border" />
                    )}
                    <span
                      aria-hidden="true"
                      className={
                        "mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white shadow " +
                        (i === 0 ? "bg-primary" : "bg-slate-300")
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{humanize(ev.status)}</p>
                      <p className="text-[12.5px] text-slate-400">
                        {ev.at ? fmtDateTime(ev.at) : ""}
                        {ev.location ? " · " + ev.location : ""}
                        {ev.actor ? " · by " + ev.actor : ""}
                      </p>
                      {ev.note && (
                        <p className="mt-1 max-w-2xl whitespace-pre-line rounded-lg bg-surface px-3 py-2 text-[13px] italic leading-relaxed text-slate-500">
                          "{ev.note}"
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </>
          )}

          {shipment.deliveredAt && (
            <p className="mt-3 flex items-center gap-1.5 text-[13px] font-semibold text-emerald-600">
              <CalendarDays className="h-3.5 w-3.5" /> Delivered {fmtDate(shipment.deliveredAt)}
            </p>
          )}
        </section>
      )}

      {/* --------------------------- pay from wallet dialog --------------------------- */}
      <Dialog open={payOpen} onOpenChange={(o) => !o && closePay()}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Wallet className="h-5 w-5 text-primary" /> Pay from wallet
            </DialogTitle>
            <DialogDescription>
              Pay invoice{" "}
              <span className="font-mono font-semibold text-foreground">{invoice.invoiceId || invoice._id}</span> with
              your account credit.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2.5 rounded-xl bg-surface/60 px-4 py-3.5 text-sm">
            <p className="flex items-center justify-between gap-3">
              <span className="text-slate-500">Balance due</span>
              <span className="font-mono font-bold text-foreground">{money(invoice.balance, invoice.currency) || "—"}</span>
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
                <button type="button" onClick={loadPayWallet} className="text-[12.5px] font-bold text-primary hover:underline">
                  Retry
                </button>
              </p>
            )}
          </div>

          {walletShort && (
            <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-[12.5px] font-semibold leading-relaxed text-amber-800">
                Your wallet balance is below the balance due — the server will reject the payment until your account
                credit covers it.
              </p>
            </div>
          )}

          {payError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
              {payError}
            </p>
          )}

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
        </DialogContent>
      </Dialog>

      {/* --------------------------- cancel invoice dialog --------------------------- */}
      <Dialog open={cancelOpen} onOpenChange={(o) => !o && setCancelOpen(false)}>
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-display">
              <Receipt className="h-5 w-5 text-destructive" /> Cancel invoice
            </DialogTitle>
            <DialogDescription>
              Cancel invoice{" "}
              <span className="font-mono font-semibold text-foreground">{invoice.invoiceId || invoice._id}</span>?
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

          {cancelError && (
            <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
              {cancelError}
            </p>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
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
        </DialogContent>
      </Dialog>
    </div>
  );
}
