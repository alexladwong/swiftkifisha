import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  Send, PackagePlus, Mailbox, Info, RefreshCw, Loader2, CheckCircle2, ArrowRight, ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMailboxes, preAlertPackage } from "@/lib/portalApi";

const CURRENCIES = ["USD", "GBP", "EUR"];

const inputCls =
  "h-[46px] rounded-[10px] border border-border bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:bg-surface/60";
const selectCls = inputCls + " w-full";

const fieldError = (errors, key) =>
  errors[key] ? <p className="text-[12.5px] font-medium text-destructive">{errors[key]}</p> : null;

export default function PackagePreAlertPage() {
  const [mailboxes, setMailboxes] = useState(null);
  const [mailboxesError, setMailboxesError] = useState("");
  const [created, setCreated] = useState(null); // { message, package }
  const [saving, setSaving] = useState(false);
  const [serverError, setServerError] = useState("");
  const [errors, setErrors] = useState({});
  const [form, setForm] = useState({
    merchant: "",
    merchantTrackingNumber: "",
    carrier: "",
    description: "",
    itemCount: "1",
    estimatedValue: "",
    currency: "USD",
    expectedDeliveryDate: "",
    destinationMailbox: "",
    notes: "",
  });

  const loadMailboxes = () => {
    setMailboxesError("");
    setMailboxes(null);
    fetchMailboxes()
      .then((rows) => {
        setMailboxes(rows);
        if (rows.length === 1) {
          setForm((f) => ({ ...f, destinationMailbox: f.destinationMailbox || rows[0].country }));
        }
      })
      .catch(() => setMailboxesError("Could not load your mailboxes. Please try again."));
  };

  useEffect(() => {
    let alive = true;
    fetchMailboxes()
      .then((rows) => {
        if (!alive) return;
        setMailboxes(rows);
        if (rows.length === 1) {
          setForm((f) => ({ ...f, destinationMailbox: f.destinationMailbox || rows[0].country }));
        }
      })
      .catch(() => alive && setMailboxesError("Could not load your mailboxes. Please try again."));
    return () => {
      alive = false;
    };
  }, []);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const validate = () => {
    const e = {};
    if (!form.merchant.trim()) e.merchant = "Merchant / store is required.";
    if (!form.description.trim()) e.description = "Description is required.";
    if (!form.destinationMailbox) e.destinationMailbox = "Choose the mailbox this parcel is shipping to.";
    const items = Number(form.itemCount);
    if (form.itemCount === "" || !Number.isFinite(items) || items < 1) {
      e.itemCount = "Number of items must be at least 1.";
    }
    const value = Number(form.estimatedValue);
    if (form.estimatedValue !== "" && (!Number.isFinite(value) || value < 0)) {
      e.estimatedValue = "Estimated value must be zero or a positive number.";
    }
    if (form.expectedDeliveryDate && Number.isNaN(new Date(form.expectedDeliveryDate).getTime())) {
      e.expectedDeliveryDate = "Pick a valid expected delivery date.";
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    if (!validate()) return;
    setSaving(true);
    try {
      const res = await preAlertPackage({
        merchant: form.merchant.trim(),
        merchantTrackingNumber: form.merchantTrackingNumber.trim() || undefined,
        carrier: form.carrier.trim() || undefined,
        description: form.description.trim(),
        itemCount: Number(form.itemCount),
        estimatedValue: form.estimatedValue === "" ? 0 : Number(form.estimatedValue),
        currency: form.currency,
        expectedDeliveryDate: form.expectedDeliveryDate || undefined,
        destinationMailbox: form.destinationMailbox,
        notes: form.notes.trim() || undefined,
      });
      setCreated(res.package);
      toast.success(res.message || "Pre-alert saved");
    } catch (err) {
      // Surface the server's own 400/403 wording verbatim when present.
      setServerError(
        err?.response?.data?.message ||
          "We could not save your pre-alert. The warehouse service may be offline.",
      );
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setCreated(null);
    setServerError("");
    setErrors({});
    setForm((f) => ({
      ...f,
      merchant: "",
      merchantTrackingNumber: "",
      carrier: "",
      description: "",
      itemCount: "1",
      estimatedValue: "",
      expectedDeliveryDate: "",
      notes: "",
    }));
  };

  /* Loading */
  if (!mailboxes && !mailboxesError) {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-6">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Pre-Alert a Package
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Tell our warehouse that a purchase is on its way to you.</p>
        </header>
        <div className="space-y-4 rounded-xl border border-border bg-white p-6 md:p-8">
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-24 w-full rounded-[10px]" />
        </div>
      </div>
    );
  }

  /* No operational mailbox yet — honest gate, no fake form. */
  if (mailboxesError || (mailboxes && mailboxes.length === 0)) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Pre-Alert a Package
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Tell our warehouse that a purchase is on its way to you.</p>
        </header>
        <div className="mt-8 flex min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Mailbox className="h-6 w-6 text-slate-300" />
          </span>
          {mailboxesError ? (
            <>
              <p className="mt-4 font-display text-lg font-bold text-foreground">Could not load your mailboxes</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">{mailboxesError}</p>
              <Button variant="outline" className="mt-5 gap-1.5" onClick={loadMailboxes}>
                <RefreshCw className="h-4 w-4" /> Try again
              </Button>
            </>
          ) : (
            <>
              <p className="mt-4 font-display text-lg font-bold text-foreground">No mailbox assigned yet</p>
              <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
                Your mailbox is assigned once membership is approved — we'll email you as soon as it's ready.
                Pre-alerts open up the moment your first mailbox appears here.
              </p>
              <Link to="/contact" className="mt-5 text-sm font-semibold text-primary hover:underline">
                Contact support
              </Link>
            </>
          )}
        </div>
      </div>
    );
  }

  /* Success panel */
  if (created) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <header>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Pre-Alert a Package
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">Tell our warehouse that a purchase is on its way to you.</p>
        </header>
        <div className="mt-8 rounded-xl border border-[#e5eaf2] bg-white p-8 text-center md:p-10">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
            <CheckCircle2 className="h-7 w-7 text-emerald-600" />
          </span>
          <h2 className="mt-4 font-display text-xl font-extrabold tracking-tight text-foreground">
            Pre-alert saved — {created.packageId}
          </h2>
          <p className="mx-auto mt-2 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            Our warehouse team now expects this parcel. Follow it under{" "}
            <Link to="/account/packages" className="font-semibold text-primary hover:underline">My Packages</Link>{" "}
            — status updates appear as soon as the parcel is received and scanned.
          </p>
          <div className="mx-auto mt-6 grid max-w-md gap-3 rounded-xl border border-[#e5eaf2] bg-surface/50 p-5 text-left sm:grid-cols-2">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Package ID</p>
              <p className="mt-1 font-mono text-[15px] font-bold text-foreground">{created.packageId}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Status</p>
              <p className="mt-1 inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide text-sky-700">
                Pre-alerted
              </p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Store</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground">{created.merchant}</p>
            </div>
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Destination</p>
              <p className="mt-1 text-[15px] font-semibold text-foreground">{created.destinationWarehouse}</p>
            </div>
          </div>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <Link
              to={"/account/packages/" + created.packageId}
              className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground shadow-sm transition hover:bg-primary/90"
            >
              View this package <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              to="/account/packages"
              className="inline-flex h-11 items-center rounded-lg border border-[#e5eaf2] bg-white px-5 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
            >
              Back to My Packages
            </Link>
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-11 items-center rounded-lg px-4 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
            >
              Pre-alert another package
            </button>
          </div>
        </div>
      </div>
    );
  }

  /* The form */
  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
          Pre-Alert a Package
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Bought something online? Tell us before it ships and our warehouse will watch for it.
        </p>
      </header>

      {serverError && (
        <div className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {serverError}
        </div>
      )}

      <form
        onSubmit={submit}
        noValidate
        aria-label="Pre-alert a package"
        className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-8"
      >
        <div className="grid gap-5 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pa-merchant" className="text-[14px] font-semibold text-foreground">
              Merchant / store <span className="text-destructive">*</span>
            </Label>
            <Input
              id="pa-merchant"
              value={form.merchant}
              onChange={set("merchant")}
              placeholder="e.g. Amazon, SHEIN, eBay seller"
              maxLength={120}
              className={inputCls + (errors.merchant ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "merchant")}
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-tracking" className="text-[14px] font-semibold text-foreground">
              Merchant tracking number
            </Label>
            <Input
              id="pa-tracking"
              value={form.merchantTrackingNumber}
              onChange={set("merchantTrackingNumber")}
              placeholder="The number from your order confirmation"
              maxLength={80}
              className={inputCls}
            />
            <p className="text-[12px] text-slate-400">Helps our team match the parcel faster.</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-carrier" className="text-[14px] font-semibold text-foreground">Carrier</Label>
            <Input
              id="pa-carrier"
              value={form.carrier}
              onChange={set("carrier")}
              placeholder="e.g. UPS, DHL, USPS"
              maxLength={60}
              className={inputCls}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pa-items" className="text-[14px] font-semibold text-foreground">Number of items</Label>
            <Input
              id="pa-items"
              type="number"
              min="1"
              step="1"
              value={form.itemCount}
              onChange={set("itemCount")}
              className={inputCls + (errors.itemCount ? " border-destructive/60" : "")}
            />
            {fieldError(errors, "itemCount")}
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pa-description" className="text-[14px] font-semibold text-foreground">
              What's in the parcel? <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="pa-description"
              rows={3}
              value={form.description}
              onChange={set("description")}
              placeholder="e.g. Two summer dresses, size M, plus one pair of sneakers"
              maxLength={2000}
              className={
                "rounded-[10px] border-border bg-white text-[15px] focus-visible:ring-primary/40 " +
                (errors.description ? " border-destructive/60" : "")
              }
            />
            {fieldError(errors, "description")}
            <p className="text-[12px] text-slate-400">A short, honest list helps receiving go smoothly.</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="pa-value" className="text-[14px] font-semibold text-foreground">Estimated value</Label>
              <Input
                id="pa-value"
                type="number"
                min="0"
                step="0.01"
                value={form.estimatedValue}
                onChange={set("estimatedValue")}
                placeholder="0.00"
                className={inputCls + (errors.estimatedValue ? " border-destructive/60" : "")}
              />
              {fieldError(errors, "estimatedValue")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-currency" className="text-[14px] font-semibold text-foreground">Currency</Label>
              <select id="pa-currency" value={form.currency} onChange={set("currency")} className={selectCls}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 md:col-span-2">
            <div className="space-y-2">
              <Label htmlFor="pa-date" className="text-[14px] font-semibold text-foreground">Expected delivery date</Label>
              <Input
                id="pa-date"
                type="date"
                value={form.expectedDeliveryDate}
                onChange={set("expectedDeliveryDate")}
                className={inputCls + (errors.expectedDeliveryDate ? " border-destructive/60" : "")}
              />
              {fieldError(errors, "expectedDeliveryDate")}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pa-mailbox" className="text-[14px] font-semibold text-foreground">
                Destination mailbox <span className="text-destructive">*</span>
              </Label>
              <select
                id="pa-mailbox"
                value={form.destinationMailbox}
                onChange={set("destinationMailbox")}
                className={selectCls + (errors.destinationMailbox ? " border-destructive/60" : "")}
              >
                <option value="" disabled>Choose a mailbox…</option>
                {mailboxes.map((mb) => (
                  <option key={mb.country} value={mb.country}>
                    {mb.country} — {mb.suite}
                  </option>
                ))}
              </select>
              {fieldError(errors, "destinationMailbox")}
            </div>
          </div>

          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="pa-notes" className="text-[14px] font-semibold text-foreground">
              Notes for our team <span className="font-normal text-slate-400">(optional)</span>
            </Label>
            <Textarea
              id="pa-notes"
              rows={2}
              value={form.notes}
              onChange={set("notes")}
              placeholder="Anything we should know — fragile items, gifts, colour/size quirks…"
              maxLength={1000}
              className="rounded-[10px] border-border bg-white text-[15px] focus-visible:ring-primary/40"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-col gap-3 rounded-xl bg-surface/70 px-4 py-3 text-[13px] leading-relaxed text-slate-500 sm:flex-row sm:items-start sm:gap-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
          <p>
            Invoices and receipts aren't part of the pre-alert yet — document upload arrives in a later phase.
            Keep your merchant confirmation email handy in case our team needs to match the parcel.
          </p>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5">
          <Link
            to="/account/packages"
            className="inline-flex h-11 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold text-slate-500 transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Packages
          </Link>
          <Button
            type="submit"
            disabled={saving}
            className="h-[48px] gap-2 rounded-[10px] bg-accent px-7 text-[15px] font-bold text-accent-foreground shadow-sm hover:bg-accent/90"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            {saving ? "Saving…" : "Submit pre-alert"}
          </Button>
        </div>
      </form>

      <p className="flex items-center justify-center gap-1.5 text-[13px] text-slate-400">
        <PackagePlus className="h-3.5 w-3.5" /> No payment is needed now — pre-alerting is free.
      </p>
    </div>
  );
}
