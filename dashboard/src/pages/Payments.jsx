import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  CreditCard,
  RefreshCw,
  Search,
  CircleAlert,
  Hourglass,
  CircleDollarSign,
  Wallet,
  Banknote,
  Lock,
  HandCoins,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { axiosInstance } from "@/services/axiosInstance";
import {
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
  CHANNEL_LABEL,
  fmtMoney,
  fmtDate,
} from "@/lib/moneyOps";

function PaymentChip({ status }) {
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (PAYMENT_STATUS_STYLE[status] || "bg-muted text-muted-foreground")
      }
    >
      {PAYMENT_STATUS_LABEL[status] || status || "—"}
    </span>
  );
}

/** Purpose pill — wallet top-ups vs. invoice payments (rows without type are invoice payments). */
function PurposeChip({ type }) {
  if (type === "TOPUP") {
    return (
      <span className="inline-flex items-center whitespace-nowrap rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
        Top-up
      </span>
    );
  }
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-muted-foreground">
      Invoice
    </span>
  );
}

function Stat({ icon: Icon, iconClass, label, value, caption }) {
  return (
    <Card className="border-0 shadow-md">
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconClass}`}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
          <p className="truncate text-xl font-bold">{value}</p>
          {caption && <p className="truncate text-xs text-muted-foreground">{caption}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

/** Small chip for the member-facing option list (Enabled / Off). */
function MemberChip({ on }) {
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold " +
        (on ? "bg-green-100 text-green-800" : "bg-slate-200 text-slate-700")
      }
    >
      {on ? "Enabled" : "Off"}
    </span>
  );
}

const isToday = (iso) => {
  if (!iso) return false;
  const d = new Date(iso);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  );
};

/** Card for posting instant wallet credits (finish of the money domain). */
function WalletCreditCard() {
  const [email, setEmail] = useState("");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    const amt = Number(amount);
    if (!email.trim()) {
      setError("Member email is required.");
      return;
    }
    if (!amount.trim() || !Number.isFinite(amt) || amt <= 0) {
      setError("Amount must be a number greater than 0.");
      return;
    }
    if (!reason.trim()) {
      setError("A reason is required — the entry is audited.");
      return;
    }
    setBusy(true);
    try {
      const { data } = await axiosInstance.post("/admin/wallet/credit", {
        email: email.trim(),
        amount: amt,
        reason: reason.trim(),
      });
      const balance = data.balance != null ? ` · New balance: ${fmtMoney(data.balance)}` : "";
      toast.success(data?.message ? `${data.message}${balance}` : `Wallet credited${balance}`);
      setEmail("");
      setAmount("");
      setReason("");
    } catch (err) {
      // 400/404 messages come back verbatim from the backend.
      setError(err?.response?.data?.message || "Wallet credit failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Wallet className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Add wallet credit</h2>
            <p className="text-xs text-muted-foreground">
              Post credit straight to a member&apos;s wallet balance (USD) — settles invoices or refunds.
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="mt-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="wallet-email">Member email *</Label>
              <Input
                id="wallet-email"
                type="email"
                className="h-9 text-sm"
                placeholder="member@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-amount">Amount (USD) *</Label>
              <Input
                id="wallet-amount"
                type="number"
                min="0"
                step="0.01"
                className="h-9 text-sm"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="wallet-reason">Reason *</Label>
              <Input
                id="wallet-reason"
                className="h-9 text-sm"
                placeholder="e.g. Refund for overcharged shipping"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                maxLength={300}
              />
            </div>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex justify-end">
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? (
                <>
                  <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Crediting…
                </>
              ) : (
                <>
                  <HandCoins className="mr-1.5 h-4 w-4" /> Add wallet credit
                </>
              )}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Fallback labels for provider channels the backend reports. */
const PROVIDER_LABEL = {
  MTN_MOMO: "MTN Mobile Money (Uganda)",
  AIRTEL_MONEY: "Airtel Money (Uganda)",
  MPESA: "M-Pesa (Daraja)",
  CARD: "Credit / debit card",
};

/** Offline payment instructions + provider-channel configuration panel. */
function PaymentConfigCard() {
  const [cfg, setCfg] = useState({ loading: true, error: "", config: null, providers: [] });
  const [draft, setDraft] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [momo, setMomo] = useState({ enabled: false, number: "", networkLabel: "", ussdTemplate: "" });
  const [chanEnabled, setChanEnabled] = useState({});
  const [busy, setBusy] = useState(false);
  const [momoBusy, setMomoBusy] = useState(false);
  const [chanBusy, setChanBusy] = useState(null);

  /** Mirror a config payload into the form and the channel/provider state. */
  const syncFrom = (config, providers) => {
    const offline = config?.offline || {};
    const m = config?.momo || {};
    const chans = config?.channels || {};
    setDraft(offline.instructions || "");
    setEnabled(!!offline.enabled);
    setMomo({
      enabled: !!m.enabled,
      number: m.number || "",
      networkLabel: m.networkLabel || "",
      ussdTemplate: m.ussdTemplate || "",
    });
    setChanEnabled(Object.fromEntries(Object.keys(chans).map((code) => [code, !!chans[code]?.enabled])));
    setCfg({ loading: false, error: "", config: config || null, providers: providers || [] });
  };

  const load = useCallback(async () => {
    setCfg((s) => ({ ...s, loading: !s.config, error: "" }));
    try {
      const { data } = await axiosInstance.get("/admin/payment-config");
      syncFrom(data.config, data.providers);
    } catch (err) {
      setCfg((s) => ({
        ...s,
        loading: false,
        error: err?.response?.data?.message || "Could not load payment configuration.",
      }));
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Offline instructions — saved alone so the backend preserves channels. */
  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const { data } = await axiosInstance.put("/admin/payment-config", {
        offline: { enabled, instructions: draft.trim() },
      });
      toast.success(data?.message || "Payment instructions saved.");
      syncFrom(data.config, data.providers);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save payment instructions.");
    } finally {
      setBusy(false);
    }
  };

  /** Persist the manual mobile-money settings (switch + fields in one save). */
  const saveMomo = async (e) => {
    e.preventDefault();
    if (momo.enabled && !momo.number.trim()) {
      toast.error("Receive number is required when mobile money is on.");
      return;
    }
    setMomoBusy(true);
    try {
      const { data } = await axiosInstance.put("/admin/payment-config", {
        momo: {
          enabled: momo.enabled,
          number: momo.number.trim(),
          networkLabel: momo.networkLabel.trim(),
          ussdTemplate: momo.ussdTemplate.trim(),
        },
      });
      toast.success(data?.message || "Mobile money settings saved.");
      syncFrom(data.config, data.providers);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save mobile money settings.");
    } finally {
      setMomoBusy(false);
    }
  };

  /** Toggle one provider channel (only reachable once credentials exist). */
  const toggleChannel = async (code, value) => {
    setChanBusy(code);
    try {
      const { data } = await axiosInstance.put("/admin/payment-config", {
        channels: { [code]: { enabled: value } },
      });
      toast.success(data?.message || "Channel updated.");
      syncFrom(data.config, data.providers);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not update the channel.");
      load();
    } finally {
      setChanBusy(null);
    }
  };

  const providers = Array.isArray(cfg.providers) ? cfg.providers : [];
  const needsCreds = providers.some((pr) => !pr.configured);

  // Persisted truth for the member-facing status list.
  const memberOffline = cfg.config?.offline || {};
  const memberMomo = cfg.config?.momo || {};

  // Live preview of the USSD template ({amount} → 50000, {number} → receive number).
  const momoPreview = momo.ussdTemplate
    ? momo.ussdTemplate.replace(/\{amount\}/g, "50000").replace(/\{number\}/g, momo.number.trim() || "…")
    : "—";

  return (
    <Card className="border-0 shadow-md">
      <CardContent className="p-5">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <Banknote className="h-4 w-4 text-primary" />
          </div>
          <div>
            <h2 className="text-base font-semibold leading-tight">Payment instructions</h2>
            <p className="text-xs text-muted-foreground">
              Bank-transfer details shown to members at checkout, plus channel status.
            </p>
          </div>
        </div>

        {cfg.loading && !cfg.config ? (
          <div className="mt-4 space-y-3">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : cfg.error && !cfg.config ? (
          <div className="mt-4 rounded-xl border bg-card p-6 text-sm text-destructive">
            {cfg.error}{" "}
            <Button variant="outline" size="sm" className="ml-2" onClick={load}>
              Retry
            </Button>
          </div>
        ) : (
          <>
            <div className="mt-4 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Member payment options
              </p>
              <div className="mt-2 space-y-1.5">
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="text-sm">Bank transfer / offline</span>
                  <MemberChip on={!!memberOffline.enabled} />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1 text-sm">
                    <span className="truncate">{memberMomo.networkLabel || "Mobile money (manual)"}</span>
                    <span className="text-muted-foreground"> · pay to </span>
                    <span className="font-mono text-xs">{memberMomo.number || "…"}</span>
                  </span>
                  <MemberChip on={!!memberMomo.enabled} />
                </div>
              </div>
            </div>

            <form onSubmit={save} className="mt-4 space-y-3">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-muted/30 px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-medium">Accept offline payments</p>
                  <p className="text-xs text-muted-foreground">
                    Members can pick “Bank transfer / offline” at checkout when this is on.
                  </p>
                </div>
                <Switch checked={enabled} onCheckedChange={setEnabled} disabled={busy} />
              </div>
              {!enabled && (
                <p className="text-xs text-amber-700">
                  Offline payments are off — members cannot currently choose bank transfer.
                </p>
              )}

              <div className="space-y-1.5">
                <Label htmlFor="pay-instr">Instructions shown to the member</Label>
                <Textarea
                  id="pay-instr"
                  rows={3}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  placeholder="e.g. Bank … Account name … Use your invoice reference when paying."
                />
              </div>

              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm" disabled={busy}>
                  {busy && <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save instructions
                </Button>
              </div>
            </form>

            <form onSubmit={saveMomo} className="mt-4 space-y-3 border-t border-border/60 pt-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold">Mobile money (manual)</p>
                  <p className="text-xs text-muted-foreground">
                    When on, members see this option when topping up their wallet and pay the receive number
                    below. Top-ups arrive in this queue as Top-up payments for verification.
                  </p>
                </div>
                <Switch
                  checked={momo.enabled}
                  onCheckedChange={(v) => setMomo((d) => ({ ...d, enabled: v }))}
                  disabled={momoBusy}
                />
              </div>

              {!momo.enabled ? (
                <p className="text-xs text-amber-700">
                  Mobile money is off — members cannot currently choose it.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label htmlFor="momo-number">Receive number</Label>
                      <Input
                        id="momo-number"
                        className="h-9 font-mono text-sm"
                        placeholder="+256757889291"
                        value={momo.number}
                        onChange={(e) => setMomo((d) => ({ ...d, number: e.target.value }))}
                        maxLength={32}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="momo-label">Network label</Label>
                      <Input
                        id="momo-label"
                        className="h-9 text-sm"
                        placeholder="MTN MoMo (Uganda)"
                        value={momo.networkLabel}
                        onChange={(e) => setMomo((d) => ({ ...d, networkLabel: e.target.value }))}
                        maxLength={80}
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="momo-ussd">USSD template</Label>
                    <Input
                      id="momo-ussd"
                      className="h-9 font-mono text-sm"
                      placeholder="*165*1*{amount}*{number}#"
                      value={momo.ussdTemplate}
                      onChange={(e) => setMomo((d) => ({ ...d, ussdTemplate: e.target.value }))}
                      maxLength={120}
                    />
                    <p className="break-all text-xs text-muted-foreground">
                      Member QR/USSD: <span className="font-mono text-foreground">{momoPreview}</span>
                    </p>
                    <p className="text-[11px] text-muted-foreground">
                      {"{amount}"} previews as 50000 and {"{number}"} as the receive number shown to members.
                    </p>
                  </div>
                </div>
              )}

              <div className="flex justify-end">
                <Button type="submit" variant="outline" size="sm" disabled={momoBusy}>
                  {momoBusy && <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  Save mobile money
                </Button>
              </div>
            </form>

            <div className="mt-4 space-y-2 border-t border-border/60 pt-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Provider channels
              </p>
              {providers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No provider channels reported by the backend.</p>
              ) : (
                <div className="space-y-2">
                  {providers.map((pr) => {
                    const ready = !!pr.configured;
                    const current = !!chanEnabled[pr.code];
                    return (
                      <div
                        key={pr.code}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/70 bg-card px-3 py-2"
                      >
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium">
                            {pr.label || PROVIDER_LABEL[pr.code] || pr.code}
                          </p>
                          <p className="font-mono text-[11px] text-muted-foreground">{pr.code}</p>
                          {!ready && pr.message && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{pr.message}</p>
                          )}
                        </div>
                        {ready ? (
                          <Switch
                            checked={current}
                            disabled={chanBusy !== null}
                            onCheckedChange={(v) => toggleChannel(pr.code, v)}
                            aria-label={`${pr.label || pr.code} enabled`}
                          />
                        ) : (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1 rounded-full bg-slate-200 px-2 py-0.5 text-xs font-semibold text-slate-700">
                              <Lock className="h-3 w-3" /> Provider credentials required
                            </span>
                            <Checkbox
                              checked={current}
                              disabled
                              aria-label={`${pr.label || pr.code} enabled`}
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
              {needsCreds && (
                <p className="text-xs text-muted-foreground">
                  Choose what members can use: manual options above are live switches; provider channels below go
                  live only after real credentials are configured on the backend.
                </p>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Payments — Phase-2 finance workstation. Member payments against invoices
 * (SKP-*): verify or reject PENDING offline transfers, review PAID rows, post
 * wallet credits and maintain the offline payment instructions. Finance
 * actions live here; invoicing lives on its own page.
 */
export default function Payments() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  // Verify / reject dialog state.
  const [verifyTarget, setVerifyTarget] = useState(null);
  const [verifyForm, setVerifyForm] = useState({ reference: "", reason: "" });
  const [verifyError, setVerifyError] = useState("");
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [rejectTarget, setRejectTarget] = useState(null);
  const [rejectReason, setRejectReason] = useState("");
  const [rejectError, setRejectError] = useState("");
  const [rejectBusy, setRejectBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status !== "all") params.status = status;
      const { data } = await axiosInstance.get("/admin/payments", { params });
      setRows(data.payments || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openVerify = (p) => {
    setVerifyTarget(p);
    setVerifyForm({ reference: "", reason: "" });
    setVerifyError("");
  };

  const submitVerify = async (e) => {
    e.preventDefault();
    if (!verifyForm.reference.trim() || !verifyForm.reason.trim()) {
      setVerifyError("Reference and reason are required.");
      return;
    }
    setVerifyBusy(true);
    setVerifyError("");
    try {
      const { data } = await axiosInstance.post(`/admin/payments/${verifyTarget._id}/verify`, {
        reference: verifyForm.reference.trim(),
        reason: verifyForm.reason.trim(),
      });
      // The server message says when a shipment was created as a side effect.
      toast.success(data?.message || "Payment verified.");
      setVerifyTarget(null);
      load();
    } catch (err) {
      setVerifyError(err?.response?.data?.message || "Could not verify this payment.");
    } finally {
      setVerifyBusy(false);
    }
  };

  const openReject = (p) => {
    setRejectTarget(p);
    setRejectReason("");
    setRejectError("");
  };

  const submitReject = async (e) => {
    e.preventDefault();
    if (!rejectReason.trim()) {
      setRejectError("A reason is required — the member sees it.");
      return;
    }
    setRejectBusy(true);
    setRejectError("");
    try {
      const { data } = await axiosInstance.post(`/admin/payments/${rejectTarget._id}/reject`, {
        reason: rejectReason.trim(),
      });
      toast.success(data?.message || "Payment rejected.");
      setRejectTarget(null);
      load();
    } catch (err) {
      setRejectError(err?.response?.data?.message || "Could not reject this payment.");
    } finally {
      setRejectBusy(false);
    }
  };

  const pendingCount = rows.filter((r) => r.status === "PENDING").length;
  const paidToday = rows.filter((r) => r.status === "PAID" && isToday(r.paidAt || r.createdAt));
  const paidTodayTotal = paidToday.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const shownTotal = rows.reduce((s, r) => s + (Number(r.amount) || 0), 0);
  const shownText =
    loading && rows.length === 0
      ? "…"
      : `${rows.length} payment${rows.length === 1 ? "" : "s"} shown`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Payments</h1>
            <p className="text-sm text-muted-foreground">
              Member payments against invoices (SKP-*) — verify or reject bank-transfer payments and post wallet
              credits. Invoices themselves live on the Invoices page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </header>

      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          icon={Hourglass}
          iconClass="bg-amber-100 text-amber-700"
          label="Pending payments"
          value={loading && rows.length === 0 ? "…" : pendingCount}
          caption="awaiting verify or reject"
        />
        <Stat
          icon={CircleDollarSign}
          iconClass="bg-green-100 text-green-700"
          label="Paid today"
          value={loading && rows.length === 0 ? "…" : fmtMoney(paidTodayTotal)}
          caption={`${paidToday.length} payment${paidToday.length === 1 ? "" : "s"} · ${new Date().toLocaleDateString()}`}
        />
        <Stat
          icon={Wallet}
          iconClass="bg-primary/10 text-primary"
          label="Listed total"
          value={loading && rows.length === 0 ? "…" : fmtMoney(shownTotal)}
          caption={shownText}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Figures are computed from the payments listed below — clearing the filters shows the whole queue.
      </p>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search payment ID, invoice ID, email…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
              <Select value={status} onValueChange={(v) => setStatus(v)}>
                <SelectTrigger className="w-full lg:w-[210px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">All statuses</SelectItem>
                  {PAYMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {PAYMENT_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{shownText}</p>
          </div>

          {error ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <CircleAlert className="h-10 w-10 text-destructive opacity-70" />
              <p className="text-sm text-destructive">{error}</p>
              <Button variant="outline" size="sm" onClick={load}>
                <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
              </Button>
            </div>
          ) : loading && rows.length === 0 ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
              <CreditCard className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">No payments match</p>
              <p className="text-sm">
                {status !== "all" || search
                  ? "Try clearing the filters above."
                  : "Member payments will appear here once customers check out against an invoice."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Payment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Purpose</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden sm:table-cell">Invoice</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead className="hidden md:table-cell">Channel</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="hidden xl:table-cell">Reference</TableHead>
                    <TableHead className="w-40" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p._id}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{p.paymentId}</p>
                      </TableCell>
                      <TableCell>
                        <PaymentChip status={p.status} />
                      </TableCell>
                      <TableCell>
                        <PurposeChip type={p.type} />
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate text-sm">{p.customerEmail || "—"}</span>
                      </TableCell>
                      <TableCell className="hidden sm:table-cell">
                        <span className="font-mono text-xs text-muted-foreground">{p.invoiceId || "—"}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{fmtMoney(p.amount, p.currency || "USD")}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm text-muted-foreground">
                          {CHANNEL_LABEL[p.channel] || p.channel || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <p className="text-sm">{fmtDate(p.createdAt)}</p>
                        {p.paidAt && <p className="text-[11px] text-emerald-700">paid {fmtDate(p.paidAt)}</p>}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell">
                        <div className="min-w-0">
                          <p className="font-mono text-xs">{p.reference || "—"}</p>
                          {p.status === "PAID" && (
                            <p className="truncate text-[11px] text-muted-foreground">
                              {p.verifiedBy ? `Verified by ${p.verifiedBy}` : "Verified"}
                            </p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        {p.status === "PENDING" ? (
                          <div className="flex items-center gap-1.5">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                              onClick={() => openVerify(p)}
                            >
                              Verify
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 border-destructive/30 text-destructive hover:bg-destructive/10"
                              onClick={() => openReject(p)}
                            >
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <WalletCreditCard />
        <PaymentConfigCard />
      </div>

      {/* ------------------------- verify payment dialog ------------------------- */}
      <Dialog open={verifyTarget !== null} onOpenChange={(open) => !open && setVerifyTarget(null)}>
        {verifyTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Verify payment</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{verifyTarget.paymentId}</span> ·{" "}
                {verifyTarget.customerEmail || "no member"} ·{" "}
                {fmtMoney(verifyTarget.amount, verifyTarget.currency || "USD")} via{" "}
                {CHANNEL_LABEL[verifyTarget.channel] || verifyTarget.channel}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitVerify} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="ver-reference">Reference *</Label>
                <Input
                  id="ver-reference"
                  className="h-9 font-mono text-sm"
                  placeholder="Bank/transfer reference from the statement"
                  value={verifyForm.reference}
                  onChange={(e) => setVerifyForm((f) => ({ ...f, reference: e.target.value }))}
                  maxLength={120}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="ver-reason">Reason *</Label>
                <Textarea
                  id="ver-reason"
                  rows={2}
                  placeholder="e.g. Transfer confirmed on the statement"
                  value={verifyForm.reason}
                  onChange={(e) => setVerifyForm((f) => ({ ...f, reason: e.target.value }))}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">
                  {verifyTarget.type === "TOPUP" ? (
                    "This will credit the customer's wallet."
                  ) : (
                    <>
                      Recorded in the audit log. If this settles the invoice, the backend creates the shipment
                      automatically and the success message will say so.
                    </>
                  )}
                </p>
              </div>

              {verifyError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{verifyError}</span>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={verifyBusy}
                  onClick={() => setVerifyTarget(null)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={verifyBusy}
                  className="bg-primary text-primary-foreground hover:bg-primary/90"
                >
                  {verifyBusy ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Verifying…
                    </>
                  ) : (
                    "Verify payment"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* -------------------------- reject payment dialog ------------------------ */}
      <Dialog open={rejectTarget !== null} onOpenChange={(open) => !open && setRejectTarget(null)}>
        {rejectTarget && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Reject payment</DialogTitle>
              <DialogDescription>
                <span className="font-mono">{rejectTarget.paymentId}</span> ·{" "}
                {rejectTarget.customerEmail || "no member"} ·{" "}
                {fmtMoney(rejectTarget.amount, rejectTarget.currency || "USD")} via{" "}
                {CHANNEL_LABEL[rejectTarget.channel] || rejectTarget.channel}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={submitReject} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="rej-reason">Reason *</Label>
                <Textarea
                  id="rej-reason"
                  rows={3}
                  placeholder="e.g. No matching transfer found on the statement"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  maxLength={300}
                />
                <p className="text-xs text-muted-foreground">
                  The reason is recorded in the audit log and shown to the member.
                </p>
              </div>

              {rejectError && (
                <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                  <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>{rejectError}</span>
                </div>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  disabled={rejectBusy}
                  onClick={() => setRejectTarget(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={rejectBusy} variant="destructive">
                  {rejectBusy ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Rejecting…
                    </>
                  ) : (
                    "Reject payment"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
