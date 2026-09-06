import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";
import {
  ArrowLeft, ArrowRight, RefreshCw, Loader2, Camera, Store, Ruler, TriangleAlert, CalendarDays, ChevronRight,
  Ship, Combine, Boxes, CirclePause, Undo2, Trash2, PackageSearch, PackageX, ImageOff, Info, FileText, Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  fetchPackage, fetchMailboxes, requestPackageAction, createShippingQuote, fetchPhotoUrl,
} from "@/lib/portalApi";

/* Status chip palette — soft background + readable text. */
const STATUS_STYLE = {
  PRE_ALERTED: "bg-sky-100 text-sky-700",
  EXPECTED: "bg-cyan-100 text-cyan-700",
  RECEIVED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  ACTION_REQUIRED: "bg-rose-100 text-rose-700",
  READY_TO_SHIP: "bg-emerald-100 text-emerald-700",
  CONSOLIDATION_PENDING: "bg-fuchsia-100 text-fuchsia-700",
  CONSOLIDATED: "bg-teal-100 text-teal-700",
  REPACKING: "bg-purple-100 text-purple-700",
  READY_FOR_PAYMENT: "bg-amber-100 text-amber-800",
  SHIPMENT_CREATED: "bg-lime-100 text-lime-700",
  DISPATCHED: "bg-green-100 text-green-700",
  RETURN_REQUESTED: "bg-violet-100 text-violet-700",
  HOLD: "bg-orange-100 text-orange-700",
  EXCEPTION: "bg-red-100 text-red-700",
  RETURNED: "bg-slate-100 text-slate-600",
  DISPOSED: "bg-slate-100 text-slate-600",
};

const STATUS_TEXT = {
  PRE_ALERTED: "Pre-alerted",
  EXPECTED: "Expected",
  RECEIVED: "Received",
  PROCESSING: "Processing",
  ACTION_REQUIRED: "Action required",
  READY_TO_SHIP: "Ready to ship",
  CONSOLIDATION_PENDING: "Consolidation pending",
  CONSOLIDATED: "Consolidated",
  REPACKING: "Repacking",
  READY_FOR_PAYMENT: "Ready for payment",
  SHIPMENT_CREATED: "Shipment created",
  DISPATCHED: "Dispatched",
  RETURN_REQUESTED: "Return requested",
  HOLD: "On hold",
  EXCEPTION: "Exception",
  RETURNED: "Returned",
  DISPOSED: "Disposed",
};

const statusLabel = (status) => STATUS_TEXT[status] || String(status || "Unknown").replace(/_/g, " ");

const ACTION_META = {
  ship: { label: "Request shipping", icon: Ship },
  consolidate: { label: "Consolidate with other packages", icon: Combine },
  repack: { label: "Repack", icon: Boxes },
  hold: { label: "Hold at warehouse", icon: CirclePause },
  returnToSender: { label: "Return to sender", icon: Undo2 },
  dispose: { label: "Request disposal", icon: Trash2 },
  requestPhotos: { label: "Request more photos", icon: Camera },
  reportProblem: { label: "Report a problem", icon: TriangleAlert },
};

const ACTION_HINT = {
  ship: "Anything about this shipment our team should know?",
  consolidate: "Which other packages should travel with this one?",
  repack: "e.g. remove shoe boxes or packaging to save space",
  hold: "How long should we hold it at the warehouse?",
  returnToSender: "Let us know why, so the return label fits.",
  dispose: "Reason for the disposal request",
  requestPhotos: "e.g. close-up of the label, or a damage check",
  reportProblem: "Describe the problem — damaged box, wrong item, etc.",
};

/* Past-tense wording for the status timeline. */
const ACTION_EVENT = {
  ship: "Shipping requested",
  consolidate: "Consolidation requested",
  repack: "Repack requested",
  hold: "Hold at warehouse requested",
  returnToSender: "Return to sender requested",
  dispose: "Disposal requested",
  requestPhotos: "More photos requested",
  reportProblem: "Problem reported",
};

const ADVISORY_ACTIONS = ["requestPhotos", "reportProblem"];
const VIEW_LABEL = { front: "Front", back: "Back", label: "Label", damage: "Damage", contents: "Contents" };

const fmtDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const money = (v, cur = "USD") =>
  Number(v || 0).toLocaleString("en-US", { style: "currency", currency: cur, maximumFractionDigits: 2 });

