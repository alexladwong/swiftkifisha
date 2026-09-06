import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Combine, Boxes, FileText, TriangleAlert, Info, RefreshCw, Loader2, CheckCircle2,
  Plus, Trash2, PackageOpen, Send,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import {
  fetchMyPackages, fetchMyConsolidations, createConsolidation,
  fetchMyDeclarations, createCustomsDeclaration, fetchRestrictedCategories,
} from "@/lib/portalApi";

/* Statuses the warehouse can still consolidate — mirrors the backend's own
 * eligibility (the allowedFrom set of the consolidate action). */
const CONSOLIDATION_ELIGIBLE = ["RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "REPACKING"];

/* Statuses that may still be declared — mirrors the backend WORKABLE set
 * ("packages that are still being prepared"). PRE_ALERTED/EXPECTED parcels
 * haven't been received; dispatched/returned/disposed ones have left. */
const DECLARABLE_STATUSES = [
  "RECEIVED", "PROCESSING", "ACTION_REQUIRED", "READY_TO_SHIP", "REPACKING",
  "CONSOLIDATION_PENDING", "HOLD", "EXCEPTION",
];

/* Package chip palette — same family as the package pages. */
const PKG_STYLE = {
  RECEIVED: "bg-blue-100 text-blue-700",
  PROCESSING: "bg-indigo-100 text-indigo-700",
  ACTION_REQUIRED: "bg-rose-100 text-rose-700",
  READY_TO_SHIP: "bg-emerald-100 text-emerald-700",
  CONSOLIDATION_PENDING: "bg-fuchsia-100 text-fuchsia-700",
  REPACKING: "bg-purple-100 text-purple-700",
  HOLD: "bg-orange-100 text-orange-700",
  EXCEPTION: "bg-red-100 text-red-700",
};
const PKG_TEXT = {
  RECEIVED: "Received",
  PROCESSING: "Processing",
  ACTION_REQUIRED: "Action required",
  READY_TO_SHIP: "Ready to ship",
  CONSOLIDATION_PENDING: "Consolidation pending",
  REPACKING: "Repacking",
  HOLD: "On hold",
  EXCEPTION: "Exception",
};

const CONSOL_STYLE = {
  REQUESTED: "bg-amber-100 text-amber-800",
  IN_PROGRESS: "bg-blue-100 text-blue-700",
  COMPLETED: "bg-emerald-100 text-emerald-700",
  CANCELLED: "bg-slate-100 text-slate-600",
};
const CONSOL_TEXT = { REQUESTED: "Requested", IN_PROGRESS: "In progress", COMPLETED: "Completed", CANCELLED: "Cancelled" };

const DECL_STYLE = {
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-emerald-100 text-emerald-700",
  FLAGGED: "bg-red-100 text-red-700",
  MORE_INFO: "bg-amber-100 text-amber-800",
};
const DECL_TEXT = { SUBMITTED: "Submitted", APPROVED: "Approved", FLAGGED: "Flagged", MORE_INFO: "More info" };

const PURPOSES = [
  { value: "personal", label: "Personal items" },
  { value: "gift", label: "Gift" },
  { value: "sale", label: "Sale / commercial goods" },
  { value: "documents", label: "Documents / papers" },
  { value: "return", label: "Return" },
];
const PURPOSE_LABEL = Object.fromEntries(PURPOSES.map((p) => [p.value, p.label]));

const inputCls =
  "h-[46px] rounded-[10px] border border-border bg-white px-3.5 text-[15px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40 disabled:bg-surface/60";
const selectCls = inputCls + " w-full";
/* Slightly slimmer inputs for the dense customs item rows. */
const itemInputCls =
  "h-[42px] rounded-[9px] border border-border bg-white px-3.5 text-[14.5px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40";

const statusLabel = (map, status) =>
  map[status] || String(status || "Unknown").replace(/_/g, " ").toLowerCase().replace(/^\w/, (c) => c.toUpperCase());

const humanize = (s) =>
  String(s || "Unknown")
    .split("_")
    .map((w) => (w ? w[0] + w.slice(1).toLowerCase() : w))
    .join(" ");

const fmtDate = (iso) => {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
};

const money = (v, cur = "USD") => {
  const n = Number(v);
  if (!Number.isFinite(n)) return null;
  return n.toLocaleString("en-US", { style: "currency", currency: cur || "USD", maximumFractionDigits: 2 });
};

const kg = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString("en-US", { maximumFractionDigits: 2 }) + " kg";
};

