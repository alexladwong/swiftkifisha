import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Warehouse as WarehouseIcon,
  Plus,
  Pencil,
  RefreshCw,
  MapPin,
  Phone,
  Clock,
  Globe,
  Coins,
  CircleAlert,
  Building2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { axiosInstance } from "@/services/axiosInstance";
import { CURRENCIES, fmtDate } from "@/lib/packageOps";

const STATUS_STYLE = {
  ACTIVE: "bg-emerald-100 text-emerald-800",
  INACTIVE: "bg-muted text-muted-foreground",
};

const emptyForm = () => ({
  name: "",
  country: "",
  city: "",
  code: "",
  addressLines: "",
  phone: "",
  timezone: "UTC",
  currency: "USD",
  status: "ACTIVE",
  operatingHours: "",
  capabilities: "",
  supportedCarriers: "",
});

/** Round-trip a warehouse row into form values (arrays → comma/newline text). */
const warehouseToForm = (w) => ({
  name: w.name || "",
  country: w.country || "",
  city: w.city || "",
  code: w.code || "",
  addressLines: (w.addressLines || []).join("\n"),
  phone: w.phone || "",
  timezone: w.timezone || "UTC",
  currency: w.currency || "USD",
  status: w.status === "INACTIVE" ? "INACTIVE" : "ACTIVE",
  operatingHours: w.operatingHours || "",
  capabilities: (w.capabilities || []).join(", "),
  supportedCarriers: (w.supportedCarriers || []).join(", "),
});

const splitList = (text) =>
  text
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