const text = (v) => {
  if (v === null || v === undefined || v === "") return "—";
  if (Array.isArray(v)) return v.length ? v.join(", ") : "—";
  return String(v);
};

const numOrDash = (v) => (v === null || v === undefined || v === "" ? "—" : String(v));

function StatusChip({ status }) {
  return (
    <span
      className={
        "inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " +
        (STATUS_STYLE[status] || "bg-surface-muted text-slate-600")
      }
    >
      {statusLabel(status)}
    </span>
  );
}

function FieldCell({ label, children, wide = false }) {
  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 whitespace-pre-line text-[15px] font-medium text-foreground">{children}</p>
    </div>
  );
}

/* Fetches one authenticated photo blob and revokes its object URL on change/unmount. */
function PhotoTile({ photo }) {
  const [url, setUrl] = useState(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let alive = true;
    let created = null;
    setUrl(null);
    setFailed(false);
    fetchPhotoUrl(photo.id)
      .then((u) => {
        if (!alive) {
          URL.revokeObjectURL(u);
          return;
        }
        created = u;
        setUrl(u);
      })
      .catch(() => {
        if (alive) setFailed(true);
      });
    return () => {
      alive = false;
      if (created) URL.revokeObjectURL(created);
    };
  }, [photo.id]);
  const caption = VIEW_LABEL[photo.view] || text(photo.view);

  return (
    <figure>
      <div className="aspect-square overflow-hidden rounded-lg border border-[#e5eaf2] bg-surface">
        {url ? (
          <img src={url} alt={caption + " photo of " + photo.name} className="h-full w-full object-cover" />
        ) : failed ? (
          <div className="flex h-full flex-col items-center justify-center gap-1 text-slate-300">
            <ImageOff className="h-5 w-5" />
            <span className="text-[11px]">Could not load</span>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-slate-300" />
          </div>
        )}
      </div>
      <figcaption className="mt-1.5 flex items-center justify-between gap-2 px-0.5">
        <span className="text-[12px] font-semibold text-slate-600">{caption}</span>
        <span className="text-[11px] text-slate-400" title={photo.uploadedAt ? new Date(photo.uploadedAt).toLocaleString() : ""}>
          {fmtDate(photo.uploadedAt)}
        </span>
      </figcaption>
    </figure>
  );
}

