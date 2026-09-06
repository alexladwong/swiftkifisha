import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, Loader2, RefreshCw, Wallet, Receipt, Store, Info, CheckCircle2,
  TriangleAlert, PackageSearch, Landmark,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { fetchPackage, createCheckout, fetchWallet, payInvoiceFromWallet } from "@/lib/portalApi";

const READY = "READY_FOR_PAYMENT";

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

const humanize = (s) =>
  String(s || "Unknown")
    .split("_")
    .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");

const money = (v, cur = "USD") => {
  if (v === null || v === undefined || v === "") return null;
  return Number(v).toLocaleString("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 });
};

const inputCls =
  "h-[46px] rounded-[10px] border border-border bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:bg-surface/60";

const fieldError = (errors, key) =>
  errors[key] ? <p className="text-[12.5px] font-medium text-destructive">{errors[key]}</p> : null;

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

/* Reads one or more package ids from ?package=…&package2=… (package3=… supported too). */
const parseIds = (searchParams) =>
  [...searchParams.entries()]
    .filter(([k, v]) => /^package\d*$/.test(k) && v && v.trim())
    .sort((a, b) => {
      const n = (k) => (k === "package" ? 0 : Number(k.slice(7)) || 0);
      return n(a[0]) - n(b[0]);
    })
    .map(([, v]) => v.trim())
    .filter((v, i, all) => all.indexOf(v) === i);

export default function CheckoutPage() {
  const [searchParams] = useSearchParams();
  const packageIds = parseIds(searchParams);
  const idsKey = packageIds.join("|");

  const [pkgs, setPkgs] = useState(null); // null = loading
  const [missing, setMissing] = useState([]);
  const [loadError, setLoadError] = useState("");
  const [busy, setBusy] = useState(false);

  const [result, setResult] = useState(null); // successful createCheckout response
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");

  const [form, setForm] = useState({
    recipientName: "", phone: "", email: "", line1: "", line2: "", city: "", region: "", postalCode: "", country: "",
  });
  const [insurance, setInsurance] = useState(false);
  const [declared, setDeclared] = useState("");
  const [declaredTouched, setDeclaredTouched] = useState(false);
  const [errors, setErrors] = useState({});

  const load = async () => {
    setLoadError("");
    setMissing([]);
    setPkgs(null);
    if (packageIds.length === 0) return;
    setBusy(true);
    try {
      const results = await Promise.allSettled(packageIds.map((id) => fetchPackage(id)));
      const found = [];
      const notFound = [];
      results.forEach((r, i) => (r.status === "fulfilled" ? found.push(r.value) : notFound.push(packageIds[i])));
      setPkgs(found);
      setMissing(notFound);
    } catch {
      setLoadError("Could not load these packages — the warehouse service may be offline.");
      setPkgs([]);
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    let alive = true;
    setLoadError("");
    setMissing([]);
    setPkgs(null);
    if (packageIds.length === 0) return undefined;
    Promise.allSettled(packageIds.map((id) => fetchPackage(id)))
      .then((results) => {
        if (!alive) return;
        const found = [];
        const notFound = [];
        results.forEach((r, i) => (r.status === "fulfilled" ? found.push(r.value) : notFound.push(packageIds[i])));
        setPkgs(found);
        setMissing(notFound);
      })
      .catch(() => alive && setLoadError("Could not load these packages — the warehouse service may be offline."));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idsKey]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const declaredTotal = (pkgs || []).reduce((s, p) => s + (Number(p.declaredValue) || 0), 0);
  const declaredShown = declaredTouched ? declared : declaredTotal ? String(declaredTotal) : "";
  const notReady = (pkgs || []).filter((p) => p.status !== READY);
  const canSubmit =
    (pkgs || []).length > 0 && missing.length === 0 && notReady.length === 0 && !saving;

  const validate = () => {
    const e = {};
    if (!form.recipientName.trim()) e.recipientName = "Recipient name is required.";
    if (!form.line1.trim()) e.line1 = "Address line 1 is required.";
    if (!form.city.trim()) e.city = "City is required.";
    if (!form.country.trim()) e.country = "Country is required.";
    if (form.email.trim() && !/^\S+@\S+\.\S+$/.test(form.email.trim())) {
      e.email = "Enter a valid email address, or leave it empty.";
    }
    const dv = Number(declaredShown);
    if (declaredShown !== "" && (!Number.isFinite(dv) || dv < 0)) {
      e.declared = "Declared value must be zero or a positive number.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    setSaving(true);
    const dv = declaredShown === "" ? undefined : Number(declaredShown);
    try {
      const res = await createCheckout({
        packageIds: (pkgs || []).map((p) => p._id || p.packageId),
        destinationAddress: {
          recipientName: form.recipientName.trim(),
          phone: form.phone.trim() || undefined,
          email: form.email.trim() || undefined,
          line1: form.line1.trim(),
          line2: form.line2.trim() || undefined,
          city: form.city.trim(),
          region: form.region.trim() || undefined,
          postalCode: form.postalCode.trim() || undefined,
          country: form.country.trim(),
        },
        insurance,
        ...(dv !== undefined ? { declaredValue: dv } : {}),
      });
      setResult(res);
      toast.success(res.message || "Checkout started");
    } catch (err) {
      // 400/403/409/404 messages surface verbatim.
      setServerError(err?.response?.data?.message || "We could not start this checkout. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  /* Pay-from-wallet dialog for the invoice just created (balance re-fetched on open). */
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
  const confirmPay = async () => {
    if (!result?.invoice) return;
    setPaying(true);
    setPayError("");
    try {
      const res = await payInvoiceFromWallet(result.invoice.invoiceId || result.invoice._id);
      toast.success(res.message || "Payment successful");
      setResult((r) => ({ ...r, invoice: res.invoice || r.invoice, payment: res.payment || r.payment }));
      setPayOpen(false);
    } catch (err) {
      setPayError(err?.response?.data?.message || "The payment could not be completed right now. Please try again.");
    } finally {
      setPaying(false);
    }
  };
  const payInvoice = result?.invoice;
  const walletShort =
    payWallet !== null && payInvoice !== null && Number(payWallet.balance) < Number(payInvoice.balance || 0);

  const emptyShell = (icon, title, body, cta) => (
    <div className="mx-auto w-full max-w-[860px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">Checkout</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Pay for packages that are ready to ship from your mailbox.
        </p>
      </header>
      <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
        <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
          {icon}
        </span>
        <p className="mt-4 font-display text-lg font-bold text-foreground">{title}</p>
        <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{body}</p>
        {cta}
      </div>
    </div>
  );

  /* ------------------------------ states ------------------------------ */

  if (result) {
    const inv = result.invoice;
    const pay = result.payment;
    const payable =
      inv &&
      (inv.status === "ISSUED" || inv.status === "PARTIAL") &&
      Number(inv.balance || 0) > 0 &&
      pay?.status !== "PAID";
    const configuredChannels = Array.isArray(result.channels)
      ? result.channels.filter((c) => c.configured).map((c) => c.label || c.code)
      : [];
    return (
      <div className="mx-auto w-full max-w-[860px]">
        <Link
          to="/account/packages"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> My Packages
        </Link>

        <div className="mt-6 rounded-xl border border-emerald-200/80 bg-white p-6 md:p-8">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </span>
          <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-foreground">
            Checkout started — invoice{" "}
            <Link
              to={"/account/invoices/" + encodeURIComponent(inv?.invoiceId || inv?._id || "")}
              className="font-mono text-primary hover:underline"
            >
              {inv?.invoiceId || inv?._id || "…"}
            </Link>
          </h2>

          <div className="mt-2 flex flex-wrap items-center gap-3">
            <p className="text-[15px] text-muted-foreground">
              Total due{" "}
              <span className="font-mono text-[17px] font-extrabold text-foreground">
                {money(inv?.total, inv?.currency) || "—"}
              </span>
            </p>
            {inv && <Chip status={inv.status} style={INVOICE_STYLE} text={INVOICE_TEXT} />}
            {pay && <Chip status={pay.status} style={PAYMENT_STYLE} text={PAYMENT_TEXT} />}
          </div>

          {pay?.status === "PENDING" && (
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Payment pending confirmation — we'll confirm your payment manually once it lands, then process your
              shipment.
            </p>
          )}
          {pay?.status === "PAID" && (
            <p className="mt-2 text-sm font-semibold leading-relaxed text-emerald-700">
              Payment confirmed — our team will process your shipment.
            </p>
          )}

          {/* Payment instructions (or an honest note that they are not configured yet). */}
          {result.paymentInstructions ? (
            <div className="mt-5 flex gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3.5">
              <Landmark className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm font-bold text-foreground">How to pay</p>
                <Instructions value={result.paymentInstructions} />
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
          ) : (
            <div className="mt-5 flex gap-3 rounded-xl border border-[#e5eaf2] bg-surface/50 px-4 py-3.5">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-slate-400" />
              <p className="text-sm leading-relaxed text-slate-600">
                Payment instructions are not configured yet — finance will confirm your payment manually once it
                lands. MTN Mobile Money / Airtel Money / card are not connected yet (provider credentials required).
              </p>
            </div>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-2.5">
            {payable && (
              <button
                type="button"
                onClick={openPay}
                className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
              >
                <Wallet className="h-4 w-4" /> Pay from wallet
              </button>
            )}
            <Link
              to={"/account/invoices/" + encodeURIComponent(inv?.invoiceId || inv?._id || "")}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#e5eaf2] bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              View invoice <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/account/packages"
              className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
            >
              Back to packages
            </Link>
          </div>
        </div>

        {/* Pay-from-wallet dialog (post-checkout) */}
        <Dialog open={payOpen} onOpenChange={(o) => !o && setPayOpen(false)}>
          <DialogContent className="max-w-md rounded-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 font-display">
                <Wallet className="h-5 w-5 text-primary" /> Pay from wallet
              </DialogTitle>
              <DialogDescription>
                Pay invoice{" "}
                <span className="font-mono font-semibold text-foreground">
                  {payInvoice?.invoiceId || payInvoice?._id}
                </span>{" "}
                with your account credit.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-2.5 rounded-xl bg-surface/60 px-4 py-3.5 text-sm">
              <p className="flex items-center justify-between gap-3">
                <span className="text-slate-500">Balance due</span>
                <span className="font-mono font-bold text-foreground">
                  {money(payInvoice?.balance, payInvoice?.currency) || "—"}
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
                  Your wallet balance is below the balance due — the server will reject the payment until your
                  account credit covers it.
                </p>
              </div>
            )}

            {payError && (
              <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
                {payError}
              </p>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => setPayOpen(false)} disabled={paying}>
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
      </div>
    );
  }

  if (packageIds.length === 0) {
    return emptyShell(
      <PackageSearch className="h-6 w-6 text-slate-300" />,
      "Nothing to check out",
      "This checkout link doesn't include any packages. Open one of your ready packages and choose Pay & ship.",
      (
        <Link
          to="/account/packages"
          className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-6 text-sm font-bold text-white shadow-sm transition hover:bg-accent/90"
        >
          Go to My Packages <ArrowRight className="h-4 w-4" />
        </Link>
      ),
    );
  }

  if (pkgs === null && !loadError) {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">Checkout</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Pay for packages that are ready to ship from your mailbox.
          </p>
        </header>
        <div className="space-y-3">
          {packageIds.map((id) => (
            <Skeleton key={id} className="h-[92px] w-full rounded-xl" />
          ))}
          <Skeleton className="h-[420px] w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (loadError) {
    return emptyShell(
      <RefreshCw className="h-6 w-6 text-slate-300" />,
      "Could not load these packages",
      loadError,
      (
        <Button variant="outline" className="mt-5 gap-1.5" onClick={load}>
          <RefreshCw className={"h-4 w-4 " + (busy ? "animate-spin" : "")} /> Try again
        </Button>
      ),
    );
  }

  if ((pkgs || []).length === 0) {
    return emptyShell(
      <PackageSearch className="h-6 w-6 text-slate-300" />,
      "Nothing to check out",
      "None of the packages in this link could be found on your account. They may have been removed, or the link may be wrong.",
      (
        <Link
          to="/account/packages"
          className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-6 text-sm font-bold text-white shadow-sm transition hover:bg-accent/90"
        >
          Go to My Packages <ArrowRight className="h-4 w-4" />
        </Link>
      ),
    );
  }

  /* ------------------------------ the form ------------------------------ */

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">Checkout</h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Confirm where these packages ship and pay — the invoice is created right here.
          </p>
        </div>
        <Link
          to="/account/packages"
          className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to My Packages
        </Link>
      </header>

      {/* Package cards */}
      <section aria-label="Packages to check out" className="space-y-3">
        {(pkgs || []).map((p) => {
          const ready = p.status === READY;
          const kg = p.chargeableWeight != null ? p.chargeableWeight : p.weight;
          return (
            <div key={p._id || p.packageId} className="rounded-xl border border-[#e5eaf2] bg-white p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface-muted">
                    <PackageSearch className="h-4.5 w-4.5 text-slate-400" style={{ width: 18, height: 18 }} />
                  </span>
                  <div>
                    <p className="font-mono text-[14px] font-bold tracking-tight text-foreground">{p.packageId}</p>
                    <p className="flex items-center gap-1.5 text-[13px] text-slate-500">
                      <Store className="h-3.5 w-3.5 text-slate-300" /> {p.merchant || "Unknown store"}
                    </p>
                  </div>
                </div>
                <div className="text-right text-[13px] text-slate-500">
                  {kg != null && <p>{kg} kg{kg === p.chargeableWeight ? " chargeable" : ""}</p>}
                  {p.declaredValue != null && (
                    <p>Declared {money(p.declaredValue, p.currency || "USD") || "—"}</p>
                  )}
                </div>
              </div>
              {!ready && (
                <div className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5">
                  <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                  <p className="text-[12.5px] font-semibold leading-relaxed text-amber-800">
                    {p.packageId} is {humanize(p.status)} and cannot be checked out yet.
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </section>

      {missing.length > 0 && (
        <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
          <p className="text-[13px] font-semibold leading-relaxed text-amber-800">
            {missing.join(", ")} could not be loaded from your account. Checkout is disabled until the link only
            points at packages that are ready to ship — go back and start again from the package page.
          </p>
        </div>
      )}

      {serverError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form
        onSubmit={submit}
        noValidate
        aria-label="Checkout details"
        className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-8"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Receipt className="h-5 w-5 text-primary" /> Destination
        </h2>
        <p className="mt-1 text-[13px] text-slate-500">
          Where should these packages be delivered after they leave the warehouse?
        </p>

        <div className="mt-5 grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="co-recipient" className="text-[14px] font-semibold text-foreground">
              Recipient name <span className="text-destructive">*</span>
            </Label>
            <Input
              id="co-recipient"
              value={form.recipientName}
              onChange={set("recipientName")}
              placeholder="Full name of the person receiving"
              maxLength={120}
              className={inputCls + (errors.recipientName ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "recipientName")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-phone" className="text-[14px] font-semibold text-foreground">Phone</Label>
            <Input
              id="co-phone"
              value={form.phone}
              onChange={set("phone")}
              placeholder="e.g. +256 7XX XXX XXX"
              maxLength={40}
              className={inputCls}
            />
            <p className="text-[12px] text-slate-400">Used by the courier for delivery calls.</p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="co-email" className="text-[14px] font-semibold text-foreground">Email</Label>
            <Input
              id="co-email"
              type="email"
              value={form.email}
              onChange={set("email")}
              placeholder="For delivery updates (optional)"
              maxLength={160}
              className={inputCls + (errors.email ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "email")}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="co-line1" className="text-[14px] font-semibold text-foreground">
              Address line 1 <span className="text-destructive">*</span>
            </Label>
            <Input
              id="co-line1"
              value={form.line1}
              onChange={set("line1")}
              placeholder="Street address, house number"
              maxLength={200}
              className={inputCls + (errors.line1 ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "line1")}
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="co-line2" className="text-[14px] font-semibold text-foreground">
              Address line 2 <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Input
              id="co-line2"
              value={form.line2}
              onChange={set("line2")}
              placeholder="Apartment, building, landmark…"
              maxLength={200}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-city" className="text-[14px] font-semibold text-foreground">
              City <span className="text-destructive">*</span>
            </Label>
            <Input
              id="co-city"
              value={form.city}
              onChange={set("city")}
              placeholder="e.g. Kampala"
              maxLength={120}
              className={inputCls + (errors.city ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "city")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-region" className="text-[14px] font-semibold text-foreground">
              Region / district
            </Label>
            <Input
              id="co-region"
              value={form.region}
              onChange={set("region")}
              placeholder="e.g. Central Region"
              maxLength={120}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-postal" className="text-[14px] font-semibold text-foreground">Postal code</Label>
            <Input
              id="co-postal"
              value={form.postalCode}
              onChange={set("postalCode")}
              placeholder="Optional"
              maxLength={20}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-country" className="text-[14px] font-semibold text-foreground">
              Country <span className="text-destructive">*</span>
            </Label>
            <Input
              id="co-country"
              value={form.country}
              onChange={set("country")}
              placeholder="e.g. Uganda"
              maxLength={80}
              className={inputCls + (errors.country ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "country")}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-[#e5eaf2] bg-surface/50 px-4 py-3.5">
            <div>
              <p className="text-sm font-semibold text-foreground">Shipment protection</p>
              <p className="text-[12px] text-slate-400">
                Shipment protection for the declared value — rate set by SwiftKifisha.
              </p>
            </div>
            <input
              id="co-insurance"
              type="checkbox"
              checked={insurance}
              onChange={(e) => setInsurance(e.target.checked)}
              className="h-5 w-5 shrink-0 rounded border-border accent-primary"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="co-declared" className="text-[14px] font-semibold text-foreground">
              Declared value <span className="font-normal text-slate-400">(USD, optional)</span>
            </Label>
            <Input
              id="co-declared"
              type="number"
              min="0"
              step="0.01"
              value={declaredShown}
              onChange={(e) => {
                setDeclared(e.target.value);
                setDeclaredTouched(true);
              }}
              placeholder="Total value of these packages"
              className={inputCls + (errors.declared ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "declared")}
            {!declaredTouched && declaredTotal > 0 && (
              <p className="text-[12px] text-slate-400">
                Pre-filled with the total declared value of these packages.
              </p>
            )}
          </div>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          <p className="text-[13px] text-slate-500">
            {(pkgs || []).length} package{(pkgs || []).length === 1 ? "" : "s"} · the final total (freight +
            protection) is set by SwiftKifisha and shown on your invoice.
          </p>
          <Button
            type="submit"
            disabled={!canSubmit}
            className="h-[48px] gap-2 rounded-[10px] bg-accent px-7 text-[15px] font-bold text-accent-foreground shadow-sm hover:bg-accent/90 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
            {saving ? "Creating invoice…" : "Check out packages"}
          </Button>
        </div>
        {!canSubmit && notReady.length === 0 && missing.length === 0 && (
          <p className="mt-3 text-center text-[12.5px] text-slate-400">
            Packages are verified against the warehouse before checkout is enabled.
          </p>
        )}
      </form>
    </div>
  );
}
