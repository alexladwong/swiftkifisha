import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Globe2,
  FileSearch,
  Boxes,
  RefreshCw,
  CircleAlert,
  SearchX,
  LoaderCircle,
  Check,
  Flag,
  MessageSquareText,
  Ban,
  History,
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
import { formatMoney } from "@/lib/money";
import { fmtDate, fmtDateTime, fmtKg } from "@/lib/packageOps";

const DECL_STATUSES = ["SUBMITTED", "APPROVED", "FLAGGED", "MORE_INFO"];
const CONS_STATUSES = ["REQUESTED", "IN_PROGRESS", "COMPLETED", "CANCELLED"];

const DECL_STATUS_STYLE = {
  SUBMITTED: "bg-blue-100 text-blue-800",
  APPROVED: "bg-emerald-100 text-emerald-800",
  FLAGGED: "bg-rose-100 text-rose-800",
  MORE_INFO: "bg-amber-100 text-amber-800",
};

const CONS_STATUS_STYLE = {
  REQUESTED: "bg-blue-100 text-blue-800",
  IN_PROGRESS: "bg-amber-100 text-amber-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-red-100 text-red-700",
};

/** "MORE_INFO" → "More info" — human labels for chips, filters and buttons. */
const labelize = (s) =>
  String(s || "")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());

const num = (v) => {
  const n = parseFloat(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

const round2 = (n) => Math.round(n * 100) / 100;

/** Soft pastel pill for declaration / consolidation statuses. */
function StatusChip({ status, style }) {
  return (
    <span
      className={
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold " +
        (style || "bg-muted text-muted-foreground")
      }
    >
      {labelize(status)}
    </span>
  );
}

/** Pill for the declaration purpose (personal, gift, sale, documents, return). */
function PurposeChip({ purpose }) {
  if (!purpose) return null;
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
      {labelize(purpose)}
    </span>
  );
}

/** Pill for the repack-request flag on consolidations. */
function RepackChip() {
  return (
    <span className="inline-flex items-center whitespace-nowrap rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-800">
      Repack
    </span>
  );
}

/** Mono reference pills (SKW-…, SKD-…, SKC-…) with "+N more" overflow. */
function RefChips({ refs, max = 2 }) {
  const list = Array.isArray(refs) ? refs.filter(Boolean) : [];
  if (list.length === 0) return <span className="text-xs text-muted-foreground">No packages linked</span>;
  return (
    <span className="flex flex-wrap items-center gap-1">
      {list.slice(0, max).map((r) => (
        <span
          key={r}
          className="inline-flex items-center whitespace-nowrap rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground"
        >
          {r}
        </span>
      ))}
      {list.length > max && (
        <span className="text-xs text-muted-foreground">+{list.length - max} more</span>
      )}
    </span>
  );
}

/** Round filter chip used in the section toolbars. */
function FilterChip({ label, active, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "inline-flex items-center whitespace-nowrap rounded-full border px-3 py-1 text-xs font-semibold transition-colors " +
        (active
          ? "border-primary bg-primary text-primary-foreground"
          : "border-border bg-card text-muted-foreground hover:bg-muted")
      }
    >
      {label}
    </button>
  );
}

/** Uppercase section sub-heading with icon tile (mirrors the page pattern). */
function SectionTitle({ icon: Icon, children }) {
  return (
    <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
      {Icon && <Icon className="h-4 w-4" />} {children}
    </h3>
  );
}

/** Label + value field used inside dialogs. */
function Field({ label, children }) {
  return (
    <div className="min-w-0">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
      <div className="mt-0.5 text-sm">{children}</div>
    </div>
  );
}

/** Error block with retry, mirroring the other admin workstations. */
function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center gap-3 py-12 text-center">
      <CircleAlert className="h-10 w-10 text-destructive opacity-70" />
      <p className="text-sm text-destructive">{message}</p>
      <Button variant="outline" size="sm" onClick={onRetry}>
        <RefreshCw className="mr-1.5 h-4 w-4" /> Retry
      </Button>
    </div>
  );
}

/** Empty state block with a filter-aware hint. */
function EmptyState({ icon: Icon, title, hint }) {
  return (
    <div className="flex flex-col items-center gap-3 py-14 text-center text-muted-foreground">
      <Icon className="h-10 w-10 opacity-40" />
      <p className="font-medium text-foreground">{title}</p>
      {hint && <p className="text-sm">{hint}</p>}
    </div>
  );
}