/** Shared create/edit form — shown in a dialog for both "New warehouse" and per-row "Edit". */
function WarehouseFormDialog({ open, warehouse, onOpenChange, onSaved }) {
  const editing = !!warehouse;
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(warehouse ? warehouseToForm(warehouse) : emptyForm());
      setFormError("");
      setSaving(false);
    }
  }, [open, warehouse]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    if (!form.name.trim() || !form.country.trim() || !form.city.trim()) {
      setFormError("Name, country and city are required.");
      return;
    }
    const payload = {
      name: form.name.trim(),
      country: form.country.trim(),
      city: form.city.trim(),
      addressLines: form.addressLines.split("\n").map((s) => s.trim()).filter(Boolean),
      phone: form.phone.trim(),
      timezone: form.timezone.trim(),
      currency: form.currency,
      status: form.status,
      operatingHours: form.operatingHours.trim(),
      capabilities: splitList(form.capabilities),
      supportedCarriers: splitList(form.supportedCarriers),
    };
    if (form.code.trim() && !editing) payload.code = form.code.trim().toUpperCase();
    setSaving(true);
    try {
      const { data } = editing
        ? await axiosInstance.patch(`/admin/warehouses/${warehouse._id}`, payload)
        : await axiosInstance.post("/admin/warehouses", payload);
      toast.success(data?.message || (editing ? "Warehouse updated" : "Warehouse created"));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setFormError(err?.response?.data?.message || "Could not save the warehouse. Try again.");
    } finally {
      setSaving(false);
    }
  };

  const currencyOptions = CURRENCIES.includes(form.currency)
    ? CURRENCIES
    : [form.currency, ...CURRENCIES];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit ${warehouse.name}` : "New warehouse"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the warehouse details. Changes are recorded in the audit log."
              : "Add a SwiftKifisha receiving warehouse. Name, country and city are required."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Name *</Label>
              <Input
                value={form.name}
                onChange={set("name")}
                placeholder="e.g. New York Fulfilment Hub"
                maxLength={120}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Country *</Label>
              <Input value={form.country} onChange={set("country")} placeholder="e.g. United States" />
            </div>
            <div className="space-y-1.5">
              <Label>City *</Label>
              <Input value={form.city} onChange={set("city")} placeholder="e.g. New York" />
            </div>
            <div className="space-y-1.5">
              <Label>Code</Label>
              <Input
                value={form.code}
                onChange={set("code")}
                placeholder="e.g. US"
                maxLength={6}
                disabled={editing}
              />
              {editing ? (
                <p className="text-xs text-muted-foreground">Codes are set at creation and cannot be changed.</p>
              ) : (
                <p className="text-xs text-muted-foreground">Optional — defaults to the country initials (e.g. US).</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <select
                value={form.status}
                onChange={set("status")}
                className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
              >
                <option value="ACTIVE">Active</option>
                <option value="INACTIVE">Inactive</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input value={form.phone} onChange={set("phone")} placeholder="+1 …" />
            </div>
            <div className="space-y-1.5">
              <Label>Timezone</Label>
              <Input value={form.timezone} onChange={set("timezone")} placeholder="e.g. America/New_York" />
            </div>
            <div className="space-y-1.5">
              <Label>Currency</Label>
              <select
                value={form.currency}
                onChange={set("currency")}
                className="h-10 w-full rounded-lg border bg-card px-3 text-sm"
              >
                {currencyOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Operating hours</Label>
              <Input
                value={form.operatingHours}
                onChange={set("operatingHours")}
                placeholder="e.g. Mon-Sat 08:00-18:00"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Address lines</Label>
              <Textarea
                rows={2}
                value={form.addressLines}
                onChange={set("addressLines")}
                placeholder={"Street, suite…\nCity, State, ZIP, Country"}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Capabilities</Label>
              <Input
                value={form.capabilities}
                onChange={set("capabilities")}
                placeholder="Comma-separated, e.g. receiving, storage, consolidation"
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label>Supported carriers</Label>
              <Input
                value={form.supportedCarriers}
                onChange={set("supportedCarriers")}
                placeholder="Comma-separated, e.g. DHL, UPS, FedEx"
              />
            </div>
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? "Saving…" : editing ? "Save changes" : "Create warehouse"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Warehouses — the SwiftKifisha receiving hubs. Create/edit warehouses; the
 * receiving workstation and package queue reference them by code.
 */
export default function Warehouses() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosInstance.get("/admin/warehouses");
      setRows(data.warehouses || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load warehouses.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setDialogOpen(true);
  };

  const openEdit = (warehouse) => {
    setEditing(warehouse);
    setDialogOpen(true);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <WarehouseIcon className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouses</h1>
            <p className="text-sm text-muted-foreground">
              SwiftKifisha receiving hubs. New packages arrive here before they are assigned to a member.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
          <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> New warehouse
          </Button>
        </div>
      </header>

      {error ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-14 text-center">
            <CircleAlert className="h-10 w-10 text-destructive opacity-70" />
            <p className="text-sm text-destructive">{error}</p>
            <Button variant="outline" size="sm" onClick={load}>
              <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-3 py-16 text-center text-muted-foreground">
            <Building2 className="h-10 w-10 opacity-40" />
            <p className="font-medium text-foreground">No warehouses yet</p>
            <p className="text-sm">Create your first receiving hub with “New warehouse”.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {rows.map((w) => (
            <Card key={w._id} className="border-0 shadow-md">
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate font-semibold">{w.name}</p>
                    <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs font-medium text-muted-foreground">
                      {w.code}
                    </span>
                  </div>
                  <div className="flex shrink-0 items-center gap-1.5">
                    <Badge className={STATUS_STYLE[w.status] || "bg-muted"}>{w.status}</Badge>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Edit warehouse"
                      onClick={() => openEdit(w)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" /> {w.city}, {w.country}
                  <span className="mx-0.5 text-border">|</span>
                  <Coins className="h-3.5 w-3.5" /> {w.currency}
                </p>

                {(w.addressLines || []).length > 0 && (
                  <p className="mt-1.5 whitespace-pre-line text-xs text-muted-foreground">
                    {w.addressLines.join("\n")}
                  </p>
                )}

                <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {w.phone && (
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" /> {w.phone}
                    </span>
                  )}
                  {w.timezone && (
                    <span className="flex items-center gap-1">
                      <Globe className="h-3 w-3" /> {w.timezone}
                    </span>
                  )}
                  {w.operatingHours && (
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" /> {w.operatingHours}
                    </span>
                  )}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {(w.capabilities || []).map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
                    >
                      {c}
                    </span>
                  ))}
                  {(w.supportedCarriers || []).map((c) => (
                    <span
                      key={c}
                      className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground"
                    >
                      {c}
                    </span>
                  ))}
                  {(w.capabilities || []).length === 0 && (w.supportedCarriers || []).length === 0 && (
                    <span className="text-xs text-muted-foreground">No capabilities set</span>
                  )}
                </div>

                <p className="mt-3 text-xs text-muted-foreground">Created {fmtDate(w.createdAt)}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <WarehouseFormDialog
        open={dialogOpen}
        warehouse={editing}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditing(null);
        }}
        onSaved={load}
      />
    </div>
  );
}