export default function PackageDetailPage() {
  const { id } = useParams();
  const [pkg, setPkg] = useState(null);
  const [phase, setPhase] = useState("loading"); // loading | ready | notfound | error
  const [refreshing, setRefreshing] = useState(false);

  // Request-an-action dialog
  const [pendingAction, setPendingAction] = useState(null);
  const [note, setNote] = useState("");
  const [actionError, setActionError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Shipping-quote dialog
  const [quoteOpen, setQuoteOpen] = useState(false);
  const [quoteStep, setQuoteStep] = useState("form"); // form | result
  const [quote, setQuote] = useState(null);
  const [qf, setQf] = useState({ weight: "", destinationCountry: "", insurance: false });
  const [quoteError, setQuoteError] = useState("");
  const [quoting, setQuoting] = useState(false);
  const [fallbackWarehouseId, setFallbackWarehouseId] = useState(null);

  const load = async () => {
    setPhase("loading");
    try {
      const row = await fetchPackage(id);
      setPkg(row);
      setPhase("ready");
    } catch (err) {
      setPhase(err?.response?.status === 404 ? "notfound" : "error");
    }
  };

  useEffect(() => {
    let alive = true;
    setPhase("loading");
    fetchPackage(id)
      .then((row) => {
        if (!alive) return;
        setPkg(row);
        setPhase("ready");
      })
      .catch((err) => {
        if (!alive) return;
        setPhase(err?.response?.status === 404 ? "notfound" : "error");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      const row = await fetchPackage(id);
      setPkg(row);
      setPhase("ready");
    } catch (err) {
      setPhase(err?.response?.status === 404 ? "notfound" : "error");
    } finally {
      setRefreshing(false);
    }
  };

  const openAction = (action) => {
    setPendingAction(action);
    setNote("");
    setActionError("");
  };
  const closeAction = () => {
    if (submitting) return;
    setPendingAction(null);
    setNote("");
    setActionError("");
  };

  const submitAction = async () => {
    if (!pendingAction) return;
    setSubmitting(true);
    setActionError("");
    try {
      const res = await requestPackageAction(pkg._id, pendingAction, note.trim());
      if (ADVISORY_ACTIONS.includes(pendingAction)) {
        toast.success("Your request has been sent to the warehouse team.");
      } else {
        toast.success(res.message || "Request submitted.");
      }
      setPendingAction(null);
      setNote("");
      refresh();
    } catch (err) {
      // 409 responses carry the backend's own wording — show it verbatim.
      setActionError(err?.response?.data?.message || "The request could not be sent right now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openQuote = () => {
    setQuoteOpen(true);
    setQuoteStep("form");
    setQuote(null);
    setQuoteError("");
    const weight = pkg.weight ?? pkg.chargeableWeight ?? "";
    setQf({ weight: weight === null || weight === undefined ? "" : String(weight), destinationCountry: "", insurance: false });
    if (!pkg.warehouseId && !fallbackWarehouseId) {
      fetchMailboxes()
        .then((rows) => {
          const first = rows.find((mb) => mb.warehouseId);
          if (first?.warehouseId) setFallbackWarehouseId(first.warehouseId);
        })
        .catch(() => {
          /* optional — the API falls back to its first warehouse */
        });
    }
  };

  const submitQuote = async (e) => {
    e.preventDefault();
    setQuoteError("");
    const weight = Number(qf.weight);
    if (!qf.weight || !Number.isFinite(weight) || weight <= 0) {
      setQuoteError("Enter the package weight in kg — use an estimate if it hasn't been weighed yet.");
      return;
    }
    const country = qf.destinationCountry.trim();
    if (!country) {
      setQuoteError("Destination country is required.");
      return;
    }
    setQuoting(true);
    try {
      const payload = {
        warehouseId: pkg.warehouseId || fallbackWarehouseId || undefined,
        weight,
        declaredValue: Number(pkg.declaredValue) || 0,
        insurance: qf.insurance,
        destinationCountry: country,
        serviceType: "standard",
      };
      const q = await createShippingQuote(payload);
      setQuote(q);
      setQuoteStep("result");
    } catch (err) {
      setQuoteError(err?.response?.data?.message || "We could not calculate a quote right now. Please try again.");
    } finally {
      setQuoting(false);
    }
  };

  const pendingMeta = pendingAction ? ACTION_META[pendingAction] : null;

  /* ------------------------------- states ------------------------------- */

  if (phase === "loading") {
    return (
      <div className="mx-auto w-full max-w-[1180px] space-y-4">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-9 w-72" />
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
          <div className="space-y-4">
            <Skeleton className="h-64 w-full rounded-xl" />
            <Skeleton className="h-56 w-full rounded-xl" />
            <Skeleton className="h-44 w-full rounded-xl" />
          </div>
          <div className="space-y-4">
            <Skeleton className="h-72 w-full rounded-xl" />
            <Skeleton className="h-64 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (phase === "notfound") {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <div className="flex min-h-[340px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <PackageX className="h-6 w-6 text-slate-300" />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-foreground">Package not found</p>
          <p className="mt-1 max-w-sm text-sm leading-relaxed text-muted-foreground">
            We couldn't find this package on your account. It may have been removed, or the link may be wrong.
          </p>
          <Link
            to="/account/packages"
            className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-primary px-6 text-sm font-bold text-primary-foreground transition hover:bg-primary/90"
          >
            <ArrowLeft className="h-4 w-4" /> Back to My Packages
          </Link>
        </div>
      </div>
    );
  }

  if (phase === "error" || !pkg) {
    return (
      <div className="mx-auto w-full max-w-[820px]">
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <p className="font-display text-lg font-bold text-foreground">Could not load this package</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            The warehouse service may be offline — give it another try.
          </p>
          <Button variant="outline" className="mt-5 gap-1.5" onClick={refresh}>
            <RefreshCw className="h-4 w-4" /> Try again
          </Button>
        </div>
      </div>
    );
  }

  const received = pkg.receivedAt ? fmtDate(pkg.receivedAt) : null;
  const timelineSteps = [];
  if (pkg.status === "PRE_ALERTED") timelineSteps.push({ title: "Pre-alerted", date: pkg.createdAt, note: null });
  if (received) timelineSteps.push({ title: "Received at warehouse", date: pkg.receivedAt, note: null });
  if (pkg.lastCustomerAction) {
    const act = pkg.lastCustomerAction.action;
    timelineSteps.push({
      title: ACTION_EVENT[act] || String(act || "Request").replace(/_/g, " ") + " requested",
      date: pkg.lastCustomerAction.at,
      note: pkg.lastCustomerAction.note || null,
    });
  }

  const storage = pkg.storage || null;
  const storageApplies = Boolean(received && storage && storage.freeUntil && storage.overdueDays > 0);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <Link
        to="/account/packages"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-slate-500 transition-colors hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> My Packages
      </Link>

      <header className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <h1 className="flex flex-wrap items-center gap-3 font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            Package <span className="font-mono">{pkg.packageId}</span>
            <StatusChip status={pkg.status} />
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            {[pkg.merchant || null, "Updated " + fmtDate(pkg.updatedAt)].filter(Boolean).join(" · ")}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={refreshing} className="gap-1.5">
          <RefreshCw className={"h-4 w-4 " + (refreshing ? "animate-spin" : "")} /> Refresh
        </Button>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_390px]">
        {/* ------------------------------ left column ------------------------------ */}
        <div className="space-y-6">
          {/* Overview */}
          <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Package overview">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <PackageSearch className="h-5 w-5 text-primary" /> Overview
            </h2>

            {pkg.hazardousReview === true && (
              <div className="mt-4 flex gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3.5">
                <TriangleAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                <div>
                  <p className="text-sm font-bold text-amber-900">Restricted-item review in progress</p>
                  <p className="mt-0.5 text-[13px] leading-relaxed text-amber-800/80">
                    This parcel was flagged when it arrived. Our team is reviewing it and will be in touch if
                    anything is needed from you.
                  </p>
                </div>
              </div>
            )}

            <div className="mt-5 grid gap-x-6 gap-y-5 sm:grid-cols-2">
              <FieldCell label="Store">
                <span className="inline-flex items-center gap-1.5"><Store className="h-4 w-4 text-slate-300" /> {text(pkg.merchant)}</span>
              </FieldCell>
              <FieldCell label="Carrier">{text(pkg.carrier)}</FieldCell>
              <FieldCell label="Merchant tracking number">
                {pkg.merchantTrackingNumber ? (
                  <span className="font-mono text-[14px]">{pkg.merchantTrackingNumber}</span>
                ) : (
                  "—"
                )}
              </FieldCell>
              <FieldCell label="Items">{numOrDash(pkg.itemCount)}</FieldCell>
              <FieldCell label="Declared value">
                {pkg.declaredValue != null ? money(pkg.declaredValue, pkg.currency || "USD") : "—"}
              </FieldCell>
              <FieldCell label="Condition">{text(pkg.condition)}</FieldCell>
              <FieldCell label="Special handling" wide>
                {text(pkg.specialHandling)}
              </FieldCell>
              <FieldCell label="Description" wide>
                {text(pkg.description)}
              </FieldCell>
              <FieldCell label="Notes" wide>
                {text(pkg.notes)}
              </FieldCell>
            </div>
          </section>

          {/* Photos */}
          <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Warehouse photos">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Camera className="h-5 w-5 text-primary" /> Photos
            </h2>
            {!pkg.photos || pkg.photos.length === 0 ? (
              <div className="mt-4 flex flex-col items-center rounded-xl border border-dashed border-border bg-surface/40 px-6 py-10 text-center">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white">
                  <Camera className="h-5 w-5 text-slate-300" />
                </span>
                <p className="mt-3 text-sm font-semibold text-slate-600">No photos yet</p>
                <p className="mt-0.5 max-w-sm text-[13px] text-muted-foreground">
                  Warehouse photos appear after receiving.
                </p>
              </div>
            ) : (
              <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
                {pkg.photos.map((photo) => (
                  <PhotoTile key={photo.id} photo={photo} />
                ))}
              </div>
            )}
          </section>

          {/* Status timeline — built only from real fields, never guessed. */}
          <section className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7" aria-label="Status timeline">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <CalendarDays className="h-5 w-5 text-primary" /> Status timeline
            </h2>

            <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-surface/70 px-4 py-3">
              <span className="text-sm font-semibold text-slate-500">Current status</span>
              <StatusChip status={pkg.status} />
            </div>

            {timelineSteps.length === 0 ? (
              <p className="mt-4 text-sm text-muted-foreground">
                Timeline events will appear here as this package moves through the warehouse.
              </p>
            ) : (
              <ol className="mt-5 space-y-0">
                {timelineSteps.map((step, i) => (
                  <li key={step.title + step.date} className="relative flex gap-4 pb-6 last:pb-0">
                    {i < timelineSteps.length - 1 && (
                      <span aria-hidden="true" className="absolute left-[5px] top-4 h-full w-px bg-border" />
                    )}
                    <span
                      aria-hidden="true"
                      className={
                        "mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-white shadow " +
                        (i === timelineSteps.length - 1 ? "bg-primary" : "bg-slate-300")
                      }
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground">{step.title}</p>
                      <p className="text-[12.5px] text-slate-400"> {fmtDate(step.date)}</p>
                      {step.note && (
                        <p className="mt-1 max-w-md whitespace-pre-line rounded-lg bg-surface px-3 py-2 text-[13px] italic leading-relaxed text-slate-500">
                          "{step.note}"
                        </p>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </div>

        {/* ------------------------------ right column ------------------------------ */}
        <div className="space-y-6">
          {/* Warehouse & measurements */}
          <section className="rounded-xl border border-[#e5eaf2] bg-white p-6" aria-label="Warehouse and measurements">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <Ruler className="h-5 w-5 text-primary" /> Warehouse & measurements
            </h2>

            <div className="mt-4 grid grid-cols-2 gap-x-5 gap-y-4">
              <FieldCell label="Warehouse country">
                {pkg.warehouseCountry ? pkg.warehouseCountry : "—"}
              </FieldCell>
              <FieldCell label="Destination mailbox">{text(pkg.destinationWarehouse)}</FieldCell>
              <FieldCell label="Received at">
                {received || (pkg.status === "PRE_ALERTED" || pkg.status === "EXPECTED" ? "Expected" : "—")}
              </FieldCell>
              <FieldCell label="Expected delivery">
                {pkg.expectedDeliveryDate ? fmtDate(pkg.expectedDeliveryDate) : "—"}
              </FieldCell>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-x-4 gap-y-4 border-t border-border/70 pt-4">
              <FieldCell label="Weight">{numOrDash(pkg.weight)}</FieldCell>
              <FieldCell label="Length">{numOrDash(pkg.length)}</FieldCell>
              <FieldCell label="Width">{numOrDash(pkg.width)}</FieldCell>
              <FieldCell label="Height">{numOrDash(pkg.height)}</FieldCell>
              <FieldCell label="Volumetric weight">{numOrDash(pkg.volumetricWeight)}</FieldCell>
              <FieldCell label="Chargeable weight">{numOrDash(pkg.chargeableWeight)}</FieldCell>
            </div>
            <p className="mt-3 text-[12px] text-slate-400">
              Measurements and weights are taken by warehouse staff once the parcel is received.
            </p>

            {/* Storage */}
            <div className="mt-4 rounded-xl border border-[#e5eaf2] bg-surface/60 p-4">
              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Storage</p>
              {!received ? (
                <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
                  Free storage terms begin once the parcel is received and scanned at the warehouse.
                </p>
              ) : (
                <div className="mt-2 space-y-1.5 text-[13.5px]">
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Free until</span>
                    <span className="font-semibold text-foreground">
                      {storage && storage.freeUntil ? fmtDate(storage.freeUntil) : "—"}
                    </span>
                  </p>
                  <p className="flex items-center justify-between gap-3">
                    <span className="text-slate-500">Daily rate</span>
                    <span className="font-semibold text-foreground">
                      {storage ? Number(storage.dailyRateUSD).toFixed(2) + " USD/day" : "—"}
                    </span>
                  </p>
                  {storageApplies && (
                    <div className="mt-2 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5">
                      <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      <p className="text-[12.5px] font-semibold leading-relaxed text-amber-800">
                        Free period ended — storage of {Number(storage.dailyRateUSD).toFixed(2)} USD/day now applies.
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>

          {/* Actions */}
          <section className="rounded-xl border border-[#e5eaf2] bg-white p-6" aria-label="Package actions">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
              <FileText className="h-5 w-5 text-primary" /> Actions
            </h2>

            {pkg.allowedActions && pkg.allowedActions.length > 0 ? (
              <div className="mt-4 space-y-2">
                {pkg.allowedActions.map((action) => {
                  const meta = ACTION_META[action];
                  const Icon = meta ? meta.icon : ChevronRight;
                  return (
                    <button
                      key={action}
                      type="button"
                      onClick={() => openAction(action)}
                      className="flex w-full items-center gap-3 rounded-lg border border-[#e5eaf2] bg-white px-4 py-3 text-left text-[14px] font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                    >
                      <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                      <span className="min-w-0 flex-1">{meta ? meta.label : String(action).replace(/_/g, " ")}</span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300" />
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-4 text-sm text-muted-foreground">
                No actions are available for this package right now.
              </p>
            )}

            {/* Additive shortcut: the backend allows the consolidate action for this status
                (RECEIVED/PROCESSING/ACTION_REQUIRED/READY_TO_SHIP/REPACKING) and the parcel is
                not part of a completed consolidation yet — point at the multi-package flow. */}
            {(pkg.allowedActions || []).includes("consolidate") && !pkg.consolidationId && (
              <div className="mt-4 border-t border-border/60 pt-3">
                <p className="text-[12px] leading-relaxed text-slate-500">
                  Combine this parcel with others into one shipment and save on per-parcel costs.
                </p>
                <Link
                  to="/account/international"
                  className="mt-1 inline-flex items-center gap-1.5 text-[13px] font-bold text-primary transition-colors hover:text-primary/80 hover:underline"
                >
                  <Globe2 className="h-4 w-4" /> Consolidate packages <ChevronRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            )}

            {(!pkg.allowedActions || pkg.allowedActions.length === 0) && pkg.status === "READY_FOR_PAYMENT" && (
              <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/70 p-4">
                <p className="text-sm font-bold text-amber-900">Ready to ship — payment required</p>
                <p className="mt-1 text-[13px] leading-relaxed text-amber-800/90">
                  This parcel is packed and ready. Pay for shipping and we'll dispatch it to your door.
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <Link
                    to={"/account/checkout?package=" + encodeURIComponent(pkg.packageId)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-4 text-sm font-bold text-white shadow-sm transition-colors hover:bg-accent/90"
                  >
                    Pay & ship <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={openQuote}
                    className="h-10 rounded-lg border-[#e5eaf2] bg-white px-4 text-sm font-bold text-slate-700 hover:border-primary/30 hover:text-primary"
                  >
                    Get a shipping quote
                  </Button>
                </div>
                {pkg.lastCustomerAction?.action === "ship" && (
                  <p className="mt-3 flex items-start gap-1.5 text-[12.5px] font-semibold leading-relaxed text-amber-800/90">
                    <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>
                      You already asked us to ship this parcel — your invoice is waiting under{" "}
                      <Link to="/account/billing" className="font-bold text-primary hover:underline">Billing</Link>.
                    </span>
                  </p>
                )}
              </div>
            )}

            {pkg.lastCustomerAction && (
              <p className="mt-4 rounded-lg bg-surface/70 px-3.5 py-2.5 text-[12.5px] leading-relaxed text-slate-500">
                <Info className="mr-1 inline h-3.5 w-3.5 text-slate-400" />
                Last request from you:{" "}
                <span className="font-semibold text-slate-600">
                  {(ACTION_META[pkg.lastCustomerAction.action]?.label || pkg.lastCustomerAction.action).toLowerCase()}
                </span>{" "}
                on {fmtDate(pkg.lastCustomerAction.at)}.
              </p>
            )}
          </section>
        </div>
      </div>

      {/* --------------------------- action dialog --------------------------- */}
      <Dialog open={Boolean(pendingAction)} onOpenChange={(o) => !o && closeAction()}>
        <DialogContent className="max-w-md rounded-2xl">
          {pendingMeta && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <pendingMeta.icon className="h-5 w-5 text-primary" /> {pendingMeta.label}
                </DialogTitle>
                <DialogDescription>
                  Add a note for our warehouse team{ACTION_HINT[pendingAction] ? " — " + ACTION_HINT[pendingAction].toLowerCase() : ""}.
                </DialogDescription>
              </DialogHeader>
              <Textarea
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Write a short note (optional)…"
                maxLength={1000}
                className="rounded-xl border-border bg-white"
              />
              {actionError && (
                <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
                  {actionError}
                </p>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={closeAction} disabled={submitting}>
                  Cancel
                </Button>
                <Button onClick={submitAction} disabled={submitting} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                  {submitting ? "Sending…" : "Confirm request"}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* --------------------------- quote dialog --------------------------- */}
      <Dialog open={quoteOpen} onOpenChange={(o) => !o && setQuoteOpen(false)}>
        <DialogContent className="max-h-[88vh] overflow-y-auto rounded-2xl sm:max-w-lg">
          {quoteStep === "form" ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 font-display">
                  <Ship className="h-5 w-5 text-primary" /> Shipping quote
                </DialogTitle>
                <DialogDescription>
                  Estimate for shipping this parcel from the warehouse — not a guaranteed price.
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={submitQuote} className="space-y-4" noValidate>
                <div className="space-y-2">
                  <Label htmlFor="quote-weight">Weight (kg)</Label>
                  <Input
                    id="quote-weight"
                    type="number"
                    min="0.1"
                    step="0.01"
                    value={qf.weight}
                    onChange={(e) => setQf((f) => ({ ...f, weight: e.target.value }))}
                    placeholder="e.g. 1.5"
                    className="h-[46px] rounded-[10px] border-border bg-white"
                    required
                  />
                  {!qf.weight &&
                    (pkg.weight === null || pkg.weight === undefined) &&
                    (pkg.chargeableWeight === null || pkg.chargeableWeight === undefined) && (
                    <p className="text-[12px] text-slate-400">
                      This parcel hasn't been weighed yet — estimate it for now.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="quote-country">Destination country</Label>
                  <Input
                    id="quote-country"
                    value={qf.destinationCountry}
                    onChange={(e) => setQf((f) => ({ ...f, destinationCountry: e.target.value }))}
                    placeholder="e.g. Uganda"
                    className="h-[46px] rounded-[10px] border-border bg-white"
                    required
                  />
                </div>
                <div className="flex items-center justify-between gap-3 rounded-xl bg-surface/60 px-4 py-3">
                  <div>
                    <p className="text-sm font-semibold text-foreground">Shipment protection</p>
                    <p className="text-[12px] text-slate-400">Insures the declared value of {money(pkg.declaredValue, pkg.currency || "USD")}</p>
                  </div>
                  <input
                    id="quote-insurance"
                    type="checkbox"
                    checked={qf.insurance}
                    onChange={(e) => setQf((f) => ({ ...f, insurance: e.target.checked }))}
                    className="h-5 w-5 rounded border-border accent-primary"
                  />
                </div>
                {quoteError && (
                  <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
                    {quoteError}
                  </p>
                )}
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setQuoteOpen(false)}>
                    Cancel
                  </Button>
                  <Button type="submit" disabled={quoting} className="gap-2 bg-primary text-primary-foreground hover:bg-primary/90">
                    {quoting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                    {quoting ? "Calculating…" : "Get quote"}
                  </Button>
                </DialogFooter>
              </form>
            </>
          ) : quote ? (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Your quote — {money(quote.total, quote.currency)}</DialogTitle>
                <DialogDescription>
                  Quote {quote.quoteId} · valid until {fmtDate(quote.expiresAt)}
                </DialogDescription>
              </DialogHeader>
              <div className="overflow-hidden rounded-xl border border-[#e5eaf2]">
                {(quote.lineItems || []).map((li) => (
                  <div key={li.code} className="flex items-center justify-between gap-4 border-b border-border/60 bg-white px-4 py-2.5 text-sm last:border-0">
                    <span className="text-slate-600">{li.label}</span>
                    <span className="font-mono text-[13.5px] font-semibold text-foreground">
                      {money(li.amount, quote.currency)}
                    </span>
                  </div>
                ))}
                <div className="flex items-center justify-between gap-4 bg-surface px-4 py-3">
                  <span className="text-sm font-bold text-foreground">Estimated total</span>
                  <span className="font-mono text-[15px] font-extrabold text-foreground">
                    {money(quote.total, quote.currency)}
                  </span>
                </div>
              </div>
              {quote.note && <p className="text-[12.5px] italic leading-relaxed text-slate-400">{quote.note}</p>}
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setQuoteStep("form")}>
                  Adjust details
                </Button>
                <Button type="button" onClick={() => setQuoteOpen(false)} className="bg-primary text-primary-foreground hover:bg-primary/90">
                  Done
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}
