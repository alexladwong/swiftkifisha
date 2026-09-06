import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ReceiptText,
  RefreshCw,
  Search,
  CircleAlert,
  Eye,
  ArrowRight,
  FileText,
  ListChecks,
  CreditCard,
  Boxes,
  Truck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "@/components/ui/dialog";
import { axiosInstance } from "@/services/axiosInstance";
import {
  INVOICE_STATUSES,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
  PAYMENT_STATUS_LABEL,
  PAYMENT_STATUS_STYLE,
  SHIPMENT_STATUS_LABEL,
  SHIPMENT_STATUS_STYLE,
  CHANNEL_LABEL,
  fmtMoney,
  fmtDate,
  fmtDateTime,
} from "@/lib/moneyOps";
import { STATUS_LABEL as PACKAGE_STATUS_LABEL, STATUS_STYLE as PACKAGE_STATUS_STYLE } from "@/lib/packageOps";

function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-4 w-4" />} {children}
    </h3>
  );
}

function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

function StatusChip({ style, children }) {
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (style || "bg-muted text-muted-foreground")
      }
    >
      {children}
    </span>
  );
}

/** Render a destination address whether the backend sends text or fields. */
const destinationText = (addr) => {
  if (!addr) return "—";
  if (typeof addr === "string") return addr.trim() || "—";
  if (typeof addr === "object") {
    const parts = ["line1", "line2", "address", "street", "city", "state", "province", "zip", "postalCode", "country"]
      .map((k) => addr[k])
      .filter((v) => v);
    return parts.length ? parts.join(", ") : "—";
  }
  return "—";
};

const refsOf = (inv) =>
  (inv.packageRefs || []).map((r) => (typeof r === "string" ? r : r?.packageId || r?._id || "")).filter(Boolean);

const EMPTY_VIEW = { id: null, loading: false, error: "", data: null };

/**
 * Invoices — read-only finance records (SKI-*). Rows open a detail dialog
 * with line items, totals, payments and the shipment (when one exists).
 * Payment actions live on the Payments page.
 */