/* Live weights vary by parcel; chargeable is the one the warehouse bills on. */
const packageWeightText = (pkg) => {
  if (pkg.chargeableWeight != null) return kg(pkg.chargeableWeight) + " chargeable";
  if (pkg.weight != null) return kg(pkg.weight);
  return null;
};

const resultWeightText = (result) => {
  if (!result) return null;
  if (result.chargeableWeight != null) return kg(result.chargeableWeight) + " chargeable";
  if (result.weight != null) return kg(result.weight);
  return null;
};

function Chip({ cls, children }) {
  return (
    <span className={"inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide " + cls}>
      {children}
    </span>
  );
}

function ErrorBox({ message }) {
  return (
    <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-[13px] text-destructive">
      {message}
    </p>
  );
}

function SectionError({ message, onRetry, busy }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      <p>{message}</p>
      <button
        type="button"
        onClick={onRetry}
        disabled={busy}
        className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/25 px-3 text-[12px] font-bold text-destructive transition-colors hover:bg-destructive/10 disabled:opacity-60"
      >
        <RefreshCw className={"h-3.5 w-3.5 " + (busy ? "animate-spin" : "")} /> Retry
      </button>
    </div>
  );
}

/* One dataset with an initial load and a manual reload (keeps old rows while refreshing). */
function useResource(fetcher, failMsg) {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    fetcher()
      .then((d) => alive && setData(d))
      .catch(() => alive && setError(failMsg));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = async () => {
    setBusy(true);
    setError("");
    try {
      setData(await fetcher());
    } catch {
      setError(failMsg);
    } finally {
      setBusy(false);
    }
  };

  return { data, error, busy, reload };
}

/* One selectable package row (checkbox + mono id + status chip + meta). */
function PackageRow({ pkg, checked, onToggle }) {
  const w = packageWeightText(pkg);
  return (
    <label
      className={
        "flex items-start gap-3 rounded-lg border px-3.5 py-3 transition-colors " +
        (checked
          ? "border-primary/40 bg-primary/[0.04]"
          : "border-[#e5eaf2] bg-white cursor-pointer hover:border-slate-300")
      }
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={onToggle}
        className="mt-1 h-[18px] w-[18px] shrink-0 rounded border-border accent-primary"
      />
      <span className="min-w-0 flex-1">
        <span className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[13.5px] font-bold tracking-tight text-foreground">{pkg.packageId}</span>
          <Chip cls={PKG_STYLE[pkg.status] || "bg-surface-muted text-slate-600"}>{PKG_TEXT[pkg.status] || statusLabel(PKG_TEXT, pkg.status)}</Chip>
        </span>
        <span className="mt-1 block truncate text-[13px] text-slate-500">
          {pkg.merchant || "Unknown store"}
          {w ? <span> · {w}</span> : null}
        </span>
      </span>
    </label>
  );
}

/* One recent consolidation request row (id + status + refs + result + repack). */
function ConsolidationRow({ row }) {
  const refs = Array.isArray(row.packageRefs) ? row.packageRefs : [];
  const resultW = row.status === "COMPLETED" ? resultWeightText(row.result) : null;
  const date = row.requestedAt || row.createdAt;
  return (
    <li className="rounded-lg border border-[#e5eaf2] bg-surface/30 px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13.5px] font-bold tracking-tight text-foreground">{row.consolidationId}</span>
        <Chip cls={CONSOL_STYLE[row.status] || "bg-surface-muted text-slate-600"}>{CONSOL_TEXT[row.status] || humanize(row.status)}</Chip>
        {row.repack === true && (
          <span className="inline-flex items-center rounded-full border border-purple-200 bg-purple-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-purple-700">
            Repack
          </span>
        )}
        {date && <span className="ml-auto text-[12px] text-slate-400">Requested {fmtDate(date)}</span>}
      </div>
      {refs.length > 0 && (
        <p className="mt-1.5 font-mono text-[12px] leading-relaxed text-slate-500">{refs.join(" · ")}</p>
      )}
      {row.note && <p className="mt-1 text-[12.5px] italic leading-relaxed text-slate-500">"{row.note}"</p>}
      {resultW && (
        <p className="mt-1.5 flex items-center gap-1.5 text-[12.5px] font-semibold text-emerald-700">
          <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          Result: combined {resultW}
        </p>
      )}
      {row.status === "COMPLETED" && row.result?.note && (
        <p className="mt-1 text-[12.5px] leading-relaxed text-slate-500">{row.result.note}</p>
      )}
    </li>
  );
}