/**
 * International — admin workstation for Phase-3 cross-border workflows.
 *
 * Section A: customs declarations (SKD-*) — review queue with itemized view;
 * approve / flag / request-more-info writes go through the audit log and email
 * the member. Section B: consolidation requests (SKC-*) — accept, complete
 * with recorded combined measurements, or cancel. Status machines live on the
 * backend, so its 409/400 messages are shown verbatim.
 */
export default function International() {
  /* ------------------------------ filters ------------------------------ */
  const [declStatus, setDeclStatus] = useState("all");
  const [flaggedOnly, setFlaggedOnly] = useState(false);
  const [consStatus, setConsStatus] = useState("all");

  /* ------------------------------- lists ------------------------------- */
  const [decls, setDecls] = useState([]);
  const [loadingDecls, setLoadingDecls] = useState(true);
  const [declError, setDeclError] = useState("");
  const [cons, setCons] = useState([]);
  const [loadingCons, setLoadingCons] = useState(true);
  const [consError, setConsError] = useState("");
  const [audit, setAudit] = useState([]);
  const [auditLoading, setAuditLoading] = useState(true);

  /* ------------------- declaration detail / review -------------------- */
  const [detail, setDetail] = useState(null);
  const [reviewAction, setReviewAction] = useState(null); // approve | flag | more_info
  const [reviewReason, setReviewReason] = useState("");
  const [reviewError, setReviewError] = useState("");
  const [reviewBusy, setReviewBusy] = useState(false);

  /* ------------------------ consolidation actions --------------------- */
  const [acceptingId, setAcceptingId] = useState(null);
  const [completing, setCompleting] = useState(null);
  const [completeForm, setCompleteForm] = useState({ weight: "", length: "", width: "", height: "", note: "" });
  const [completeError, setCompleteError] = useState("");
  const [completeBusy, setCompleteBusy] = useState(false);
  const [cancelling, setCancelling] = useState(null);
  const [cancelNote, setCancelNote] = useState("");
  const [cancelBusy, setCancelBusy] = useState(false);

  /* ------------------------------- loads ------------------------------ */
  const loadDecls = useCallback(async () => {
    setLoadingDecls(true);
    setDeclError("");
    try {
      const params = {};
      if (declStatus !== "all") params.status = declStatus;
      if (flaggedOnly) params.flagged = "true";
      const { data } = await axiosInstance.get("/admin/customs", { params });
      setDecls(data.declarations || []);
    } catch (err) {
      setDeclError(err?.response?.data?.message || "Failed to load customs declarations.");
    } finally {
      setLoadingDecls(false);
    }
  }, [declStatus, flaggedOnly]);

  const loadCons = useCallback(async () => {
    setLoadingCons(true);
    setConsError("");
    try {
      const params = {};
      if (consStatus !== "all") params.status = consStatus;
      const { data } = await axiosInstance.get("/admin/consolidations", { params });
      setCons(data.consolidations || []);
    } catch (err) {
      setConsError(err?.response?.data?.message || "Failed to load consolidation requests.");
    } finally {
      setLoadingCons(false);
    }
  }, [consStatus]);

  const loadAudit = useCallback(async () => {
    setAuditLoading(true);
    try {
      const { data } = await axiosInstance.get("/admin/audit", { params: { limit: 100 } });
      // Client-side slice of the feed: keep only international actions.
      const rows = (data.audit || []).filter(
        (a) => (a.action || "").startsWith("CUSTOMS") || (a.action || "").startsWith("CONSOLIDATION"),
      );
      setAudit(rows.slice(0, 6));
    } catch {
      setAudit([]);
    } finally {
      setAuditLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDecls();
  }, [loadDecls]);

  useEffect(() => {
    loadCons();
  }, [loadCons]);

  useEffect(() => {
    loadAudit();
  }, [loadAudit]);

  const refreshAll = () => {
    loadDecls();
    loadCons();
    loadAudit();
  };

  /* ------------------------- declaration review ------------------------ */
  const openDeclaration = (d) => {
    setDetail(d);
    setReviewAction(null);
    setReviewReason("");
    setReviewError("");
  };

  const pickReview = (action) => {
    setReviewAction(action);
    setReviewReason(action === "approve" ? "Review complete" : "");
    setReviewError("");
  };

  const submitReview = async (e) => {
    e.preventDefault();
    if (!detail || !reviewAction) return;
    const reason = reviewReason.trim();
    if (reviewAction !== "approve" && !reason) {
      setReviewError(
        reviewAction === "flag"
          ? "A reason is required when flagging a declaration."
          : "A reason is required when requesting more information.",
      );
      return;
    }
    setReviewBusy(true);
    setReviewError("");
    try {
      const { data } = await axiosInstance.post(`/admin/customs/${detail._id}/review`, {
        action: reviewAction,
        reason,
      });
      toast.success(data?.message || "Declaration reviewed.");
      setDetail(null);
      loadDecls();
      loadAudit();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Review failed.");
    } finally {
      setReviewBusy(false);
    }
  };

  /* ------------------------- consolidation actions --------------------- */
  const acceptConsolidation = async (c) => {
    setAcceptingId(c._id);
    try {
      const { data } = await axiosInstance.post(`/admin/consolidations/${c._id}/status`, { action: "accept" });
      toast.success(data?.message || "Consolidation accepted.");
      loadCons();
      loadAudit();
    } catch (err) {
      // 409 state-machine rejections surface verbatim.
      toast.error(err?.response?.data?.message || "Accept failed.");
    } finally {
      setAcceptingId(null);
    }
  };

  const openComplete = (c) => {
    setCompleting(c);
    setCompleteForm({ weight: "", length: "", width: "", height: "", note: "" });
    setCompleteError("");
  };

  const submitComplete = async (e) => {
    e.preventDefault();
    if (!completing) return;
    setCompleteError("");
    if (!(num(completeForm.weight) > 0)) {
      setCompleteError("Weight is required — enter the combined weight of the consolidated packages in kg.");
      return;
    }
    const body = { action: "complete" };
    for (const k of ["weight", "length", "width", "height"]) {
      if (completeForm[k].trim() !== "") body[k] = Number(completeForm[k]);
    }
    if (completeForm.note.trim()) body.note = completeForm.note.trim();
    setCompleteBusy(true);
    try {
      const { data } = await axiosInstance.post(`/admin/consolidations/${completing._id}/status`, body);
      toast.success(data?.message || "Consolidation completed.");
      setCompleting(null);
      loadCons();
      loadAudit();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not complete the consolidation.");
    } finally {
      setCompleteBusy(false);
    }
  };

  const openCancel = (c) => {
    setCancelling(c);
    setCancelNote("");
  };

  const submitCancel = async () => {
    if (!cancelling) return;
    setCancelBusy(true);
    try {
      const { data } = await axiosInstance.post(`/admin/consolidations/${cancelling._id}/status`, {
        action: "cancel",
        note: cancelNote.trim() || undefined,
      });
      toast.success(data?.message || "Consolidation cancelled.");
      setCancelling(null);
      loadCons();
      loadAudit();
    } catch (err) {
      toast.error(err?.response?.data?.message || "Could not cancel the consolidation.");
    } finally {
      setCancelBusy(false);
    }
  };

  /* ------------------ client-side volumetric / chargeable ------------- */
  // Preview only — the server recomputes and stores the authoritative result.
  const cWeight = num(completeForm.weight);
  const cVolumetric =
    num(completeForm.length) && num(completeForm.width) && num(completeForm.height)
      ? round2((num(completeForm.length) * num(completeForm.width) * num(completeForm.height)) / 5000)
      : 0;
  const cChargeable = round2(Math.max(cWeight, cVolumetric));
  const showCompletePreview =
    completeForm.weight.trim() !== "" ||
    completeForm.length.trim() !== "" ||
    completeForm.width.trim() !== "" ||
    completeForm.height.trim() !== "";

  /* ------------------------ per-row derived data ----------------------- */
  const declTotal = detail
    ? round2(
        (detail.items || []).reduce((s, it) => s + Number(it.quantity) * Number(it.unitValue), 0),
      )
    : 0;

  const declNoteBoxClass =
    detail?.status === "FLAGGED"
      ? "border-rose-200 bg-rose-50/70 text-rose-900"
      : detail?.status === "MORE_INFO"
        ? "border-amber-200 bg-amber-50/70 text-amber-900"
        : "border-emerald-200 bg-emerald-50/70 text-emerald-900";

  return (
    <div className="space-y-6">
      {/* ------------------------------ page header ------------------------------ */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Globe2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">International</h1>
            <p className="text-sm text-muted-foreground">
              Cross-border workflows: review customs declarations (SKD-*) and run the warehouse consolidation queue
              (SKC-*). Every decision is audited and emailed to the member.
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={refreshAll} disabled={loadingDecls || loadingCons}>
          <RefreshCw className={"mr-1.5 h-4 w-4 " + (loadingDecls || loadingCons ? "animate-spin" : "")} />
          Refresh
        </Button>
      </header>

      {/* ------------------------- customs declarations ------------------------- */}
      <Card className="overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <FileSearch className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Customs declarations</h2>
                <p className="text-xs text-muted-foreground">
                  Members declare shipments leaving the warehouse — review the itemized value before dispatch.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip label="All" active={declStatus === "all" && !flaggedOnly} onClick={() => { setDeclStatus("all"); setFlaggedOnly(false); }} />
              {DECL_STATUSES.map((s) => (
                <FilterChip
                  key={s}
                  label={labelize(s)}
                  active={declStatus === s && !flaggedOnly}
                  onClick={() => { setDeclStatus(s); setFlaggedOnly(false); }}
                />
              ))}
              <span className="mx-1 hidden h-4 w-px bg-border sm:block" />
              <FilterChip
                label="Flagged only"
                active={flaggedOnly}
                onClick={() => setFlaggedOnly((f) => !f)}
              />
            </div>
          </div>

          <div className="px-5 py-4">
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                {loadingDecls && decls.length === 0 ? "…" : `${decls.length} declaration${decls.length === 1 ? "" : "s"}`}
              </p>
              <p className="hidden text-xs text-muted-foreground sm:block">Click a declaration to review it</p>
            </div>

            {declError ? (
              <ErrorState message={declError} onRetry={loadDecls} />
            ) : loadingDecls && decls.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : decls.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No declarations match"
                hint={declStatus !== "all" || flaggedOnly ? "Try clearing the filters above." : "Submitted declarations will appear here for review."}
              />
            ) : (
              <div className="space-y-2">
                {decls.map((d) => (
                  <div
                    key={d._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => openDeclaration(d)}
                    onKeyDown={(e) => e.key === "Enter" && openDeclaration(d)}
                    className={
                      "cursor-pointer rounded-xl border px-4 py-3 transition-colors " +
                      (d.flagged
                        ? "border-rose-200 bg-rose-50/50 hover:border-rose-300"
                        : "border-border/70 bg-card hover:border-primary/40")
                    }
                  >
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-mono text-sm font-semibold">{d.declarationId}</span>
                      <StatusChip status={d.status} style={DECL_STATUS_STYLE[d.status]} />
                      <PurposeChip purpose={d.purpose} />
                      <span className="text-sm font-semibold">{formatMoney(d.totalValue, d.currency)}</span>
                      <span className="ml-auto text-xs text-muted-foreground">{fmtDate(d.createdAt)}</span>
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                      <span className="min-w-0 max-w-full truncate">{d.customerEmail || "—"}</span>
                      <RefChips refs={d.packageRefs} />
                    </div>
                    {d.reviewNote && (
                      <p
                        className={
                          "mt-2 rounded-lg px-2.5 py-1.5 text-xs " +
                          (d.flagged
                            ? "bg-rose-100/70 text-rose-900"
                            : d.status === "MORE_INFO"
                              ? "bg-amber-100/70 text-amber-900"
                              : "bg-muted text-muted-foreground")
                        }
                      >
                        Review note: {d.reviewNote}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ---------------------- consolidation requests ---------------------- */}
      <Card className="overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b border-border/60 px-5 py-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                <Boxes className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h2 className="text-base font-bold tracking-tight">Consolidation requests</h2>
                <p className="text-xs text-muted-foreground">
                  Members combine 2+ packages into one shipment — accept, then complete with the combined measurements.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <FilterChip label="All" active={consStatus === "all"} onClick={() => setConsStatus("all")} />
              {CONS_STATUSES.map((s) => (
                <FilterChip key={s} label={labelize(s)} active={consStatus === s} onClick={() => setConsStatus(s)} />
              ))}
            </div>
          </div>

          <div className="px-5 py-4">
            <p className="mb-3 text-xs text-muted-foreground">
              {loadingCons && cons.length === 0 ? "…" : `${cons.length} request${cons.length === 1 ? "" : "s"}`}
            </p>

            {consError ? (
              <ErrorState message={consError} onRetry={loadCons} />
            ) : loadingCons && cons.length === 0 ? (
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 w-full rounded-xl" />
                ))}
              </div>
            ) : cons.length === 0 ? (
              <EmptyState
                icon={SearchX}
                title="No consolidation requests match"
                hint={consStatus !== "all" ? "Try clearing the filters above." : "Member requests will appear here once members combine packages."}
              />
            ) : (
              <div className="space-y-2">
                {cons.map((c) => {
                  const refs = Array.isArray(c.packageRefs) ? c.packageRefs.filter(Boolean) : [];
                  const result = c.result;
                  return (
                    <div
                      key={c._id}
                      className="rounded-xl border border-border/70 bg-card px-4 py-3"
                    >
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <span className="font-mono text-sm font-semibold">{c.consolidationId}</span>
                        <StatusChip status={c.status} style={CONS_STATUS_STYLE[c.status]} />
                        {c.repack && <RepackChip />}
                        <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground">
                          {c.customerEmail || "—"}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {fmtDate(c.requestedAt || c.createdAt)}
                        </span>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          {refs.length} package{refs.length === 1 ? "" : "s"}
                        </span>
                        <RefChips refs={refs} />
                      </div>

                      {c.status === "COMPLETED" && result && (
                        <div className="mt-2 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                          <div className="flex flex-wrap gap-x-5 gap-y-1">
                            <span>
                              Weight <span className="font-semibold text-foreground">{fmtKg(result.weight)}</span>
                            </span>
                            <span>
                              Size{" "}
                              <span className="font-semibold text-foreground">
                                {result.length}×{result.width}×{result.height} cm
                              </span>
                            </span>
                            <span>
                              Volumetric <span className="font-semibold text-foreground">{fmtKg(result.volumetricWeight)}</span>
                            </span>
                            <span>
                              Chargeable <span className="font-semibold text-foreground">{fmtKg(result.chargeableWeight)}</span>
                            </span>
                            {result.note && (
                              <span className="w-full">Note: {result.note}</span>
                            )}
                          </div>
                          <p className="mt-1 text-[11px]">
                            Completed {c.completedAt ? fmtDateTime(c.completedAt) : "—"} — measurements are read-only
                            here (source of truth is the completed record).
                          </p>
                        </div>
                      )}

                      {(c.status === "CANCELLED" || c.status === "REQUESTED" || c.status === "IN_PROGRESS") && c.note && (
                        <p className="mt-2 rounded-lg bg-muted px-2.5 py-1.5 text-xs text-muted-foreground">
                          Note: {c.note}
                        </p>
                      )}

                      {(c.status === "REQUESTED" || c.status === "IN_PROGRESS") && (
                        <div className="mt-2.5 flex flex-wrap items-center justify-end gap-2">
                          {c.status === "REQUESTED" && (
                            <Button
                              size="sm"
                              className="bg-emerald-600 text-white hover:bg-emerald-700"
                              disabled={acceptingId === c._id}
                              onClick={() => acceptConsolidation(c)}
                            >
                              {acceptingId === c._id ? (
                                <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                              )}
                              Accept
                            </Button>
                          )}
                          {c.status === "IN_PROGRESS" && (
                            <Button size="sm" disabled={acceptingId === c._id} onClick={() => openComplete(c)}>
                              Complete
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-destructive/30 text-destructive hover:bg-destructive/10"
                            disabled={acceptingId === c._id}
                            onClick={() => openCancel(c)}
                          >
                            <Ban className="mr-1.5 h-3.5 w-3.5" />
                            Cancel
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* --------------------- audit feed footer (small) --------------------- */}
      <Card className="overflow-hidden rounded-xl">
        <CardContent className="p-0">
          <div className="flex items-center gap-2 border-b border-border/60 px-5 py-3">
            <History className="h-4 w-4 text-muted-foreground" />
            <p className="text-sm font-semibold">Recent international activity</p>
            <span className="text-xs text-muted-foreground">(from the audit log)</span>
          </div>
          <div className="px-5 py-3">
            {auditLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-5 w-full" />
                ))}
              </div>
            ) : audit.length === 0 ? (
              <p className="py-2 text-sm text-muted-foreground">No customs or consolidation activity recorded yet.</p>
            ) : (
              <ul className="divide-y divide-border/60">
                {audit.map((a, i) => (
                  <li key={a._id || i} className="flex flex-wrap items-center gap-x-3 gap-y-0.5 py-1.5 text-xs">
                    <span className="font-mono font-semibold text-foreground">{a.action}</span>
                    <span className="min-w-0 truncate text-muted-foreground">by {a.actorEmail}</span>
                    <span className="ml-auto whitespace-nowrap text-muted-foreground">{fmtDateTime(a.createdAt)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </CardContent>
      </Card>

      {/* -------------------- declaration review dialog -------------------- */}
      <Dialog open={detail !== null} onOpenChange={(open) => !open && setDetail(null)}>
        {detail && (
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex flex-wrap items-center gap-2">
                <span className="font-mono">{detail.declarationId}</span>
                <StatusChip status={detail.status} style={DECL_STATUS_STYLE[detail.status]} />
              </DialogTitle>
              <DialogDescription>
                {detail.customerEmail || "unknown member"} · {labelize(detail.purpose)} · declared{" "}
                {fmtDate(detail.createdAt)}
              </DialogDescription>
            </DialogHeader>

            <div className="-mr-3 max-h-[65vh] space-y-5 overflow-y-auto pr-3">
              {/* ------------------------------ overview ------------------------------ */}
              <div className="space-y-2">
                <SectionTitle icon={FileSearch}>Overview</SectionTitle>
                <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label="Member">
                    <span className="break-all">{detail.customerEmail || "—"}</span>
                  </Field>
                  <Field label="Purpose">
                    <PurposeChip purpose={detail.purpose} />
                  </Field>
                  <Field label="Declared value">
                    <span className="font-semibold">{formatMoney(detail.totalValue, detail.currency)}</span>
                  </Field>
                  <Field label="Packages">
                    <RefChips refs={detail.packageRefs} max={4} />
                  </Field>
                  <Field label="Created">{fmtDateTime(detail.createdAt)}</Field>
                  <Field label="Reviewed by">{detail.reviewedBy || "—"}</Field>
                </div>
              </div>

              {/* ------------------------------ items table ------------------------------ */}
              <div className="space-y-2">
                <SectionTitle icon={Boxes}>
                  Items <span className="font-normal normal-case">({(detail.items || []).length})</span>
                </SectionTitle>
                {detail.items && detail.items.length > 0 ? (
                  <div className="overflow-x-auto rounded-xl border border-border/70">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Description</TableHead>
                          <TableHead className="text-right">Qty</TableHead>
                          <TableHead className="text-right">Unit value</TableHead>
                          <TableHead className="text-right">Amount</TableHead>
                          <TableHead>Country of origin</TableHead>
                          <TableHead>HS code</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.items.map((it, i) => (
                          <TableRow key={i}>
                            <TableCell className="max-w-[220px]">
                              <span className="block truncate" title={it.description}>
                                {it.description}
                              </span>
                            </TableCell>
                            <TableCell className="text-right font-mono text-xs">{it.quantity}</TableCell>
                            <TableCell className="text-right text-xs">
                              {formatMoney(it.unitValue, detail.currency)}
                            </TableCell>
                            <TableCell className="text-right text-xs font-semibold">
                              {formatMoney(round2(Number(it.quantity) * Number(it.unitValue)), detail.currency)}
                            </TableCell>
                            <TableCell className="text-xs">{it.countryOfOrigin || "—"}</TableCell>
                            <TableCell className="font-mono text-xs">{it.hsCode || "—"}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <p className="rounded-lg bg-muted/50 px-3 py-2.5 text-sm text-muted-foreground">
                    This declaration has no item lines.
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-end gap-x-6 gap-y-1 text-sm">
                  <span className="text-muted-foreground">
                    Items total ({detail.currency}){" "}
                    <span className="font-semibold text-foreground">{formatMoney(declTotal, detail.currency)}</span>
                  </span>
                  <span>
                    Declared total{" "}
                    <span className="font-semibold">{formatMoney(detail.totalValue, detail.currency)}</span>
                  </span>
                </div>
              </div>

              {/* ------------------------------ review ------------------------------ */}
              <div className="space-y-3 border-t border-border/60 pt-4">
                <SectionTitle icon={Flag}>Review decision</SectionTitle>
                {detail.reviewNote && (
                  <p className={"rounded-lg border px-3 py-2 text-xs " + declNoteBoxClass}>
                    Current note from the last review: {detail.reviewNote}
                  </p>
                )}
                <p className="text-xs text-muted-foreground">
                  Approving clears the declaration for dispatch; flagging blocks it for investigation; requesting more
                  info sends the member a question. The note is recorded in the audit log and emailed.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant={reviewAction === "approve" ? "default" : "outline"}
                    className={
                      reviewAction === "approve"
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "border-emerald-300 text-emerald-700 hover:bg-emerald-50"
                    }
                    onClick={() => pickReview("approve")}
                  >
                    <Check className="mr-1.5 h-3.5 w-3.5" /> Approve
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={reviewAction === "flag" ? "default" : "outline"}
                    className={
                      reviewAction === "flag"
                        ? "bg-rose-600 text-white hover:bg-rose-700"
                        : "border-rose-300 text-rose-700 hover:bg-rose-50"
                    }
                    onClick={() => pickReview("flag")}
                  >
                    <Flag className="mr-1.5 h-3.5 w-3.5" /> Flag
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={reviewAction === "more_info" ? "default" : "outline"}
                    className={
                      reviewAction === "more_info"
                        ? "bg-amber-500 text-white hover:bg-amber-600"
                        : "border-amber-300 text-amber-700 hover:bg-amber-50"
                    }
                    onClick={() => pickReview("more_info")}
                  >
                    <MessageSquareText className="mr-1.5 h-3.5 w-3.5" /> Request more info
                  </Button>
                </div>

                {reviewAction && (
                  <form onSubmit={submitReview} className="space-y-2 rounded-lg border border-border/70 bg-muted/30 p-3">
                    <div className="space-y-1">
                      <Label className="text-xs" htmlFor="review-reason">
                        Reason{reviewAction === "approve" ? " (optional)" : " *"}
                      </Label>
                      <Textarea
                        id="review-reason"
                        rows={2}
                        maxLength={500}
                        placeholder={
                          reviewAction === "approve"
                            ? "Review complete"
                            : reviewAction === "flag"
                              ? "e.g. Value looks understated — merchant invoice needed"
                              : "e.g. Please send the exact item list with quantities"
                        }
                        value={reviewReason}
                        onChange={(e) => setReviewReason(e.target.value)}
                      />
                    </div>
                    {reviewError && <p className="text-xs text-destructive">{reviewError}</p>}
                    <div className="flex items-center justify-end gap-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => setReviewAction(null)}
                        disabled={reviewBusy}
                      >
                        Discard
                      </Button>
                      <Button type="submit" size="sm" disabled={reviewBusy}>
                        {reviewBusy ? (
                          <>
                            <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Submitting…
                          </>
                        ) : reviewAction === "approve" ? (
                          <>
                            <Check className="mr-1.5 h-3.5 w-3.5" /> Approve declaration
                          </>
                        ) : reviewAction === "flag" ? (
                          <>
                            <Flag className="mr-1.5 h-3.5 w-3.5" /> Flag declaration
                          </>
                        ) : (
                          <>
                            <MessageSquareText className="mr-1.5 h-3.5 w-3.5" /> Request more info
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </DialogContent>
        )}
      </Dialog>

      {/* ------------------- complete-consolidation dialog ------------------- */}
      <Dialog open={completing !== null} onOpenChange={(open) => !open && setCompleting(null)}>
        {completing && (
          <DialogContent className="max-w-xl">
            <DialogHeader>
              <DialogTitle className="font-mono">{completing.consolidationId}</DialogTitle>
              <DialogDescription>
                Record the combined measurements of the consolidated packages
                {completing.customerEmail ? ` for ${completing.customerEmail}` : ""}. Weight is required; dimensions
                optional but recommended.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={submitComplete} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-4">
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cc-weight">
                    Weight (kg) *
                  </Label>
                  <Input
                    id="cc-weight"
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9 text-sm"
                    value={completeForm.weight}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, weight: e.target.value }))}
                    autoFocus
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cc-length">
                    Length (cm)
                  </Label>
                  <Input
                    id="cc-length"
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-9 text-sm"
                    value={completeForm.length}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, length: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cc-width">
                    Width (cm)
                  </Label>
                  <Input
                    id="cc-width"
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-9 text-sm"
                    value={completeForm.width}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, width: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs" htmlFor="cc-height">
                    Height (cm)
                  </Label>
                  <Input
                    id="cc-height"
                    type="number"
                    min="0"
                    step="0.1"
                    className="h-9 text-sm"
                    value={completeForm.height}
                    onChange={(e) => setCompleteForm((f) => ({ ...f, height: e.target.value }))}
                  />
                </div>
              </div>

              {showCompletePreview && (
                <p className="rounded-lg bg-muted/70 px-3 py-2 text-xs text-muted-foreground">
                  Volumetric ≈ <span className="font-semibold text-foreground">{cVolumetric.toFixed(2)} kg</span>{" "}
                  (L×W×H ÷ 5000) · Chargeable ≈{" "}
                  <span className="font-semibold text-foreground">{cChargeable.toFixed(2)} kg</span> — preview only,
                  the server stores the authoritative result.
                </p>
              )}

              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cc-note">
                  Note <span className="font-normal text-muted-foreground">(optional, audited)</span>
                </Label>
                <Textarea
                  id="cc-note"
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. All items repacked into one master carton"
                  value={completeForm.note}
                  onChange={(e) => setCompleteForm((f) => ({ ...f, note: e.target.value }))}
                />
              </div>

              {completeError && <p className="text-xs text-destructive">{completeError}</p>}

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={completeBusy}
                  onClick={() => setCompleting(null)}
                >
                  Close
                </Button>
                <Button type="submit" size="sm" disabled={completeBusy}>
                  {completeBusy ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Completing…
                    </>
                  ) : (
                    <>
                      <Boxes className="mr-1.5 h-3.5 w-3.5" /> Complete consolidation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        )}
      </Dialog>

      {/* ------------------------ cancel-consolidation dialog ------------------------ */}
      <Dialog open={cancelling !== null} onOpenChange={(open) => !open && setCancelling(null)}>
        {cancelling && (
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Cancel {cancelling.consolidationId}?</DialogTitle>
              <DialogDescription>
                The member's packages return to their previous warehouse statuses, and the cancellation is recorded in
                the audit log.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
                <span className="min-w-0 flex-1 truncate">{cancelling.customerEmail || "—"}</span>
                <span>
                  {(cancelling.packageRefs || []).filter(Boolean).length} package
                  {(cancelling.packageRefs || []).filter(Boolean).length === 1 ? "" : "s"}
                </span>
                <StatusChip status={cancelling.status} style={CONS_STATUS_STYLE[cancelling.status]} />
              </div>
              <div className="space-y-1">
                <Label className="text-xs" htmlFor="cancel-note">
                  Reason <span className="font-normal text-muted-foreground">(optional, recorded in the audit log)</span>
                </Label>
                <Textarea
                  id="cancel-note"
                  rows={2}
                  maxLength={1000}
                  placeholder="e.g. Member changed their mind — will re-request"
                  value={cancelNote}
                  onChange={(e) => setCancelNote(e.target.value)}
                />
              </div>
              <DialogFooter>
                <Button variant="outline" size="sm" disabled={cancelBusy} onClick={() => setCancelling(null)}>
                  Keep request
                </Button>
                <Button
                  size="sm"
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={cancelBusy}
                  onClick={submitCancel}
                >
                  {cancelBusy ? (
                    <>
                      <LoaderCircle className="mr-1.5 h-3.5 w-3.5 animate-spin" /> Cancelling…
                    </>
                  ) : (
                    <>
                      <Ban className="mr-1.5 h-3.5 w-3.5" /> Cancel consolidation
                    </>
                  )}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
