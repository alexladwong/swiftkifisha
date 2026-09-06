import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  PackageSearch,
  RefreshCw,
  Eye,
  Search,
  CircleAlert,
  UserRound,
  Ruler,
  ArrowRightLeft,
  Camera,
  Upload,
  LoaderCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
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
import { formatMoney } from "@/lib/money";
import { PackageStatusBadge } from "@/components/PackageStatusBadge";
import {
  PACKAGE_STATUSES,
  STATUS_LABEL,
  CONDITIONS,
  CONDITION_LABEL,
  PHOTO_VIEWS,
  PHOTO_VIEW_LABEL,
  fmtDate,
  fmtDateTime,
  fmtBytes,
  fmtKg,
} from "@/lib/packageOps";

const ALLOWED_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_PHOTO_BYTES = 8 * 1024 * 1024;

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

const EMPTY_MEASURE = { weight: "", length: "", width: "", height: "", condition: "undamaged", reason: "" };

/**
 * Warehouse packages (admin ops queue) — the Phase-1 commercial forwarding
 * receive/assign/measure/status/photos workstation. This is NOT the legacy
 * /manage-parcels shipments page (that one stays untouched).
 */
export default function WarehousePackages() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [unassignedOnly, setUnassignedOnly] = useState(false);

  // Package detail dialog state (kept in this file on purpose — no routed
  // detail page; the backend only exposes list + mutations).
  const [detail, setDetail] = useState(null);
  const [measure, setMeasure] = useState(EMPTY_MEASURE);
  const [assign, setAssign] = useState({ memberCode: "", email: "" });
  const [statusReason, setStatusReason] = useState("");
  const [busy, setBusy] = useState(null);
  const [photoFiles, setPhotoFiles] = useState([]);
  const [photoView, setPhotoView] = useState("front");
  const [photoUrls, setPhotoUrls] = useState({});
  const photoUrlRef = useRef({});
  const fileInputRef = useRef(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (status !== "all") params.status = status;
      if (unassignedOnly) params.unassigned = "true";
      const { data } = await axiosInstance.get("/admin/packages", { params });
      setRows(data.packages || []);
    } catch (err) {
      setError(err?.response?.data?.message || "Failed to load packages.");
    } finally {
      setLoading(false);
    }
  }, [search, status, unassignedOnly]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = (pkg) => {
    setDetail(pkg);
    setMeasure({
      weight: pkg.weight ?? "",
      length: pkg.length ?? "",
      width: pkg.width ?? "",
      height: pkg.height ?? "",
      condition: pkg.condition || "undamaged",
      reason: "",
    });
    setAssign({ memberCode: "", email: "" });
    setStatusReason("");
    setPhotoFiles([]);
    setPhotoView("front");
  };

  const closeDetail = () => setDetail(null);

  /** Merge a fresh server package into the dialog and re-sync the queue. */
  const refreshAfter = (pkg) => {
    if (pkg) {
      setDetail((prev) => (prev && prev._id === pkg._id ? pkg : prev));
    }
    load();
  };

  /* -------------------- blob previews for photo files -------------------- */
  // Files require the auth header, so they can't be plain <img src>. Fetch as
  // blob and object-URL them here; all URLs are revoked when the dialog closes.
  useEffect(() => {
    if (!detail) return;
    let live = true;
    (detail.photos || []).forEach((ph) => {
      if (photoUrlRef.current[ph.id] !== undefined) return; // already loaded or failed
      axiosInstance
        .get(`/files/packages/${ph.id}`, { responseType: "blob" })
        .then(({ data }) => {
          if (!live) return;
          photoUrlRef.current[ph.id] = URL.createObjectURL(data);
          setPhotoUrls({ ...photoUrlRef.current });
        })
        .catch(() => {
          if (!live) return;
          photoUrlRef.current[ph.id] = null; // mark failed so we don't retry-loop
          setPhotoUrls({ ...photoUrlRef.current });
        });
    });
    return () => {
      live = false;
    };
  }, [detail]);

  // Revoke object URLs when the dialog closes and on unmount.
  useEffect(() => {
    if (detail) return;
    Object.values(photoUrlRef.current).forEach((u) => {
      if (u) URL.revokeObjectURL(u);
    });
    photoUrlRef.current = {};
    setPhotoUrls({});
  }, [detail]);

  /* ------------------------------ mutations ------------------------------ */

  const changeStatus = async (to) => {
    setBusy("status:" + to);
    try {
      const { data } = await axiosInstance.post(`/admin/packages/${detail._id}/status`, {
        status: to,
        reason: statusReason.trim(),
      });
      toast.success(data?.message || `Status changed to ${to}`);
      setStatusReason("");
      refreshAfter(data.package);
    } catch (err) {
      // 409 state-machine rejections shown verbatim.
      toast.error(err?.response?.data?.message || "Status change failed.");
    } finally {
      setBusy(null);
    }
  };

  const submitMeasure = async (e) => {
    e.preventDefault();
    setBusy("measure");
    try {
      const body = { condition: measure.condition, reason: measure.reason.trim() };
      for (const k of ["weight", "length", "width", "height"]) {
        if (measure[k] !== "") body[k] = Number(measure[k]);
      }
      const { data } = await axiosInstance.patch(`/admin/packages/${detail._id}/measurements`, body);
      toast.success(data?.message || "Measurements corrected (audited).");
      refreshAfter(data.package);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not save measurements.");
    } finally {
      setBusy(null);
    }
  };

  const submitAssign = async (e) => {
    e.preventDefault();
    if (!assign.memberCode.trim() && !assign.email.trim()) {
      toast.error("Enter a mailbox/member code or a member email.");
      return;
    }
    setBusy("assign");
    try {
      const { data } = await axiosInstance.post(`/admin/packages/${detail._id}/assign`, {
        memberCode: assign.memberCode.trim() || undefined,
        email: assign.email.trim() || undefined,
      });
      toast.success(data?.message || "Package assigned.");
      setAssign({ memberCode: "", email: "" });
      refreshAfter(data.package);
    } catch (err) {
      toast.error(err?.response?.data?.message || "Assign failed.");
    } finally {
      setBusy(null);
    }
  };

  const choosePhotos = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 6);
    setPhotoFiles(files);
    e.target.value = "";
  };

  const uploadPhotos = async () => {
    if (!photoFiles.length) return;
    if (photoFiles.length > 6) {
      toast.error("Up to 6 photos per upload.");
      return;
    }
    const badType = photoFiles.find((f) => !ALLOWED_PHOTO_TYPES.includes(f.type));
    if (badType) {
      toast.error(`"${badType.name}" is not a JPEG/PNG/WEBP/GIF image.`);
      return;
    }
    const tooBig = photoFiles.find((f) => f.size > MAX_PHOTO_BYTES);
    if (tooBig) {
      toast.error(`"${tooBig.name}" is larger than 8 MB.`);
      return;
    }
    setBusy("upload");
    try {
      const fd = new FormData();
      photoFiles.forEach((f) => fd.append("photos", f));
      fd.append("view", photoView);
      const { data } = await axiosInstance.post(`/admin/packages/${detail._id}/photos`, fd);
      toast.success(data?.message || "Photos saved.");
      setPhotoFiles([]);
      setDetail((prev) => (prev ? { ...prev, photos: data.photos || prev.photos } : prev));
      load();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Photo upload failed.");
    } finally {
      setBusy(null);
    }
  };

  const photos = detail?.photos || [];
  const transitions = detail?.allowedTransitions || [];

  const totalShown = useMemo(() => (loading && rows.length === 0 ? "…" : `${rows.length} package${rows.length === 1 ? "" : "s"}`), [loading, rows.length]);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <PackageSearch className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Warehouse packages</h1>
            <p className="text-sm text-muted-foreground">
              Packages received at SwiftKifisha hubs (SWPK-*) — assign mailboxes, correct measurements, move status and
              attach photos. Shipments of the legacy courier flow live under Manage Parcels.
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
                  placeholder="Search package ID, tracking, email, code, merchant…"
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
                  {PACKAGE_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm">
                <Checkbox
                  checked={unassignedOnly}
                  onCheckedChange={(v) => setUnassignedOnly(!!v)}
                />
                Unassigned only
              </label>
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
              <PackageSearch className="h-10 w-10 opacity-40" />
              <p className="font-medium text-foreground">No packages match</p>
              <p className="text-sm">
                {unassignedOnly || status !== "all" || search
                  ? "Try clearing the filters above."
                  : "Received packages will appear here after the Receiving workstation scans them in."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Package</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Member</TableHead>
                    <TableHead className="hidden md:table-cell">Merchant</TableHead>
                    <TableHead className="hidden lg:table-cell">Warehouse</TableHead>
                    <TableHead className="hidden lg:table-cell">Weight</TableHead>
                    <TableHead className="hidden sm:table-cell">Received</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((p) => (
                    <TableRow key={p._id} className="cursor-pointer" onClick={() => openDetail(p)}>
                      <TableCell>
                        <p className="font-mono text-xs font-semibold">{p.packageId}</p>
                        {p.merchantTrackingNumber && (
                          <p className="font-mono text-[11px] text-muted-foreground">{p.merchantTrackingNumber}</p>
                        )}
                      </TableCell>
                      <TableCell>
                        <PackageStatusBadge status={p.status} />
                      </TableCell>
                      <TableCell>
                        {p.customerEmail ? (
                          <span className="text-xs text-muted-foreground">{p.customerEmail}</span>
                        ) : (
                          <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                            Unassigned
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden max-w-[200px] md:table-cell">
                        <span className="block truncate text-sm">{p.merchant || "—"}</span>
                      </TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">{p.warehouseCountry || "—"}</TableCell>
                      <TableCell className="hidden text-sm lg:table-cell">
                        {p.weight != null ? (
                          <>
                            {fmtKg(p.weight)}
                            {p.chargeableWeight != null && p.chargeableWeight !== p.weight && (
                              <span className="block text-[11px] text-muted-foreground">
                                billable {fmtKg(p.chargeableWeight)}
                              </span>
                            )}
                          </>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden text-sm sm:table-cell">{fmtDate(p.receivedAt || p.createdAt)}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          title="Open package"
                          onClick={(e) => {
                            e.stopPropagation();
                            openDetail(p);
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

      <Dialog open={detail !== null} onOpenChange={(open) => !open && closeDetail()}>
        {detail && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{detail.packageId}</span>
                <PackageStatusBadge status={detail.status} />
              </DialogTitle>
              <DialogDescription>
                {detail.merchant || "Unknown merchant"}
                {detail.merchantTrackingNumber ? ` · ${detail.merchantTrackingNumber}` : ""} —{" "}
                {detail.customerEmail || "unassigned"}
              </DialogDescription>
            </DialogHeader>

            <div className="-mr-3 max-h-[65vh] space-y-6 overflow-y-auto pr-3">
              {/* ------------------------------- overview ------------------------------- */}
              <div className="space-y-2">
                <SectionTitle icon={PackageSearch}>Overview</SectionTitle>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Status">
                    <span className="flex items-center gap-2">
                      <PackageStatusBadge status={detail.status} />
                    </span>
                  </Field>
                  <Field label="Member">
                    {detail.customerEmail ? (
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1">
                          <UserRound className="h-3.5 w-3.5 text-muted-foreground" /> {detail.customerEmail}
                        </span>
                        {detail.memberCode && (
                          <span className="font-mono text-xs text-muted-foreground">{detail.memberCode}</span>
                        )}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Unassigned
                      </span>
                    )}
                  </Field>
                  <Field label="Warehouse">{detail.warehouseCountry || "—"}</Field>
                  <Field label="Merchant">{detail.merchant || "—"}</Field>
                  <Field label="Merchant tracking">
                    <span className="font-mono text-xs">{detail.merchantTrackingNumber || "—"}</span>
                  </Field>
                  <Field label="Carrier">{detail.carrier || "—"}</Field>
                  <Field label="Item count">{detail.itemCount ?? "—"}</Field>
                  <Field label="Declared value">
                    {formatMoney(detail.declaredValue, detail.currency || "USD")}
                  </Field>
                  <Field label="Arrival condition">
                    {CONDITION_LABEL[detail.condition] || detail.condition || "—"}
                  </Field>
                  {detail.description && (
                    <Field label="Description">
                      <p className="whitespace-pre-line text-muted-foreground">{detail.description}</p>
                    </Field>
                  )}
                  {detail.hazardousReview && (
                    <Field label="Hazardous review">
                      <Badge className="bg-red-100 text-red-700">Yes — review required</Badge>
                    </Field>
                  )}
                  {detail.specialHandling && <Field label="Special handling">{detail.specialHandling}</Field>}
                  {detail.notes && (
                    <Field label="Notes">
                      <p className="whitespace-pre-line text-muted-foreground">{detail.notes}</p>
                    </Field>
                  )}
                  <Field label="Received">
                    {detail.receivedAt ? fmtDateTime(detail.receivedAt) : fmtDateTime(detail.createdAt)}
                  </Field>
                  <Field label="Storage free until">
                    {detail.storageFreeUntil ? fmtDate(detail.storageFreeUntil) : "—"}
                  </Field>
                </div>
              </div>

              {/* --------------------------- measurements --------------------------- */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <SectionTitle icon={Ruler}>Measurements</SectionTitle>
                <div className="grid gap-x-6 gap-y-2 sm:grid-cols-5">
                  <Field label="Weight (kg)">{fmtKg(detail.weight)}</Field>
                  <Field label="Length (cm)">{detail.length ?? "—"}</Field>
                  <Field label="Width (cm)">{detail.width ?? "—"}</Field>
                  <Field label="Height (cm)">{detail.height ?? "—"}</Field>
                  <Field label="Chargeable (kg)">
                    {detail.chargeableWeight != null
                      ? fmtKg(detail.chargeableWeight)
                      : detail.volumetricWeight != null
                        ? fmtKg(detail.volumetricWeight)
                        : "—"}
                  </Field>
                </div>

                <form onSubmit={submitMeasure} className="mt-3 space-y-3 rounded-lg border border-border/70 bg-muted/30 p-3">
                  <p className="text-xs font-semibold text-muted-foreground">
                    Correct measurements <span className="font-normal">(changes are audited server-side)</span>
                  </p>
                  <div className="grid gap-3 sm:grid-cols-5">
                    <div className="space-y-1">
                      <Label className="text-xs">Weight (kg)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        className="h-9 text-sm"
                        value={measure.weight}
                        onChange={(e) => setMeasure((m) => ({ ...m, weight: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Length (cm)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        className="h-9 text-sm"
                        value={measure.length}
                        onChange={(e) => setMeasure((m) => ({ ...m, length: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Width (cm)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        className="h-9 text-sm"
                        value={measure.width}
                        onChange={(e) => setMeasure((m) => ({ ...m, width: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Height (cm)</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.1"
                        className="h-9 text-sm"
                        value={measure.height}
                        onChange={(e) => setMeasure((m) => ({ ...m, height: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Condition</Label>
                      <Select
                        value={measure.condition || undefined}
                        onValueChange={(v) => setMeasure((m) => ({ ...m, condition: v }))}
                      >
                        <SelectTrigger className="h-9 text-sm">
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
                  </div>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                    <div className="flex-1 space-y-1">
                      <Label className="text-xs">Reason (staff note, recommended)</Label>
                      <Input
                        className="h-9 text-sm"
                        placeholder="e.g. Re-weighed at dispatch — box was overweight"
                        value={measure.reason}
                        onChange={(e) => setMeasure((m) => ({ ...m, reason: e.target.value }))}
                        maxLength={300}
                      />
                    </div>
                    <Button
                      type="submit"
                      variant="outline"
                      size="sm"
                      disabled={busy === "measure"}
                      className="shrink-0"
                    >
                      {busy === "measure" && <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                      Save corrections
                    </Button>
                  </div>
                </form>
              </div>

              {/* ----------------------------- assignment ----------------------------- */}
              {!detail.customerEmail && (
                <div className="space-y-2 border-t border-border/60 pt-4">
                  <SectionTitle icon={UserRound}>Assign to member</SectionTitle>
                  <form onSubmit={submitAssign} className="space-y-3 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                    <p className="text-xs text-amber-800">
                      This package is unassigned — link it to a member so they see it in their dashboard.
                    </p>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="space-y-1">
                        <Label className="text-xs">Mailbox / member code</Label>
                        <Input
                          className="h-9 font-mono text-sm"
                          placeholder="e.g. SP-42084"
                          value={assign.memberCode}
                          onChange={(e) => setAssign((a) => ({ ...a, memberCode: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">…or member email</Label>
                        <Input
                          type="email"
                          className="h-9 text-sm"
                          placeholder="member@example.com"
                          value={assign.email}
                          onChange={(e) => setAssign((a) => ({ ...a, email: e.target.value }))}
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs text-muted-foreground">Fill one — the code takes priority when both are set.</p>
                      <Button type="submit" size="sm" disabled={busy === "assign"} className="shrink-0">
                        {busy === "assign" ? (
                          <>
                            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Assigning…
                          </>
                        ) : (
                          "Assign to member"
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              )}

              {/* ---------------------------- status change ---------------------------- */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <SectionTitle icon={ArrowRightLeft}>Change status</SectionTitle>
                {transitions.length === 0 ? (
                  <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                    No further transitions allowed from “{STATUS_LABEL[detail.status] || detail.status}”.
                  </p>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-muted-foreground">
                      Allowed next statuses from “{STATUS_LABEL[detail.status] || detail.status}” (the backend state
                      machine decides — 409 messages appear verbatim).
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {transitions.map((to) => (
                        <Button
                          key={to}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={busy !== null}
                          onClick={() => changeStatus(to)}
                          className={
                            busy === "status:" + to
                              ? "border-primary text-primary"
                              : undefined
                          }
                        >
                          {busy === "status:" + to && <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                          Move to {STATUS_LABEL[to] || to}
                        </Button>
                      ))}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs">Reason (optional, recorded in the audit log)</Label>
                        <Input
                          className="h-9 text-sm"
                          placeholder="e.g. Customer approved charges"
                          value={statusReason}
                          onChange={(e) => setStatusReason(e.target.value)}
                          maxLength={300}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ------------------------------- photos ------------------------------- */}
              <div className="space-y-2 border-t border-border/60 pt-4">
                <SectionTitle icon={Camera}>
                  Photos <span className="font-normal normal-case">({photos.length})</span>
                </SectionTitle>

                <div className="space-y-3 rounded-lg border border-dashed border-border bg-muted/20 p-3">
                  <p className="text-xs text-muted-foreground">
                    Attach 1–6 photos of this package (JPEG, PNG, WEBP or GIF, ≤ 8 MB each) — one view tag per upload.
                  </p>
                  <div className="flex flex-wrap items-end gap-3">
                    <div className="min-w-[180px] flex-1 space-y-1">
                      <Label className="text-xs">View</Label>
                      <Select value={photoView} onValueChange={setPhotoView}>
                        <SelectTrigger className="h-9 text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {PHOTO_VIEWS.map((v) => (
                            <SelectItem key={v} value={v}>
                              {PHOTO_VIEW_LABEL[v]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-center gap-2">
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        className="hidden"
                        onChange={choosePhotos}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busy === "upload"}
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload className="mr-1.5 h-3.5 w-3.5" /> Choose photos
                      </Button>
                      <Button type="button" size="sm" disabled={busy === "upload" || photoFiles.length === 0} onClick={uploadPhotos}>
                        {busy === "upload" ? (
                          <>
                            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Uploading…
                          </>
                        ) : (
                          "Upload"
                        )}
                      </Button>
                    </div>
                  </div>
                  {photoFiles.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {photoFiles.length} file{photoFiles.length === 1 ? "" : "s"} ready as “{PHOTO_VIEW_LABEL[photoView]}”:
                    </p>
                  )}
                  <div className="flex flex-wrap gap-1.5">
                    {photoFiles.map((f) => (
                      <span
                        key={f.name + f.lastModified}
                        className="inline-flex max-w-full items-center gap-1 rounded-full bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground ring-1 ring-border"
                      >
                        <FileChip name={f.name} size={f.size} />
                      </span>
                    ))}
                  </div>
                </div>

                {photos.length > 0 ? (
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                    {photos.map((ph) => (
                      <figure key={ph.id} className="overflow-hidden rounded-lg border border-border/70 bg-muted/30">
                        <div className="aspect-square w-full bg-muted">
                          {photoUrls[ph.id] ? (
                            <img
                              src={photoUrls[ph.id]}
                              alt={`${PHOTO_VIEW_LABEL[ph.view] || ph.view} photo of ${detail.packageId}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              {photoUrls[ph.id] === null ? (
                                <span className="text-xs text-muted-foreground">Unavailable</span>
                              ) : (
                                <Skeleton className="h-full w-full" />
                              )}
                            </div>
                          )}
                        </div>
                        <figcaption className="space-y-0.5 px-2 py-1.5 text-[11px]">
                          <p className="font-semibold uppercase tracking-wide text-muted-foreground">
                            {PHOTO_VIEW_LABEL[ph.view] || ph.view}
                          </p>
                          <p className="truncate text-muted-foreground" title={ph.name}>
                            {ph.name} · {fmtBytes(ph.size)}
                          </p>
                          <p className="text-muted-foreground">{fmtDate(ph.uploadedAt)}</p>
                        </figcaption>
                      </figure>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No photos attached yet.</p>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}

/** Tiny helper so a selected file shows name · size in the chip list. */
function FileChip({ name, size }) {
  return (
    <span className="truncate">
      {name} · {fmtBytes(size)}
    </span>
  );
}