/* One declaration row (id + status + totals + review note when present). */
function DeclarationRow({ row }) {
  const refs = Array.isArray(row.packageRefs) ? row.packageRefs : [];
  const reviewCls =
    row.status === "FLAGGED"
      ? "border-rose-200 bg-rose-50 text-rose-800"
      : row.status === "MORE_INFO"
        ? "border-amber-200 bg-amber-50 text-amber-800"
        : "border-slate-200 bg-surface text-slate-600";
  return (
    <li className="rounded-lg border border-[#e5eaf2] bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[13.5px] font-bold tracking-tight text-foreground">{row.declarationId}</span>
        <Chip cls={DECL_STYLE[row.status] || "bg-surface-muted text-slate-600"}>{DECL_TEXT[row.status] || humanize(row.status)}</Chip>
        {row.createdAt && <span className="ml-auto text-[12px] text-slate-400">{fmtDate(row.createdAt)}</span>}
      </div>
      <p className="mt-1.5 text-[13px] leading-relaxed text-slate-500">
        {PURPOSE_LABEL[row.purpose] || humanize(row.purpose)}
        {refs.length > 0 && (
          <>
            {" · "}
            <span className="font-mono text-[12px]">{refs.join(", ")}</span>
          </>
        )}
        {" · "}
        <span className="font-bold text-foreground">{money(row.totalValue, row.currency || "USD")}</span>
      </p>
      {row.reviewNote && (
        <p className={"mt-2 flex items-start gap-1.5 rounded-lg border px-3 py-2 text-[12.5px] font-medium leading-relaxed " + reviewCls}>
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span>{row.reviewNote}</span>
        </p>
      )}
    </li>
  );
}

