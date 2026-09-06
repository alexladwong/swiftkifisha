import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PackagePlus, PackageOpen, ChevronRight, RefreshCw, Store, MapPin, PackageX } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { fetchMyPackages } from "@/lib/portalApi";

/* Status chip palette — soft background + readable text, kept in one place. */
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

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const weightOf = (pkg) => {
  if (pkg.chargeableWeight != null) return { value: pkg.chargeableWeight, chargeable: true };
  if (pkg.weight != null) return { value: pkg.weight, chargeable: false };
  return null;
};

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

export default function PackagesPage() {
  const [packages, setPackages] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("ALL");

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const rows = await fetchMyPackages();
      setPackages(rows);
    } catch {
      setError("Could not load your packages. The warehouse service may be offline.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    fetchMyPackages()
      .then((rows) => alive && setPackages(rows))
      .catch(() => alive && setError("Could not load your packages. The warehouse service may be offline."));
    return () => {
      alive = false;
    };
  }, []);

  // Chips come from the statuses actually present in the data, plus PRE_ALERTED
  // so the chip is always there before a first pre-alert lands.
  const chips = [
    "ALL",
    ...Array.from(new Set([...(packages || []).map((p) => p.status), "PRE_ALERTED"])),
  ];
  const visible = (packages || []).filter((p) => filter === "ALL" || p.status === filter);

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
            My Packages
          </h1>
          <p className="mt-1 text-[15px] text-muted-foreground">
            Parcels headed to your mailbox — pre-alert a purchase and follow it here.
          </p>
        </div>
        <Link
          to="/account/packages/pre-alert"
          className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent/90"
        >
          <PackagePlus className="h-4 w-4" /> Pre-alert a package
        </Link>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/25 px-3 text-[12px] font-bold text-destructive transition-colors hover:bg-destructive/10"
          >
            <RefreshCw className={"h-3.5 w-3.5 " + (loading ? "animate-spin" : "")} /> Retry
          </button>
        </div>
      )}

      {!packages && !error && (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[120px] w-full rounded-xl" />
          ))}
        </div>
      )}

      {packages && (
        <>
          {/* Status filter chips */}
          <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter packages by status">
            {chips.map((chip) => (
              <button
                key={chip}
                type="button"
                onClick={() => setFilter(chip)}
                aria-pressed={filter === chip}
                className={
                  "rounded-full border px-3.5 py-1.5 text-[13px] font-semibold transition-colors " +
                  (filter === chip
                    ? "border-primary/40 bg-primary/5 text-primary"
                    : "border-[#e5eaf2] bg-white text-slate-600 hover:border-slate-300")
                }
              >
                {chip === "ALL" ? "All" : statusLabel(chip)}
              </button>
            ))}
          </div>

          {packages.length === 0 ? (
            <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
                <PackageOpen className="h-6 w-6 text-slate-300" />
              </span>
              <p className="mt-4 font-display text-lg font-bold text-foreground">No packages yet</p>
              <p className="mt-1 max-w-md text-[14px] leading-relaxed text-muted-foreground">
                When you tell us a parcel is on its way, it appears here so you can follow it from the
                merchant to your mailbox — status, photos and actions in one place.
              </p>
              <Link
                to="/account/packages/pre-alert"
                className="mt-5 inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-6 text-sm font-bold text-white shadow-sm transition hover:bg-accent/90"
              >
                <PackagePlus className="h-4 w-4" /> Pre-alert a package
              </Link>
            </div>
          ) : (
            <>
              {visible.length === 0 && (
                <div className="flex min-h-[220px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-10 text-center">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
                    <PackageX className="h-5 w-5 text-slate-300" />
                  </span>
                  <p className="mt-3 font-display text-[15px] font-bold text-foreground">
                    No packages with status "{statusLabel(filter)}"
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">Try another filter above.</p>
                </div>
              )}

              <ul className="space-y-3">
                {visible.map((pkg) => {
                  const w = weightOf(pkg);
                  const received = pkg.receivedAt ? fmtDate(pkg.receivedAt) : null;
                  const expected = !received && pkg.expectedDeliveryDate ? fmtDate(pkg.expectedDeliveryDate) : null;
                  const storage = pkg.storage || null;
                  const showStorage = Boolean(received && storage && storage.freeUntil);
                  const storageOverdue = showStorage && storage.overdueDays > 0;
                  return (
                    <li
                      key={pkg._id}
                      className="rounded-xl border border-[#e5eaf2] bg-white p-5 transition-shadow hover:shadow-sm"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="font-mono text-[14px] font-bold tracking-tight text-foreground">
                            {pkg.packageId}
                          </span>
                          <StatusChip status={pkg.status} />
                        </div>
                        <Link
                          to={"/account/packages/" + pkg.packageId}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#e5eaf2] bg-white px-3.5 text-[13px] font-bold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          Details <ChevronRight className="h-4 w-4" />
                        </Link>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-[15px]">
                        <Store className="h-4 w-4 shrink-0 text-slate-300" />
                        <span className="font-semibold text-foreground">{pkg.merchant || "Unknown store"}</span>
                        {pkg.merchantTrackingNumber && (
                          <span className="font-mono text-[12.5px] text-slate-400">
                            · #{pkg.merchantTrackingNumber}
                          </span>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-slate-500">
                        {pkg.warehouseCountry ? (
                          <span className="inline-flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-300" /> {pkg.warehouseCountry}
                          </span>
                        ) : null}
                        {w ? (
                          <span>
                            {w.value} kg{w.chargeable ? " chargeable" : ""}
                          </span>
                        ) : (
                          <span>weight —</span>
                        )}
                        <span className="text-slate-300">·</span>
                        <span>{received ? "Received " + received : expected ? "Expected " + expected : "Expected"}</span>
                      </div>

                      {showStorage && (
                        <p
                          className={
                            "mt-2 text-[13px] font-semibold " +
                            (storageOverdue ? "text-amber-600" : "text-emerald-600")
                          }
                        >
                          {storageOverdue
                            ? `Storage ${storage.dailyRateUSD} USD/day applies`
                            : "Free storage until " + fmtDate(storage.freeUntil)}
                        </p>
                      )}
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </div>
  );
}
