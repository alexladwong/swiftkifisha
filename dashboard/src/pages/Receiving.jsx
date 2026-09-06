import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import {
  PackageCheck,
  RefreshCw,
  ScanLine,
  CircleAlert,
  CircleCheck,
  PackageOpen,
  ArrowRight,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { axiosInstance } from "@/services/axiosInstance";
import { PackageStatusBadge } from "@/components/PackageStatusBadge";
import { CONDITIONS, CONDITION_LABEL, CURRENCIES, fmtDateTime, fmtKg } from "@/lib/packageOps";

/** Fresh empty form — new idempotency key is generated per submit attempt. */
const initialForm = (warehouseCode = "") => ({
  merchantTrackingNumber: "",
  memberCode: "",
  merchant: "",
  carrier: "",
  description: "",
  itemCount: "",
  weight: "",
  length: "",
  width: "",
  height: "",
  condition: "undamaged",
  warehouseCode,
  declaredValue: "",
  currency: "USD",
  specialHandling: "",
  hazardous: false,
  notes: "",
});

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/**
 * Receiving — warehouse workstation. Scans incoming merchant parcels and
 * creates package rows (SWPK-*). Every submit carries a fresh Idempotency-Key
 * header, so double-scanning the same tracking number is a safe no-op instead
 * of creating a duplicate.
 */
export default function Receiving() {
  const [warehouses, setWarehouses] = useState([]);
  const [warehousesError, setWarehousesError] = useState("");
  const [form, setForm] = useState(initialForm());
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastResult, setLastResult] = useState(null);
  const [recent, setRecent] = useState([]);
  const [recentLoading, setRecentLoading] = useState(true);
  const [recentError, setRecentError] = useState("");
  const scanRef = useRef(null);

  const loadWarehouses = useCallback(async () => {
    setWarehousesError("");
    try {
      const { data } = await axiosInstance.get("/admin/warehouses");
      const list = data.warehouses || [];
      setWarehouses(list);
      // Preselect the first hub until the operator picks one (POST also
      // defaults to the first warehouse server-side when no code is sent).
      setForm((f) => (f.warehouseCode ? f : { ...f, warehouseCode: list[0]?.code || "" }));
    } catch (err) {
      setWarehousesError(err?.response?.data?.message || "Could not load warehouses.");
    }
  }, []);

  const loadRecent = useCallback(async () => {
    setRecentLoading(true);
    setRecentError("");
    try {
      const { data } = await axiosInstance.get("/admin/packages");
      // Server sorts newest first; keep the last eight on screen.
      setRecent((data.packages || []).slice(0, 8));
    } catch (err) {
      setRecentError(err?.response?.data?.message || "Could not load recent packages.");
    } finally {
      setRecentLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWarehouses();
    loadRecent();
  }, [loadWarehouses, loadRecent]);

  const resetForm = () => {
    setForm(initialForm(warehouses[0]?.code || ""));
    setFormError("");
    scanRef.current?.focus();
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  /* Client-side volumetric / chargeable preview — display only. The saved
   * chargeable weight comes from the server after receiving. */
  const weight = num(form.weight);
  const volumetric =
    num(form.length) && num(form.width) && num(form.height)
      ? Math.round((num(form.length) * num(form.width) * num(form.height) * 100) / 5000) / 100
      : 0;
  const chargeable = Math.round(Math.max(weight, volumetric) * 100) / 100;
  const showPreview = form.weight.trim() !== "" || volumetric > 0;

  const submit = async (e) => {
    e.preventDefault();
    if (!form.merchantTrackingNumber.trim()) {
      setFormError("Merchant tracking number is required (scan or type).");
      return;
    }
    setSaving(true);
    setFormError("");
    // One fresh key per submit attempt — repeat submissions with the same key
    // are the backend's double-scan protection.
    const idemKey =
      typeof crypto !== "undefined" && crypto.randomUUID
        ? crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const body = {
      merchantTrackingNumber: form.merchantTrackingNumber.trim(),
      memberCode: form.memberCode.trim() || undefined,
      merchant: form.merchant.trim() || undefined,
      carrier: form.carrier.trim() || undefined,
      description: form.description.trim() || undefined,
      itemCount: form.itemCount ? Number(form.itemCount) : undefined,
      weight: form.weight ? Number(form.weight) : undefined,
      length: form.length ? Number(form.length) : undefined,
      width: form.width ? Number(form.width) : undefined,
      height: form.height ? Number(form.height) : undefined,
      condition: form.condition,
      warehouseCode: form.warehouseCode || undefined,
      declaredValue: form.declaredValue ? Number(form.declaredValue) : undefined,
      currency: form.currency,
      specialHandling: form.specialHandling.trim() || undefined,
      hazardous: form.hazardous,
      notes: form.notes.trim() || undefined,
    };
    try {
      const res = await axiosInstance.post("/admin/packages/receive", body, {
        headers: { "Idempotency-Key": idemKey },
      });
      const data = res.data;
      const duplicate = res.status !== 201 || (data.message || "").startsWith("Already received");
      setLastResult({
        pkg: data.package,
        message: data.message,
        duplicate,
        hadMemberCode: !!body.memberCode,
      });
      if (duplicate) {
        toast.info(data.message || "Already received — returning the existing package.");
      } else {
        toast.success(
          data.message ||
            `Package received${data.package?.customerEmail ? " and assigned" : " — unassigned (assign a mailbox)"}`,
        );
        resetForm();
      }
      loadRecent();
    } catch (err) {
      setFormError(err?.response?.data?.message || "Receive failed — please try again.");
    } finally {
      setSaving(false);
    }
  };

  const result = lastResult?.pkg;

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <PackageCheck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Receiving</h1>
            <p className="text-sm text-muted-foreground">
              Scan parcels as they arrive at the warehouse. Scanning the same tracking number twice is safe — the
              backend dedupes it, never creating a twin.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={loadRecent} disabled={recentLoading}>
          <RefreshCw className={"mr-1.5 h-4 w-4 " + (recentLoading ? "animate-spin" : "")} /> Refresh recent
        </Button>
      </header>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <form onSubmit={submit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-6">
              <div className="space-y-1.5 lg:col-span-3">
                <Label htmlFor="rec-tracking">Merchant tracking number *</Label>
                <div className="relative">
                  <ScanLine className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    ref={scanRef}
                    id="rec-tracking"
                    className="pl-9 font-mono"
                    placeholder="Scan or type the barcode…"
                    value={form.merchantTrackingNumber}
                    onChange={set("merchantTrackingNumber")}
                    autoFocus
                  />
                </div>
              </div>
              <div className="space-y-1.5 lg:col-span-3">
                <Label htmlFor="rec-member">Mailbox / member code</Label>
                <Input
                  id="rec-member"
                  className="font-mono"
                  placeholder="e.g. SP-42084"
                  value={form.memberCode}
                  onChange={set("memberCode")}
                />
                <p className="text-xs text-muted-foreground">
                  When the code matches a member the package is auto-assigned on receive. If it doesn’t match, the
                  package is still received and left unassigned for the Packages queue.
                </p>
              </div>

              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="rec-merchant">Merchant</Label>
                <Input
                  id="rec-merchant"
                  placeholder="Store / sender name"
                  value={form.merchant}
                  onChange={set("merchant")}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="rec-carrier">Carrier</Label>
                <Input id="rec-carrier" placeholder="e.g. DHL, UPS" value={form.carrier} onChange={set("carrier")} />
              </div>
              <div className="space-y-1.5 lg:col-span-1">
                <Label htmlFor="rec-items">Item count</Label>
                <Input
                  id="rec-items"
                  type="number"
                  min="1"
                  step="1"
                  placeholder="1"
                  value={form.itemCount}
                  onChange={set("itemCount")}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-1">
                <Label htmlFor="rec-wh">Warehouse</Label>
                <Select value={form.warehouseCode || undefined} onValueChange={(v) => setForm((f) => ({ ...f, warehouseCode: v }))}>
                  <SelectTrigger id="rec-wh" className="h-10">
                    <SelectValue placeholder="Default" />
                  </SelectTrigger>
                  <SelectContent>
                    {warehouses.length === 0 && (
                      <SelectItem value="__none__" disabled>
                        No warehouses yet
                      </SelectItem>
                    )}
                    {warehouses.map((w) => (
                      <SelectItem key={w._id} value={w.code}>
                        {w.code} — {w.city}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1.5 lg:col-span-6">
                <Label htmlFor="rec-desc">Description</Label>
                <Input
                  id="rec-desc"
                  placeholder="What is in the box?"
                  value={form.description}
                  onChange={set("description")}
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="rec-weight">Weight (kg)</Label>
                <Input
                  id="rec-weight"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.weight}
                  onChange={set("weight")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-length">Length (cm)</Label>
                <Input
                  id="rec-length"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={form.length}
                  onChange={set("length")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-width">Width (cm)</Label>
                <Input
                  id="rec-width"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={form.width}
                  onChange={set("width")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-height">Height (cm)</Label>
                <Input
                  id="rec-height"
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="0"
                  value={form.height}
                  onChange={set("height")}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="rec-condition">Arrival condition</Label>
                <Select
                  value={form.condition || undefined}
                  onValueChange={(v) => setForm((f) => ({ ...f, condition: v }))}
                >
                  <SelectTrigger id="rec-condition" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CONDITIONS.map((c) => (
                      <SelectItem key={c} value={c}>
                        {CONDITION_LABEL[c]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {showPreview && (
                <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground lg:col-span-6">
                  Volumetric weight ≈ <span className="font-semibold text-foreground">{volumetric.toFixed(2)} kg</span>{" "}
                  (L×W×H ÷ 5000) · Chargeable weight ≈{" "}
                  <span className="font-semibold text-foreground">{chargeable.toFixed(2)} kg</span> — preview only, the
                  warehouse run is billed on the larger of physical and volumetric weight.
                </p>
              )}

              <div className="space-y-1.5 lg:col-span-2">
                <Label htmlFor="rec-value">Declared value</Label>
                <Input
                  id="rec-value"
                  type="number"
                  min="0"
                  step="0.01"
                  placeholder="0.00"
                  value={form.declaredValue}
                  onChange={set("declaredValue")}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="rec-currency">Currency</Label>
                <Select value={form.currency || undefined} onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}>
                  <SelectTrigger id="rec-currency" className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end lg:col-span-3">
                <label className="flex h-10 w-full cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
                  <Checkbox
                    checked={form.hazardous}
                    onCheckedChange={(v) => setForm((f) => ({ ...f, hazardous: !!v }))}
                  />
                  <span className="font-medium">Hazardous</span>
                  <span className="text-xs text-muted-foreground">— prohibited / restricted item review</span>
                </label>
              </div>

              <div className="space-y-1.5 lg:col-span-3">
                <Label htmlFor="rec-handling">Special handling</Label>
                <Input
                  id="rec-handling"
                  placeholder="e.g. Fragile, keep upright"
                  value={form.specialHandling}
                  onChange={set("specialHandling")}
                />
              </div>
              <div className="space-y-1.5 lg:col-span-3">
                <Label htmlFor="rec-notes">Notes</Label>
                <Input
                  id="rec-notes"
                  placeholder="Anything the warehouse team should know"
                  value={form.notes}
                  onChange={set("notes")}
                />
              </div>
            </div>

            {formError && (
              <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
                <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">
                Submitting sends one <span className="font-mono">Idempotency-Key</span> per attempt — a repeated scan
                returns the existing package instead of creating a duplicate.
              </p>
              <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
                {saving ? (
                  <>
                    <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Receiving…
                  </>
                ) : (
                  <>
                    <PackageCheck className="mr-1.5 h-4 w-4" /> Receive package
                  </>
                )}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {lastResult && result && (
        <Card className={lastResult.duplicate ? "border border-amber-200 bg-amber-50/50" : "border border-emerald-200 bg-emerald-50/60"}>
          <CardContent className="p-5">
            <div className="flex flex-wrap items-center gap-3">
              <span
                className={
                  "flex h-10 w-10 items-center justify-center rounded-xl " +
                  (lastResult.duplicate ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")
                }
              >
                {lastResult.duplicate ? <CircleAlert className="h-5 w-5" /> : <CircleCheck className="h-5 w-5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-semibold">
                  {lastResult.duplicate ? "Already on file — no duplicate created" : "Package received"}
                </p>
                <p className="text-sm text-muted-foreground">{lastResult.message}</p>
              </div>
              <span className="font-mono text-lg font-bold">{result.packageId}</span>
              <PackageStatusBadge status={result.status} />
            </div>

            <div className="mt-4 flex flex-wrap gap-x-6 gap-y-2 border-t border-border/60 pt-3 text-sm">
              {result.customerEmail ? (
                <p className="text-emerald-700">
                  Assigned to <span className="font-semibold">{result.customerEmail}</span>
                  {result.memberCode ? ` (${result.memberCode})` : ""}
                </p>
              ) : (
                <p className="text-amber-700">
                  Not assigned yet — this package sits in the <span className="font-semibold">Packages</span> queue as
                  “Expected” until a mailbox is assigned.
                  <Link to="/packages" className="ml-1 inline-flex items-center gap-1 font-semibold underline underline-offset-2">
                    Assign from Packages <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </p>
              )}
              {!result.customerEmail && lastResult.hadMemberCode && (
                <p className="w-full text-xs text-muted-foreground">
                  If the mailbox code you typed didn’t match any member, the receive still succeeds — the package is
                  just left unassigned.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Recently received</h2>
          <Link to="/packages" className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
            Full queue <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {recentError ? (
          <p className="rounded-xl border bg-card p-6 text-sm text-destructive">
            {recentError}{" "}
            <Button variant="outline" size="sm" className="ml-2" onClick={loadRecent}>
              Retry
            </Button>
          </p>
        ) : recentLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full" />
            ))}
          </div>
        ) : recent.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-2 py-12 text-center text-muted-foreground">
              <PackageOpen className="h-10 w-10 opacity-40" />
              <p>Nothing received yet at any warehouse.</p>
              <p className="text-sm">The last eight receives will appear here.</p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-md">
            <CardContent className="divide-y divide-border/60 p-0">
              {recent.map((p) => (
                <div key={p._id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3">
                  <span className="font-mono text-sm font-semibold">{p.packageId}</span>
                  <PackageStatusBadge status={p.status} />
                  <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                    {p.merchant || "Unknown merchant"}
                    {p.merchantTrackingNumber ? (
                      <>
                        {" "}
                        · <span className="font-mono">{p.merchantTrackingNumber}</span>
                      </>
                    ) : null}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {p.customerEmail ? p.customerEmail : <span className="font-medium text-amber-700">Unassigned</span>}
                  </span>
                  <span className="text-xs text-muted-foreground">{fmtDateTime(p.receivedAt || p.createdAt)}</span>
                  {p.chargeableWeight != null && (
                    <span className="text-xs text-muted-foreground">{fmtKg(p.chargeableWeight)}</span>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