export default function Invoices() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");

  const [active, setActive] = useState(null); // list invoice opened
  const [view, setView] = useState(EMPTY_VIEW); // fetched detail

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status !== "all") params.status = status;
      const { data } = await axiosInstance.get("/admin/invoices", { params });
      setRows(data.invoices || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load invoices.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const openInvoice = (inv) => {
    const id = inv._id;
    setActive(inv);
    setView({ id, loading: true, error: "", data: null });
    axiosInstance
      .get(`/admin/invoices/${id}`)
      .then(({ data }) => setView((v) => (v.id === id ? { id, loading: false, error: "", data } : v)))
      .catch((err) =>
        setView((v) =>
          v.id === id
            ? { id, loading: false, error: err?.response?.data?.message || "Could not load invoice.", data: null }
            : v,
        ),
      );
  };

  const closeDetail = () => {
    setActive(null);
    setView(EMPTY_VIEW);
  };

  const totalShown =
    loading && rows.length === 0 ? "…" : `${rows.length} invoice${rows.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <ReceiptText className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Invoices</h1>
            <p className="text-sm text-muted-foreground">
              Member invoices from the finance backend (SKI-*) — line items, totals, payments and the linked
              shipment. Payment actions live on the Payments page.
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={load} title="Refresh" disabled={loading}>
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} />
          </Button>
        </div>
      </header>

      <Card className="border-0 shadow-md">
        <CardContent className="pt-6">
          <div className="mb-4 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-1 flex-col gap-3 lg:flex-row lg:items-center">
              <div className="relative flex-1 lg:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="pl-9"
                  placeholder="Search invoice ID, member email, member code…"
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
                  {INVOICE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {INVOICE_STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <p className="text-sm text-muted-foreground">{totalShown}</p>
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
              <ReceiptText className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">No invoices match</p>
              <p className="text-sm">
                {status !== "all" || search
                  ? "Try clearing the filters above."
                  : "Invoices issued by the backend for member consolidations will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Packages</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead>Paid</TableHead>
                    <TableHead>Balance</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden md:table-cell">Issued</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((inv) => {
                    const refs = refsOf(inv);
                    return (
                      <TableRow key={inv._id} className="cursor-pointer" onClick={() => openInvoice(inv)}>
                        <TableCell>
                          <p className="font-mono text-xs font-semibold">{inv.invoiceId}</p>
                          {inv.paidAt && (
                            <p className="text-[11px] text-emerald-700">paid {fmtDate(inv.paidAt)}</p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[220px]">
                          <span className="block truncate text-sm">{inv.customerEmail || "—"}</span>
                          {inv.memberCode && (
                            <p className="font-mono text-[11px] text-muted-foreground">{inv.memberCode}</p>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px]">
                          {refs.length ? (
                            <span className="block truncate font-mono text-xs text-muted-foreground" title={refs.join(", ")}>
                              {refs.slice(0, 2).join(", ")}
                              {refs.length > 2 ? ` +${refs.length - 2}` : ""}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <span className="text-sm font-medium">{fmtMoney(inv.total, inv.currency || "USD")}</span>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-emerald-700">
                            {fmtMoney(inv.amountPaid, inv.currency || "USD")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span
                            className={
                              "text-sm font-semibold " +
                              (Number(inv.balance) > 0 ? "text-amber-700" : "text-muted-foreground")
                            }
                          >
                            {fmtMoney(inv.balance, inv.currency || "USD")}
                          </span>
                        </TableCell>
                        <TableCell>
                          <StatusChip style={INVOICE_STATUS_STYLE[inv.status]}>
                            {INVOICE_STATUS_LABEL[inv.status] || inv.status}
                          </StatusChip>
                        </TableCell>
                        <TableCell className="hidden text-sm md:table-cell">{fmtDate(inv.createdAt)}</TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            title="Open invoice"
                            onClick={(e) => {
                              e.stopPropagation();
                              openInvoice(inv);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------- invoice dialog ----------------------------- */}
      <Dialog open={active !== null} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{view.data?.invoice?.invoiceId || active?.invoiceId}</span>
              {view.data?.invoice && (
                <StatusChip style={INVOICE_STATUS_STYLE[view.data.invoice.status]}>
                  {INVOICE_STATUS_LABEL[view.data.invoice.status] || view.data.invoice.status}
                </StatusChip>
              )}
            </DialogTitle>
            <DialogDescription>
              {view.data?.invoice?.customerEmail || active?.customerEmail || "—"}
              {view.data?.invoice?.memberCode ? ` · ${view.data.invoice.memberCode}` : ""}
              {view.data?.invoice?.createdAt ? ` · issued ${fmtDate(view.data.invoice.createdAt)}` : ""}
            </DialogDescription>
          </DialogHeader>

          <div className="-mr-3 max-h-[70vh] space-y-6 overflow-y-auto pr-3">
            {view.loading ? (
              <div className="space-y-3">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : view.error ? (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <CircleAlert className="h-8 w-8 text-destructive opacity-70" />
                <p className="text-sm text-destructive">{view.error}</p>
                <Button variant="outline" size="sm" onClick={() => active && openInvoice(active)}>
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : (
              view.data &&
              (() => {
                const inv = view.data.invoice;
                const payments = view.data.payments || [];
                const packages = view.data.packages || [];
                const shipment = view.data.shipment || null;
                const currency = inv.currency || "USD";
                const money = (v) => (v == null ? "—" : fmtMoney(v, currency));
                const lineItems = inv.lineItems || [];
                return (
                  <>
                    {/* ------------------------------- overview ------------------------------- */}
                    <div className="space-y-2">
                      <SectionTitle icon={FileText}>Overview</SectionTitle>
                      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Member">{inv.customerEmail || "—"}</Field>
                        <Field label="Member code">
                          <span className="font-mono text-xs">{inv.memberCode || "—"}</span>
                        </Field>
                        <Field label="Service type">{inv.serviceType || "—"}</Field>
                        <Field label="Chargeable weight">
                          {inv.chargeableWeightKg != null ? `${inv.chargeableWeightKg} kg` : "—"}
                        </Field>
                        <Field label="Declared value">{money(inv.declaredValue)}</Field>
                        <Field label="Insurance">{money(inv.insurance)}</Field>
                        <Field label="Issued">{fmtDateTime(inv.createdAt)}</Field>
                        <Field label="Paid">{inv.paidAt ? fmtDateTime(inv.paidAt) : "—"}</Field>
                      </div>
                      <Field label="Destination address">
                        <p className="whitespace-pre-line rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground">
                          {destinationText(inv.destinationAddress)}
                        </p>
                      </Field>
                    </div>

                    {/* ------------------------------ line items ------------------------------ */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={ListChecks}>Line items</SectionTitle>
                      {lineItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No line items recorded on this invoice.</p>
                      ) : (
                        <>
                          <div className="overflow-hidden rounded-lg border border-border/70">
                            <div className="grid grid-cols-[90px_1fr_56px_96px] gap-2 border-b border-border/70 bg-muted/40 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              <span>Code</span>
                              <span>Item</span>
                              <span className="text-right">Qty</span>
                              <span className="text-right">Amount</span>
                            </div>
                            {lineItems.map((li, idx) => (
                              <div
                                key={li.code || idx}
                                className="grid grid-cols-[90px_1fr_56px_96px] gap-2 border-b border-border/50 px-3 py-2 text-sm last:border-0"
                              >
                                <span className="font-mono text-xs">{li.code || "—"}</span>
                                <span className="truncate" title={li.label}>
                                  {li.label || "—"}
                                </span>
                                <span className="text-right">{li.qty ?? "—"}</span>
                                <span className="text-right font-medium">{money(li.amount)}</span>
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Subtotal</span>
                              <span>{money(inv.subtotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Insurance</span>
                              <span>{money(inv.insurance)}</span>
                            </div>
                            <div className="flex justify-between border-t border-border/60 pt-1 text-base font-semibold">
                              <span>Total</span>
                              <span>{money(inv.total)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Amount paid</span>
                              <span className="font-medium text-emerald-700">{money(inv.amountPaid)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">Balance due</span>
                              <span className={Number(inv.balance) > 0 ? "font-semibold text-amber-700" : ""}>
                                {money(inv.balance)}
                              </span>
                            </div>
                          </div>
                        </>
                      )}
                    </div>

                    {/* -------------------------------- payments ------------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={CreditCard}>
                        Payments <span className="font-normal normal-case">({payments.length})</span>
                      </SectionTitle>
                      {payments.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No payments recorded against this invoice.</p>
                      ) : (
                        <div className="space-y-2">
                          {payments.map((p) => (
                            <div
                              key={p._id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm"
                            >
                              <span className="font-mono text-xs font-semibold">{p.paymentId}</span>
                              <StatusChip style={PAYMENT_STATUS_STYLE[p.status]}>
                                {PAYMENT_STATUS_LABEL[p.status] || p.status}
                              </StatusChip>
                              <span className="font-medium">{fmtMoney(p.amount, p.currency || currency)}</span>
                              <span className="text-xs text-muted-foreground">
                                {CHANNEL_LABEL[p.channel] || p.channel || "—"}
                              </span>
                              {p.reference && (
                                <span className="font-mono text-xs text-muted-foreground">{p.reference}</span>
                              )}
                              <span className="ml-auto text-xs text-muted-foreground">
                                {fmtDateTime(p.createdAt)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* ------------------------------- packages ------------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={Boxes}>
                        Packages <span className="font-normal normal-case">({packages.length})</span>
                      </SectionTitle>
                      {packages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No packages linked to this invoice.</p>
                      ) : (
                        <div className="space-y-2">
                          {packages.map((pkg) => (
                            <div
                              key={pkg._id}
                              className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm"
                            >
                              <span className="font-mono text-xs font-semibold">{pkg.packageId}</span>
                              <StatusChip style={PACKAGE_STATUS_STYLE[pkg.status]}>
                                {PACKAGE_STATUS_LABEL[pkg.status] || pkg.status}
                              </StatusChip>
                              <span className="truncate text-xs text-muted-foreground">
                                {pkg.merchant || "—"}
                                {pkg.warehouseCountry ? ` · ${pkg.warehouseCountry}` : ""}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* -------------------------------- shipment ------------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={Truck}>Shipment</SectionTitle>
                      {shipment ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2.5">
                          <span className="font-mono text-sm font-semibold">{shipment.shipmentId}</span>
                          <StatusChip style={SHIPMENT_STATUS_STYLE[shipment.status]}>
                            {SHIPMENT_STATUS_LABEL[shipment.status] || shipment.status}
                          </StatusChip>
                          {shipment.events?.length != null && (
                            <span className="text-xs text-muted-foreground">
                              {shipment.events.length} event{shipment.events.length === 1 ? "" : "s"}
                            </span>
                          )}
                          <Link
                            to={`/shipments?search=${encodeURIComponent(shipment.shipmentId)}`}
                            className="ml-auto inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
                          >
                            Open in Shipments <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">
                          No shipment is linked to this invoice yet — it appears here once the backend creates one.
                        </p>
                      )}
                    </div>
                  </>
                );
              })()
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
