import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import {
  Truck,
  RefreshCw,
  Search,
  CircleAlert,
  Eye,
  MapPin,
  PackageSearch,
  FileText,
  History,
  ClipboardList,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  SHIPMENT_STATUSES,
  SHIPMENT_STATUS_LABEL,
  SHIPMENT_STATUS_STYLE,
  INVOICE_STATUS_LABEL,
  INVOICE_STATUS_STYLE,
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

/** Best-effort country of a destination for compact list cells. */
const destinationCountry = (addr) => {
  if (!addr) return "—";
  if (typeof addr === "string") {
    const parts = addr.split(",").map((s) => s.trim()).filter(Boolean);
    return parts[parts.length - 1] || "—";
  }
  if (typeof addr === "object") return addr.country || addr.city || "—";
  return "—";
};

const EMPTY_VIEW = { id: null, loading: false, error: "", data: null };

/**
 * Shipments — commercial-forwarding shipments (SKS-*). Rows open a detail
 * dialog with packages, invoice reference, the event timeline and a
 * "Record event" panel driven by the backend's allowedTransitions.
 */
export default function Shipments() {
  const [params] = useSearchParams();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState(() => params.get("search") || "");
  const [status, setStatus] = useState("all");

  const [active, setActive] = useState(null); // list shipment opened
  const [view, setView] = useState(EMPTY_VIEW); // fetched detail

  // "Record event" inline form.
  const [recordTo, setRecordTo] = useState(null);
  const [loc, setLoc] = useState("");
  const [note, setNote] = useState("");
  const [eventBusy, setEventBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const q = {};
      if (search.trim()) q.search = search.trim();
      if (status !== "all") q.status = status;
      const { data } = await axiosInstance.get("/admin/shipments", { params: q });
      setRows(data.shipments || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load shipments.");
    } finally {
      setLoading(false);
    }
  }, [search, status]);

  useEffect(() => {
    load();
  }, [load]);

  const fetchDetail = (id) => {
    axiosInstance
      .get(`/admin/shipments/${id}`)
      .then(({ data }) => setView((v) => (v.id === id ? { id, loading: false, error: "", data } : v)))
      .catch((err) =>
        setView((v) =>
          v.id === id
            ? { id, loading: false, error: err?.response?.data?.message || "Could not load shipment.", data: null }
            : v,
        ),
      );
  };

  const openShipment = (sh) => {
    const id = sh._id;
    setActive(sh);
    setView({ id, loading: true, error: "", data: null });
    fetchDetail(id);
  };

  const refreshDetail = () => {
    if (active) fetchDetail(active._id);
  };

  const closeDetail = () => {
    setActive(null);
    setView(EMPTY_VIEW);
    setRecordTo(null);
    setLoc("");
    setNote("");
  };

  const pickTransition = (to) => {
    setRecordTo(to);
    setLoc("");
    setNote("");
  };

  const submitEvent = async (e) => {
    e.preventDefault();
    if (!recordTo) return;
    setEventBusy(true);
    try {
      const body = { status: recordTo };
      if (loc.trim()) body.location = loc.trim();
      if (note.trim()) body.note = note.trim();
      const { data } = await axiosInstance.post(
        `/admin/shipments/${view.data.shipment._id}/events`,
        body,
      );
      // Success message verbatim; 409 machine rejections come back verbatim too.
      toast.success(data?.message || "Event recorded.");
      setRecordTo(null);
      setLoc("");
      setNote("");
      refreshDetail();
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not record the event.");
    } finally {
      setEventBusy(false);
    }
  };

  const totalShown =
    loading && rows.length === 0 ? "…" : `${rows.length} shipment${rows.length === 1 ? "" : "s"}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Truck className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Shipments</h1>
            <p className="text-sm text-muted-foreground">
              Commercial-forwarding shipments (SKS-*) created for paid invoices — follow the event timeline and
              record staff events where the backend state machine allows.
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
                  placeholder="Search shipment ID, member email, carrier…"
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
                  {SHIPMENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {SHIPMENT_STATUS_LABEL[s]}
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
              <Truck className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">No shipments match</p>
              <p className="text-sm">
                {status !== "all" || search
                  ? "Try clearing the filters above."
                  : "Shipments created by the backend for paid invoices will appear here."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Shipment</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead>Destination</TableHead>
                    <TableHead>Total</TableHead>
                    <TableHead className="hidden md:table-cell">Created</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((s) => (
                    <TableRow key={s._id} className="cursor-pointer" onClick={() => openShipment(s)}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{s.shipmentId}</p>
                        {(s.carrierName || (s.packageIds || []).length > 0) && (
                          <p className="text-[11px] text-muted-foreground">
                            {[s.carrierName, s.packageIds ? `${s.packageIds.length} package${s.packageIds.length === 1 ? "" : "s"}` : ""]
                              .filter(Boolean)
                              .join(" · ")}
                          </p>
                        )}
                      </TableCell>
                      <TableCell>
                        <StatusChip style={SHIPMENT_STATUS_STYLE[s.status]}>
                          {SHIPMENT_STATUS_LABEL[s.status] || s.status}
                        </StatusChip>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="block truncate text-sm">{s.customerEmail || "—"}</span>
                        {s.memberCode && (
                          <p className="font-mono text-[11px] text-muted-foreground">{s.memberCode}</p>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[180px]">
                        <span className="block truncate text-sm" title={destinationText(s.destinationAddress)}>
                          {destinationCountry(s.destinationAddress)}
                        </span>
                      </TableCell>
                      <TableCell>
                        <span className="text-sm font-medium">{fmtMoney(s.total, s.currency || "USD")}</span>
                      </TableCell>
                      <TableCell className="hidden text-sm md:table-cell">{fmtDate(s.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Open shipment"
                          onClick={(e) => {
                            e.stopPropagation();
                            openShipment(s);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------- shipment dialog ---------------------------- */}
      <Dialog open={active !== null} onOpenChange={(open) => !open && closeDetail()}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="flex flex-wrap items-center gap-2">
              <span className="font-mono">{view.data?.shipment?.shipmentId || active?.shipmentId}</span>
              {view.data?.shipment && (
                <StatusChip style={SHIPMENT_STATUS_STYLE[view.data.shipment.status]}>
                  {SHIPMENT_STATUS_LABEL[view.data.shipment.status] || view.data.shipment.status}
                </StatusChip>
              )}
            </DialogTitle>
            <DialogDescription>
              {view.data?.shipment?.customerEmail || active?.customerEmail || "—"}
              {view.data?.shipment?.memberCode ? ` · ${view.data.shipment.memberCode}` : ""}
              {view.data?.shipment?.createdAt ? ` · created ${fmtDate(view.data.shipment.createdAt)}` : ""}
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
                <Button variant="outline" size="sm" onClick={refreshDetail}>
                  <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
                </Button>
              </div>
            ) : (
              view.data &&
              (() => {
                const shipment = view.data.shipment;
                const packages = view.data.packages || [];
                const invoice = view.data.invoice || null;
                const transitions = shipment.allowedTransitions || [];
                const events = [...(shipment.events || [])].sort(
                  (a, b) => new Date(b.at || 0) - new Date(a.at || 0),
                );
                return (
                  <>
                    {/* ------------------------------- overview ------------------------------- */}
                    <div className="space-y-2">
                      <SectionTitle icon={Truck}>Overview</SectionTitle>
                      <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                        <Field label="Member">{shipment.customerEmail || "—"}</Field>
                        <Field label="Member code">
                          <span className="font-mono text-xs">{shipment.memberCode || "—"}</span>
                        </Field>
                        <Field label="Carrier">
                          {[shipment.carrierName, shipment.carrierCode].filter(Boolean).join(" · ") || "—"}
                        </Field>
                        <Field label="Service type">{shipment.serviceType || "—"}</Field>
                        <Field label="Total">
                          <span className="font-medium">{fmtMoney(shipment.total, shipment.currency || "USD")}</span>
                        </Field>
                        <Field label="Packages">{(shipment.packageIds || []).length}</Field>
                        <Field label="Created">
                          {shipment.createdAt ? fmtDateTime(shipment.createdAt) : "—"}
                        </Field>
                        <Field label="Dispatched">
                          {shipment.dispatchedAt ? fmtDateTime(shipment.dispatchedAt) : "—"}
                        </Field>
                        <Field label="Delivered">
                          {shipment.deliveredAt ? fmtDateTime(shipment.deliveredAt) : "—"}
                        </Field>
                      </div>
                      <Field label="Destination address">
                        <p className="whitespace-pre-line rounded-lg border border-border/70 bg-muted/30 px-3 py-2 text-muted-foreground">
                          {destinationText(shipment.destinationAddress)}
                        </p>
                      </Field>
                    </div>

                    {/* ------------------------------- packages ------------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={PackageSearch}>
                        Packages <span className="font-normal normal-case">({packages.length})</span>
                      </SectionTitle>
                      {packages.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No packages linked to this shipment.</p>
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

                    {/* ------------------------------ invoice ref ------------------------------ */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={FileText}>Invoice</SectionTitle>
                      {invoice && invoice.invoiceId ? (
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-border/70 bg-card px-3 py-2 text-sm">
                          <span className="font-mono text-xs font-semibold">{invoice.invoiceId}</span>
                          <StatusChip style={INVOICE_STATUS_STYLE[invoice.status]}>
                            {INVOICE_STATUS_LABEL[invoice.status] || invoice.status}
                          </StatusChip>
                          <span className="font-medium">{fmtMoney(invoice.total, invoice.currency || "USD")}</span>
                          <span className="ml-auto text-xs text-muted-foreground">
                            {invoice.customerEmail || "—"}
                          </span>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">No invoice linked to this shipment.</p>
                      )}
                    </div>

                    {/* -------------------------------- timeline ------------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={History}>
                        Timeline <span className="font-normal normal-case">({events.length})</span>
                      </SectionTitle>
                      {events.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No events recorded for this shipment yet — record the first one below.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {events.map((ev, idx) => (
                            <div key={idx} className="rounded-lg border border-border/70 bg-card px-3 py-2">
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                                <StatusChip style={SHIPMENT_STATUS_STYLE[ev.status]}>
                                  {SHIPMENT_STATUS_LABEL[ev.status] || ev.status}
                                </StatusChip>
                                <span className="ml-auto text-xs text-muted-foreground">
                                  {fmtDateTime(ev.at)}
                                </span>
                              </div>
                              {(ev.location || ev.note) && (
                                <div className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                                  {ev.location && (
                                    <p className="flex items-center gap-1">
                                      <MapPin className="h-3 w-3 shrink-0" /> {ev.location}
                                    </p>
                                  )}
                                  {ev.note && <p className="whitespace-pre-line">{ev.note}</p>}
                                </div>
                              )}
                              {ev.actor && (
                                <p className="mt-0.5 text-[11px] text-muted-foreground">by {ev.actor}</p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      <p className="text-xs text-muted-foreground">
                        Events on this timeline are recorded by SwiftKifisha staff. Carrier/webhook tracking
                        events will stream in automatically once carrier APIs are connected.
                      </p>
                    </div>

                    {/* ----------------------------- record event ----------------------------- */}
                    <div className="space-y-2 border-t border-border/60 pt-4">
                      <SectionTitle icon={ClipboardList}>Record event</SectionTitle>
                      {transitions.length === 0 ? (
                        <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                          No further transitions — shipment complete.
                        </p>
                      ) : (
                        <>
                          <p className="text-xs text-muted-foreground">
                            Allowed next statuses from “{SHIPMENT_STATUS_LABEL[shipment.status] || shipment.status}”
                            — the backend state machine decides; its messages (including 409 rejections) appear
                            verbatim.
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {transitions.map((to) => (
                              <Button
                                key={to}
                                type="button"
                                variant="outline"
                                size="sm"
                                disabled={eventBusy}
                                onClick={() => pickTransition(to)}
                              >
                                {SHIPMENT_STATUS_LABEL[to] || to}
                              </Button>
                            ))}
                          </div>
                          {recordTo && (
                            <form
                              onSubmit={submitEvent}
                              className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3"
                            >
                              <p className="text-xs font-semibold text-primary">
                                Record “{SHIPMENT_STATUS_LABEL[recordTo] || recordTo}”
                              </p>
                              <div className="grid gap-3 sm:grid-cols-2">
                                <div className="space-y-1">
                                  <Label className="text-xs">Location (optional)</Label>
                                  <Input
                                    className="h-9 text-sm"
                                    placeholder="e.g. Entebbe hub"
                                    value={loc}
                                    onChange={(e) => setLoc(e.target.value)}
                                    maxLength={200}
                                  />
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Note (optional)</Label>
                                  <Input
                                    className="h-9 text-sm"
                                    placeholder="e.g. Handed to carrier at pickup"
                                    value={note}
                                    onChange={(e) => setNote(e.target.value)}
                                    maxLength={300}
                                  />
                                </div>
                              </div>
                              <div className="flex justify-end gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  disabled={eventBusy}
                                  onClick={() => setRecordTo(null)}
                                >
                                  Cancel
                                </Button>
                                <Button type="submit" size="sm" disabled={eventBusy}>
                                  {eventBusy ? (
                                    <>
                                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Recording…
                                    </>
                                  ) : (
                                    "Record event"
                                  )}
                                </Button>
                              </div>
                            </form>
                          )}
                        </>
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
