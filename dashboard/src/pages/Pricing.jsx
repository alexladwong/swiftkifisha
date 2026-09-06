import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Tags,
  Plus,
  Pencil,
  Trash2,
  RefreshCw,
  CircleAlert,
  Info,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { fmtDate } from "@/lib/moneyOps";

/** Codes are lowercase letters, digits and dots (mirrors the backend rule). */
const CODE_RE = /^[a-z0-9.]+$/;

/** Shared create/edit dialog for one pricing rule. */
function RuleFormDialog({ open, rule, onOpenChange, onSaved }) {
  const editing = !!rule;
  const [form, setForm] = useState({ code: "", value: "", unit: "", note: "" });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  useEffect(() => {
    if (open) {
      setForm(
        editing
          ? {
              code: rule.code || "",
              value: rule.value != null ? String(rule.value) : "",
              unit: rule.unit || "",
              note: rule.note || "",
            }
          : { code: "", value: "", unit: "", note: "" },
      );
      setFormError("");
      setSaving(false);
    }
  }, [open, rule, editing]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setFormError("");
    const value = Number(form.value);
    if (!editing && !CODE_RE.test(form.code.trim())) {
      setFormError("Code may contain lowercase letters, digits and dots only (e.g. storage.rate).");
      return;
    }
    if (form.value.trim() === "" || !Number.isFinite(value)) {
      setFormError("Value must be a number.");
      return;
    }
    setSaving(true);
    try {
      const payload = editing
        ? { value, unit: form.unit.trim() || undefined, note: form.note.trim() || undefined }
        : { code: form.code.trim(), value, unit: form.unit.trim() || undefined, note: form.note.trim() || undefined };
      const { data } = editing
        ? await axiosInstance.patch(`/admin/pricing-rules/${rule._id || rule.code}`, payload)
        : await axiosInstance.post("/admin/pricing-rules", payload);
      toast.success(data?.message || (editing ? "Rule updated." : `Rule ${form.code.trim()} created.`));
      onSaved();
      onOpenChange(false);
    } catch (err) {
      // Duplicate-code 409s (and any validation messages) appear verbatim.
      setFormError(err?.response?.data?.message || "Could not save the rule.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? `Edit rule ${rule.code}` : "New pricing rule"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Change the value, unit or note. The code identifies the rule and cannot be changed."
              : "Codes are lowercase letters, digits and dots — e.g. storage.rate."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {!editing && (
            <div className="space-y-1.5">
              <Label htmlFor="pr-code">Code *</Label>
              <Input
                id="pr-code"
                className="h-9 font-mono text-sm"
                placeholder="e.g. usd.rate"
                value={form.code}
                onChange={set("code")}
                maxLength={80}
              />
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="pr-value">Value *</Label>
              <Input
                id="pr-value"
                type="number"
                step="any"
                className="h-9 text-sm"
                placeholder="0.00"
                value={form.value}
                onChange={set("value")}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pr-unit">Unit</Label>
              <Input
                id="pr-unit"
                className="h-9 text-sm"
                placeholder="e.g. USD/kg"
                value={form.unit}
                onChange={set("unit")}
                maxLength={60}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pr-note">Note</Label>
            <Textarea
              id="pr-note"
              rows={2}
              placeholder="What this rule covers / when it applies"
              value={form.note}
              onChange={set("note")}
              maxLength={300}
            />
          </div>

          {formError && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
              <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" disabled={saving} onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={saving} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {saving ? (
                <>
                  <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Saving…
                </>
              ) : editing ? (
                "Save changes"
              ) : (
                "Create rule"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Confirm-before-delete dialog for one pricing rule. */
function DeleteRuleDialog({ rule, onOpenChange, onSaved }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (rule) {
      setBusy(false);
      setError("");
    }
  }, [rule]);

  const remove = async () => {
    setBusy(true);
    setError("");
    try {
      const { data } = await axiosInstance.delete(`/admin/pricing-rules/${rule._id || rule.code}`);
      toast.success(data?.message || "Rule deleted.");
      onSaved();
      onOpenChange(false);
    } catch (err) {
      setError(err?.response?.data?.message || "Could not delete the rule.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog open={rule !== null} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10 text-destructive">
              <Trash2 className="h-4 w-4" />
            </span>
            Delete pricing rule
          </DialogTitle>
          <DialogDescription>
            Remove <span className="font-mono text-foreground">{rule?.code}</span> from the backend rules table?
            Quotes and invoices stop reading it for new work — this cannot be undone.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-sm text-destructive">
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" disabled={busy} onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="button" variant="destructive" disabled={busy} onClick={remove}>
            {busy ? (
              <>
                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" /> Deleting…
              </>
            ) : (
              "Delete rule"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/**
 * Pricing rules — the backend rate table used when quoting and invoicing.
 * Create/edit/delete rules; changing a rate affects new quotes and invoices.
 */
export default function Pricing() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await axiosInstance.get("/admin/pricing-rules");
      setRows(data.rules || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load pricing rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEdit = (rule) => {
    setEditing(rule);
    setFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Tags className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Pricing rules</h1>
            <p className="text-sm text-muted-foreground">
              The rate table the backend uses to compute quotes and invoices — codes like{" "}
              <span className="font-mono">usd.rate</span> or <span className="font-mono">storage.rate</span>.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
          <Button onClick={openNew} className="bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="mr-1.5 h-4 w-4" /> New rule
          </Button>
        </div>
      </header>

      <p className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/70 px-3 py-2.5 text-sm text-amber-800">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Pricing lives on the backend — quotes and invoices read these rules. Changing a rate affects new quotes
          and invoices.
        </span>
      </p>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {loading && rows.length === 0 ? "…" : `${rows.length} rule${rows.length === 1 ? "" : "s"}`}
            </p>
            <p className="text-xs text-muted-foreground">
              Edited rules are stamped with the staff account that changed them.
            </p>
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
              <Tags className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">No pricing rules yet</p>
              <p className="text-sm">Create the first rule so the backend can compute quotes and invoices.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Code</TableHead>
                    <TableHead>Value</TableHead>
                    <TableHead>Unit</TableHead>
                    <TableHead>Note</TableHead>
                    <TableHead>Updated by</TableHead>
                    <TableHead className="hidden xl:table-cell">Created</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((rule) => (
                    <TableRow key={rule._id}>
                      <TableCell>
                        <span className="font-mono text-xs font-semibold">{rule.code}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{rule.value}</span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm text-muted-foreground">{rule.unit || "—"}</span>
                      </TableCell>
                      <TableCell className="max-w-[300px]">
                        <span className="block truncate text-sm text-muted-foreground" title={rule.note}>
                          {rule.note || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-[200px]">
                        <span className="block truncate text-sm" title={rule.updatedBy}>
                          {rule.updatedBy || "—"}
                        </span>
                      </TableCell>
                      <TableCell className="hidden text-sm text-muted-foreground xl:table-cell">
                        {fmtDate(rule.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Edit rule"
                            onClick={() => openEdit(rule)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive/70 hover:bg-destructive/10 hover:text-destructive"
                            title="Delete rule"
                            onClick={() => setDeleting(rule)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <RuleFormDialog
        open={formOpen}
        rule={editing}
        onOpenChange={(open) => {
          setFormOpen(open);
          if (!open) setEditing(null);
        }}
        onSaved={load}
      />

      <DeleteRuleDialog
        rule={deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
        onSaved={load}
      />
    </div>
  );
}