export default function InternationalPage() {
  /* Packages power both the consolidation and the customs selectors, so the
   * list is fetched once and shared — each card still guards its own area. */
  const packages = useResource(fetchMyPackages, "Could not load your packages — please try again.");
  const consolidations = useResource(fetchMyConsolidations, "Could not load your consolidation requests — please try again.");
  const declarations = useResource(fetchMyDeclarations, "Could not load your customs declarations — please try again.");
  const restricted = useResource(fetchRestrictedCategories, "Could not load the restricted-items advisory — please try again.");

  const allPkgs = packages.data || [];
  const consolidatable = allPkgs.filter((p) => CONSOLIDATION_ELIGIBLE.includes(p.status) && !p.consolidationId);
  const declarable = allPkgs.filter((p) => DECLARABLE_STATUSES.includes(p.status));

  /* ------------------------- consolidation form ------------------------- */
  const [selC, setSelC] = useState([]);
  const [cNote, setCNote] = useState("");
  const [cRepack, setCRepack] = useState(false);
  const [cClientError, setCClientError] = useState("");
  const [cServerError, setCServerError] = useState("");
  const [cBusy, setCBusy] = useState(false);
  const [createdC, setCreatedC] = useState(null); // { consolidationId, status, ... }
  const [createdCMsg, setCreatedCMsg] = useState("");

  const toggleC = (id) => {
    setSelC((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setCClientError("");
    setCServerError("");
  };

  const submitConsolidation = async (ev) => {
    ev.preventDefault();
    if (createdC) return;
    setCClientError("");
    setCServerError("");
    const ids = selC.filter((id) => consolidatable.some((p) => p._id === id || p.packageId === id));
    if (ids.length < 2) {
      setCClientError("Choose at least two packages to consolidate.");
      return;
    }
    setCBusy(true);
    try {
      const res = await createConsolidation({
        packageIds: ids,
        note: cNote.trim() || undefined,
        repack: cRepack,
      });
      const msg = res.message || "Consolidation request sent to the warehouse.";
      toast.success(msg);
      setCreatedCMsg(msg);
      setCreatedC(res.consolidation);
      setSelC([]);
      setCNote("");
      setCRepack(false);
      // The chosen packages are now CONSOLIDATION_PENDING — refresh both lists.
      packages.reload();
      consolidations.reload();
    } catch (err) {
      // 400/403/409 carry the backend's own wording — show it verbatim.
      setCServerError(
        err?.response?.data?.message || "The consolidation request could not be sent right now. Please try again.",
      );
    } finally {
      setCBusy(false);
    }
  };

  const resetConsolidation = () => {
    setCreatedC(null);
    setCreatedCMsg("");
    setCServerError("");
    setCClientError("");
  };

  /* ------------------------- customs declaration form ------------------------- */
  const blankItem = () => ({ description: "", quantity: "", unitValue: "", countryOfOrigin: "", hsCode: "" });
  const [selD, setSelD] = useState([]);
  const [purpose, setPurpose] = useState("personal");
  const [items, setItems] = useState([blankItem()]);
  const [itemErrors, setItemErrors] = useState({});
  const [dClientError, setDClientError] = useState("");
  const [dServerError, setDServerError] = useState("");
  const [dBusy, setDBusy] = useState(false);
  const [createdD, setCreatedD] = useState(null); // { declarationId, status, totalValue, currency, ... }
  const [createdDMsg, setCreatedDMsg] = useState("");

  const toggleD = (id) => {
    setSelD((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setDClientError("");
    setDServerError("");
  };

  const addItem = () => setItems((cur) => [...cur, blankItem()]);

  const removeItem = (i) => {
    setItems((cur) => (cur.length > 1 ? cur.filter((_, idx) => idx !== i) : cur));
    setItemErrors((cur) => {
      const next = {};
      Object.keys(cur).forEach((k) => {
        const idx = Number(k);
        if (idx === i) return;
        next[idx > i ? idx - 1 : idx] = cur[k]; // keep error messages aligned after removal
      });
      return next;
    });
  };

  const updateItem = (i, key) => (ev) => {
    const value = ev.target.value;
    setItems((cur) => cur.map((it, idx) => (idx === i ? { ...it, [key]: value } : it)));
    setItemErrors((cur) => {
      const next = { ...cur };
      if (next[i]) {
        const row = { ...next[i] };
        delete row[key];
        if (Object.keys(row).length) next[i] = row;
        else delete next[i];
      }
      return next;
    });
  };

  const fieldError = (i, key) => {
    const msg = itemErrors[i] && itemErrors[i][key];
    return msg ? <p className="text-[12.5px] font-medium text-destructive">{msg}</p> : null;
  };

  const validateItems = () => {
    const errs = {};
    items.forEach((it, i) => {
      const e = {};
      const q = Number(it.quantity);
      const u = Number(it.unitValue);
      if (!it.description.trim()) e.description = "Describe the item.";
      if (!String(it.quantity).trim() || !Number.isFinite(q) || q <= 0) e.quantity = "Quantity must be greater than zero.";
      if (!String(it.unitValue).trim() || !Number.isFinite(u) || u <= 0) e.unitValue = "Unit value must be greater than zero.";
      if (!it.countryOfOrigin.trim()) e.countryOfOrigin = "Country of origin is required.";
      if (it.hsCode.trim().length > 20) e.hsCode = "HS codes are at most 20 characters.";
      if (Object.keys(e).length) errs[i] = e;
    });
    setItemErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const submitDeclaration = async (ev) => {
    ev.preventDefault();
    if (createdD) return;
    setDClientError("");
    setDServerError("");
    setItemErrors({});
    const ids = selD.filter((id) => declarable.some((p) => p._id === id || p.packageId === id));
    if (ids.length === 0) {
      setDClientError("Choose at least one package to declare.");
      return;
    }
    if (!validateItems()) {
      setDClientError("Fix the highlighted item details below before submitting.");
      return;
    }
    setDBusy(true);
    try {
      const res = await createCustomsDeclaration({
        packageIds: ids,
        purpose,
        items: items.map((it) => ({
          description: it.description.trim(),
          quantity: Number(it.quantity),
          unitValue: Number(it.unitValue),
          countryOfOrigin: it.countryOfOrigin.trim(),
          hsCode: it.hsCode.trim() || undefined,
        })),
      });
      const msg = res.message || "Customs declaration submitted for review.";
      toast.success(msg);
      setCreatedDMsg(msg);
      setCreatedD(res.declaration);
      setSelD([]);
      setPurpose("personal");
      setItems([blankItem()]);
      declarations.reload();
    } catch (err) {
      // 400/403/409 carry the backend's own wording — show it verbatim.
      setDServerError(
        err?.response?.data?.message || "The declaration could not be submitted right now. Please try again.",
      );
    } finally {
      setDBusy(false);
    }
  };

  const resetDeclaration = () => {
    setCreatedD(null);
    setCreatedDMsg("");
    setDServerError("");
    setDClientError("");
    setItemErrors({});
  };

  /* ------------------------- shared render helpers ------------------------- */
  const packagesBlock = (form) =>
    packages.error ? (
      <SectionError message={packages.error} onRetry={packages.reload} busy={packages.busy} />
    ) : packages.data === null ? (
      <div className="space-y-2">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
        ))}
      </div>
    ) : (
      form()
    );

  const emptyState = ({ icon: Icon, title, body }) => (
    <div className="flex min-h-[180px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-8 text-center">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
        <Icon className="h-5 w-5 text-slate-300" />
      </span>
      <p className="mt-3 font-display text-[15px] font-bold text-foreground">{title}</p>
      <p className="mt-1 max-w-md text-[13px] leading-relaxed text-muted-foreground">{body}</p>
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
          International
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Consolidate parcels into one shipment, declare contents for customs, and check what can't travel.
        </p>
      </header>

      {/* ============================ a. Consolidate packages ============================ */}
      <section
        aria-label="Consolidate packages"
        className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <Combine className="h-5 w-5 text-primary" /> Consolidate packages
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Ask the warehouse to combine two or more of your parcels into a single shipment — pick the parcels below.
        </p>

        <div className="mt-5">
          {packagesBlock(() =>
            consolidatable.length === 0 ? (
              emptyState({
                icon: Boxes,
                title: "No packages available to consolidate",
                body: "Parcels are eligible once received and while they're being prepared — statuses like Received, Processing, Action required, Ready to ship or Repacking. Expected or dispatched parcels can't be combined yet.",
              })
            ) : (
              <form onSubmit={submitConsolidation} noValidate aria-label="Request a consolidation">
                {createdC && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 text-[13.5px] leading-relaxed text-emerald-900">
                        <p className="font-bold">{createdCMsg}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[14px] font-extrabold">{createdC.consolidationId}</span>
                          <Chip cls="bg-amber-100 text-amber-800">Requested</Chip>
                        </p>
                        <p className="mt-2 text-emerald-800/90">
                          Warehouse will confirm — completed consolidations get a new combined weight.
                        </p>
                        <button
                          type="button"
                          onClick={resetConsolidation}
                          className="mt-3 inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-white px-3.5 text-[12.5px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                        >
                          Make another request
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!createdC && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Select packages <span className="normal-case text-slate-400">(need at least two)</span>
                      </p>
                      <span className="text-[12px] font-semibold text-slate-500">{selC.length} selected</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {consolidatable.map((pkg) => (
                        <PackageRow
                          key={pkg._id}
                          pkg={pkg}
                          checked={selC.includes(pkg._id)}
                          onToggle={() => toggleC(pkg._id)}
                        />
                      ))}
                    </div>
                    {cClientError && <div className="mt-3"><ErrorBox message={cClientError} /></div>}
                    {cServerError && <div className="mt-3"><ErrorBox message={cServerError} /></div>}

                    <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_280px]">
                      <div className="space-y-1.5">
                        <Label htmlFor="con-note" className="text-[13px] font-semibold text-foreground">
                          Note for our team <span className="font-normal text-slate-400">(optional)</span>
                        </Label>
                        <textarea
                          id="con-note"
                          rows={2}
                          value={cNote}
                          onChange={(e) => setCNote(e.target.value)}
                          placeholder="Anything the warehouse should know before combining these parcels…"
                          maxLength={1000}
                          className="w-full rounded-[10px] border border-border bg-white px-3.5 py-2.5 text-[14.5px] outline-none transition-colors focus:border-primary/50 focus-visible:ring-2 focus-visible:ring-primary/40"
                        />
                      </div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e5eaf2] bg-surface/40 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={cRepack}
                          onChange={(e) => setCRepack(e.target.checked)}
                          className="mt-0.5 h-[18px] w-[18px] rounded border-border accent-primary"
                        />
                        <span>
                          <span className="block text-[13.5px] font-bold text-foreground">Include repack</span>
                          <span className="mt-0.5 block text-[12px] leading-relaxed text-slate-500">
                            Ask the warehouse to put everything into one box.
                          </span>
                        </span>
                      </label>
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                      <p className="text-[12px] leading-relaxed text-slate-400">
                        Packages you pick move to "Consolidation pending" until the warehouse confirms.
                      </p>
                      <button
                        type="submit"
                        disabled={cBusy || selC.length < 2}
                        className="inline-flex h-[46px] items-center gap-2 rounded-[10px] bg-accent px-6 text-[14.5px] font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {cBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Boxes className="h-4 w-4" />}
                        {cBusy ? "Sending…" : "Request consolidation"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ),
          )}
        </div>

        {/* Recent consolidation requests */}
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Recent consolidation requests</h3>
            {consolidations.data !== null && consolidations.data.length > 0 && (
              <span className="text-[12px] text-slate-400">{consolidations.data.length} on file</span>
            )}
          </div>
          <div className="mt-2.5">
            {consolidations.error ? (
              <SectionError message={consolidations.error} onRetry={consolidations.reload} busy={consolidations.busy} />
            ) : consolidations.data === null ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-[70px] w-full rounded-lg" />
                ))}
              </div>
            ) : consolidations.data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-5 text-center">
                <p className="text-[13.5px] font-semibold text-slate-600">No consolidation requests yet</p>
                <p className="mx-auto mt-0.5 max-w-md text-[12.5px] leading-relaxed text-slate-400">
                  Pick two or more packages above and the warehouse team takes it from there.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {consolidations.data.map((row) => (
                  <ConsolidationRow key={row._id || row.consolidationId} row={row} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ============================ b. Customs declaration ============================ */}
      <section
        aria-label="Customs declaration"
        className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <FileText className="h-5 w-5 text-primary" /> Customs declaration
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Tell customs what's inside before your parcels ship — one declaration can cover several packages.
        </p>

        <div className="mt-5">
          {packagesBlock(() =>
            declarable.length === 0 ? (
              emptyState({
                icon: PackageOpen,
                title: "No packages available to declare",
                body: "Declarations are for parcels still at the warehouse — received, being processed or awaiting shipping. Parcels that are still expected, already dispatched, or returned can't be declared.",
              })
            ) : (
              <form onSubmit={submitDeclaration} noValidate aria-label="Submit a customs declaration">
                {createdD && (
                  <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4">
                    <div className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" />
                      <div className="min-w-0 text-[13.5px] leading-relaxed text-emerald-900">
                        <p className="font-bold">{createdDMsg}</p>
                        <p className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="font-mono text-[14px] font-extrabold">{createdD.declarationId}</span>
                          <Chip cls="bg-blue-100 text-blue-700">Submitted</Chip>
                          <span className="font-bold">
                            {money(createdD.totalValue, createdD.currency || "USD")} declared
                          </span>
                        </p>
                        <p className="mt-2 text-emerald-800/90">
                          Our team reviews every declaration before dispatch — status updates appear below.
                        </p>
                        <button
                          type="button"
                          onClick={resetDeclaration}
                          className="mt-3 inline-flex h-9 items-center rounded-lg border border-emerald-300 bg-white px-3.5 text-[12.5px] font-bold text-emerald-800 transition-colors hover:bg-emerald-100"
                        >
                          Submit another declaration
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {!createdD && (
                  <>
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                        Select packages
                      </p>
                      <span className="text-[12px] font-semibold text-slate-500">{selD.length} selected</span>
                    </div>
                    <div className="mt-2 space-y-2">
                      {declarable.map((pkg) => (
                        <PackageRow
                          key={pkg._id}
                          pkg={pkg}
                          checked={selD.includes(pkg._id)}
                          onToggle={() => toggleD(pkg._id)}
                        />
                      ))}
                    </div>
                    {dClientError && <div className="mt-3"><ErrorBox message={dClientError} /></div>}
                    {dServerError && <div className="mt-3"><ErrorBox message={dServerError} /></div>}

                    <div className="mt-4 grid gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
                      <div className="space-y-1.5">
                        <Label htmlFor="cd-purpose" className="text-[13px] font-semibold text-foreground">Purpose</Label>
                        <select id="cd-purpose" value={purpose} onChange={(e) => setPurpose(e.target.value)} className={selectCls}>
                          {PURPOSES.map((p) => (
                            <option key={p.value} value={p.value}>{p.label}</option>
                          ))}
                        </select>
                        <p className="text-[11.5px] text-slate-400">Values are declared in USD.</p>
                      </div>
                      <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50/70 px-4 py-3">
                        <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                        <p className="text-[12.5px] font-semibold leading-relaxed text-amber-900">
                          Declare the true contents and value — customs controls apply; never under-declare.
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Items in these parcels</p>
                        <button
                          type="button"
                          onClick={addItem}
                          className="inline-flex h-8 items-center gap-1.5 rounded-md border border-[#e5eaf2] bg-white px-3 text-[12px] font-bold text-slate-600 transition-colors hover:border-primary/30 hover:text-primary"
                        >
                          <Plus className="h-3.5 w-3.5" /> Add item
                        </button>
                      </div>

                      {items.map((it, i) => (
                        <div key={i} className="rounded-xl border border-[#e5eaf2] bg-surface/40 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Item {i + 1}</p>
                            <button
                              type="button"
                              onClick={() => removeItem(i)}
                              disabled={items.length === 1}
                              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-[12px] font-bold text-slate-400 transition-colors hover:bg-rose-50 hover:text-destructive disabled:cursor-not-allowed disabled:opacity-40"
                            >
                              <Trash2 className="h-3.5 w-3.5" /> Remove
                            </button>
                          </div>
                          <div className="mt-3 grid gap-x-3 gap-y-3 sm:grid-cols-2 lg:grid-cols-12">
                            <div className="space-y-1.5 lg:col-span-4">
                              <Label htmlFor={"cd-item-" + i + "-description"} className="text-[12.5px] font-semibold text-foreground">
                                Description <span className="text-destructive">*</span>
                              </Label>
                              <input
                                id={"cd-item-" + i + "-description"}
                                value={it.description}
                                onChange={updateItem(i, "description")}
                                placeholder="e.g. Cotton t-shirt, leather handbag"
                                maxLength={300}
                                className={itemInputCls + " w-full"}
                              />
                              {fieldError(i, "description")}
                            </div>
                            <div className="space-y-1.5 lg:col-span-2">
                              <Label htmlFor={"cd-item-" + i + "-quantity"} className="text-[12.5px] font-semibold text-foreground">
                                Quantity <span className="text-destructive">*</span>
                              </Label>
                              <input
                                id={"cd-item-" + i + "-quantity"}
                                type="number"
                                min="1"
                                step="1"
                                value={it.quantity}
                                onChange={updateItem(i, "quantity")}
                                placeholder="1"
                                className={itemInputCls + " w-full"}
                              />
                              {fieldError(i, "quantity")}
                            </div>
                            <div className="space-y-1.5 lg:col-span-2">
                              <Label htmlFor={"cd-item-" + i + "-unitvalue"} className="text-[12.5px] font-semibold text-foreground">
                                Unit value (USD) <span className="text-destructive">*</span>
                              </Label>
                              <input
                                id={"cd-item-" + i + "-unitvalue"}
                                type="number"
                                min="0.01"
                                step="0.01"
                                value={it.unitValue}
                                onChange={updateItem(i, "unitValue")}
                                placeholder="0.00"
                                className={itemInputCls + " w-full"}
                              />
                              {fieldError(i, "unitValue")}
                            </div>
                            <div className="space-y-1.5 lg:col-span-2">
                              <Label htmlFor={"cd-item-" + i + "-origin"} className="text-[12.5px] font-semibold text-foreground">
                                Country of origin <span className="text-destructive">*</span>
                              </Label>
                              <input
                                id={"cd-item-" + i + "-origin"}
                                value={it.countryOfOrigin}
                                onChange={updateItem(i, "countryOfOrigin")}
                                placeholder="e.g. China, USA, UK"
                                maxLength={80}
                                className={itemInputCls + " w-full"}
                              />
                              {fieldError(i, "countryOfOrigin")}
                            </div>
                            <div className="space-y-1.5 lg:col-span-2">
                              <Label htmlFor={"cd-item-" + i + "-hscode"} className="text-[12.5px] font-semibold text-foreground">
                                HS code <span className="font-normal text-slate-400">(optional)</span>
                              </Label>
                              <input
                                id={"cd-item-" + i + "-hscode"}
                                value={it.hsCode}
                                onChange={updateItem(i, "hsCode")}
                                placeholder="e.g. 6109.10"
                                maxLength={20}
                                className={itemInputCls + " w-full"}
                              />
                              {fieldError(i, "hsCode")}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                      <p className="flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-400">
                        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        Customs applies to the destination country's rules — declarations are kept on file per package.
                      </p>
                      <button
                        type="submit"
                        disabled={dBusy}
                        className="inline-flex h-[46px] items-center gap-2 rounded-[10px] bg-accent px-6 text-[14.5px] font-bold text-accent-foreground shadow-sm transition hover:bg-accent/90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {dBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        {dBusy ? "Submitting…" : "Submit declaration"}
                      </button>
                    </div>
                  </>
                )}
              </form>
            ),
          )}
        </div>

        {/* My declarations */}
        <div className="mt-6 border-t border-border/70 pt-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Your declarations</h3>
            {declarations.data !== null && declarations.data.length > 0 && (
              <span className="text-[12px] text-slate-400">{declarations.data.length} on file</span>
            )}
          </div>
          <div className="mt-2.5">
            {declarations.error ? (
              <SectionError message={declarations.error} onRetry={declarations.reload} busy={declarations.busy} />
            ) : declarations.data === null ? (
              <div className="space-y-2">
                {Array.from({ length: 2 }).map((_, i) => (
                  <Skeleton key={i} className="h-[74px] w-full rounded-lg" />
                ))}
              </div>
            ) : declarations.data.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-5 text-center">
                <p className="text-[13.5px] font-semibold text-slate-600">No declarations yet</p>
                <p className="mx-auto mt-0.5 max-w-md text-[12.5px] leading-relaxed text-slate-400">
                  When a package is ready to ship, declare its contents here and our team reviews it before dispatch.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {declarations.data.map((row) => (
                  <DeclarationRow key={row._id || row.declarationId} row={row} />
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>

      {/* ============================ c. Restricted & prohibited items ============================ */}
      <section
        aria-label="Restricted and prohibited items"
        className="rounded-xl border border-[#e5eaf2] bg-white p-6 md:p-7"
      >
        <h2 className="flex items-center gap-2 font-display text-lg font-bold text-foreground">
          <TriangleAlert className="h-5 w-5 text-primary" /> Restricted & prohibited items
        </h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-muted-foreground">
          Some items can't travel through our warehouse — check before you buy.
        </p>

        <div className="mt-4">
          {restricted.error ? (
            <SectionError message={restricted.error} onRetry={restricted.reload} busy={restricted.busy} />
          ) : restricted.data === null ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-[46px] w-full rounded-lg" />
              ))}
            </div>
          ) : (restricted.data.categories || []).length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-surface/30 px-4 py-5 text-center">
              <p className="text-[13.5px] font-semibold text-slate-600">No restrictions listed right now</p>
              <p className="mx-auto mt-0.5 max-w-md text-[12.5px] leading-relaxed text-slate-400">
                Rules are advisory and confirmed per origin, destination and carrier before dispatch.
              </p>
            </div>
          ) : (
            <>
              <ul className="space-y-2">
                {(restricted.data.categories || []).map((cat) => (
                  <li
                    key={cat.code || cat.label}
                    className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-lg border border-[#e5eaf2] bg-surface/40 px-4 py-2.5"
                  >
                    <span className="text-[13.5px] font-bold text-foreground">{cat.label}</span>
                    <span className="min-w-0 flex-1 text-right text-[12.5px] leading-relaxed text-slate-500">
                      {cat.note}
                    </span>
                  </li>
                ))}
              </ul>
              {restricted.data.note && (
                <p className="mt-3 flex items-start gap-1.5 text-[12px] leading-relaxed text-slate-400">
                  <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  {restricted.data.note}
                </p>
              )}
            </>
          )}
        </div>
      </section>
    </div>
  );
}
