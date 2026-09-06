import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import {
  Package, Globe2, Wallet, Clock3, MapPin, ArrowRight, PackageOpen, BellRing, Truck, PackageCheck,
  TriangleAlert,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import CopyButton from "@/components/portal/CopyButton";
import ParcelQR from "@/components/ParcelQR";
import { fetchMyParcels, fetchOverviewStats } from "@/lib/portalApi";

const statusOf = (p) => {
  const cps = p?.checkpoints || [];
  return cps.length ? cps[cps.length - 1].status : "arrived";
};

export default function Overview() {
  const { user } = useSelector((state) => state.auth);
  const [parcels, setParcels] = useState(null);
  const [error, setError] = useState("");
  const [stats, setStats] = useState(null);

  useEffect(() => {
    let alive = true;
    fetchMyParcels(8)
      .then((res) => alive && setParcels(res))
      .catch(() => alive && setError("Could not load your recent shipments."));
    return () => { alive = false; };
  }, []);

  // Packages strip is a nice-to-have: failures degrade silently to "—".
  useEffect(() => {
    let alive = true;
    fetchOverviewStats()
      .then((s) => alive && setStats(s))
      .catch(() => { /* silent — the rest of the overview keeps working */ });
    return () => { alive = false; };
  }, []);

  const mailboxes = Array.isArray(user.hubAddresses) ? user.hubAddresses : [];

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
          Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Manage your account, addresses and shipments from one place.
        </p>
      </header>

      {/* Summary strip */}
      <section aria-label="Account summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <Wallet className="h-3.5 w-3.5" /> Plan
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-accent/10 text-accent">{user.plan || "Saver"}</Badge>
            {user.memberCode && <span className="font-mono text-[12px] text-slate-400">{user.memberCode}</span>}
          </div>
        </div>
        <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <MapPin className="h-3.5 w-3.5" /> Home
          </p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">
            {user.homeCity || "Kampala"}, {user.homeCountry || "Uganda"}
          </p>
        </div>
        <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <Globe2 className="h-3.5 w-3.5" /> Mailboxes
          </p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">{mailboxes.length} assigned</p>
          <Link to="/account/addresses" className="mt-0.5 text-[13px] font-medium text-primary hover:underline">
            View addresses
          </Link>
        </div>
        <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <Package className="h-3.5 w-3.5" /> Shipments
          </p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">{parcels ? parcels.total : "—"}</p>
          <Link to="/track" className="mt-0.5 text-[13px] font-medium text-primary hover:underline">
            Track a parcel
          </Link>
        </div>
      </section>

      {/* Quick actions */}
      <section aria-label="Quick actions">
        <h2 className="mb-3 font-display text-lg font-bold text-foreground">Quick actions</h2>
<div className="flex flex-wrap items-center gap-2.5">
          <Link to="/calculate" className="inline-flex h-11 items-center gap-1.5 rounded-lg bg-accent px-5 text-sm font-bold text-white shadow-sm transition-all duration-150 hover:-translate-y-0.5 hover:bg-accent/90">
            Estimate shipping <ArrowRight className="h-4 w-4" />
          </Link>
          {[
            { label: "Pre-alert a package", to: "/account/packages/pre-alert" },
            { label: "Track a parcel", to: "/track" },
            { label: "Explore hub countries", to: "/shop-ship" },
            { label: "Contact support", to: "/contact" },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#e5eaf2] bg-white px-4 text-sm font-semibold text-slate-700 transition-colors hover:border-primary/30 hover:text-primary">
              {a.label}
            </Link>
          ))}
        </div>
      </section>

      {/* Packages — real counts from the package service */}
      <section aria-label="Packages overview">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Packages</h2>
          <Link to="/account/packages" className="text-[13px] font-semibold text-primary hover:underline">
            View all packages
          </Link>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              <PackageOpen className="h-3.5 w-3.5" /> At warehouse
            </p>
            <p className="mt-2 font-display text-[26px] font-extrabold leading-none text-foreground">
              {stats ? stats.packagesReceived : "—"}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">Received parcels waiting at your mailbox</p>
          </div>
          <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              <BellRing className="h-3.5 w-3.5" /> Awaiting action
            </p>
            <p className={"mt-2 font-display text-[26px] font-extrabold leading-none " + (stats && stats.awaitingAction > 0 ? "text-amber-600" : "text-foreground")}>
              {stats ? stats.awaitingAction : "—"}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">
              {stats && stats.awaitingAction > 0 ? (
                <Link to="/account/packages" className="font-semibold text-primary hover:underline">Respond now</Link>
              ) : (
                "Nothing waiting for your input"
              )}
            </p>
          </div>
          <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              <Truck className="h-3.5 w-3.5" /> In transit
            </p>
            <p className="mt-2 font-display text-[26px] font-extrabold leading-none text-foreground">
              {stats && stats.packagesInTransit > 0 ? stats.packagesInTransit : "—"}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">Transit tracking follows dispatch</p>
          </div>
          <div className="rounded-xl border-[#e5eaf2] bg-white p-[22px]">
            <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
              <PackageCheck className="h-3.5 w-3.5" /> Delivered
            </p>
            <p className="mt-2 font-display text-[26px] font-extrabold leading-none text-foreground">
              {stats ? stats.delivered : "—"}
            </p>
            <p className="mt-2 text-[12px] text-slate-400">Parcels handed over to the courier</p>
          </div>
        </div>

        {stats && stats.actionRequired && stats.actionRequired.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200/80 bg-white p-5">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-50">
                <TriangleAlert className="h-4 w-4 text-amber-500" />
              </span>
              <h3 className="font-display text-[15px] font-bold text-foreground">Action required</h3>
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[12px] font-bold text-amber-800">
                {stats.actionRequired.length}
              </span>
            </div>
            <ul className="mt-3 space-y-3">
              {stats.actionRequired.map((r) => (
                <li key={r.packageId} className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/70 bg-surface/40 px-4 py-3">
                  <div className="min-w-0">
                    <Link
                      to={"/account/packages/" + r.packageId}
                      className="font-mono text-[13.5px] font-bold text-primary hover:underline"
                    >
                      {r.packageId}
                    </Link>
                    {r.reasons && r.reasons.length > 0 && (
                      <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {r.reasons.map((reason) => (
                          <span key={reason} className="inline-flex items-center gap-1.5 text-[13px] text-slate-600">
                            <span className="h-1 w-1 rounded-full bg-amber-400" aria-hidden="true" />
                            {reason}
                          </span>
                        ))}
                      </p>
                    )}
                  </div>
                  <Link
                    to={"/account/packages/" + r.packageId}
                    className="inline-flex items-center gap-1 text-[13px] font-bold text-primary hover:underline"
                  >
                    Review <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* Recent shipments */}
      <section aria-label="Recent shipments">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">Recent shipments</h2>
          {parcels && parcels.total > 8 && (
            <span className="text-[13px] text-slate-400">Showing latest 8 of {parcels.total}</span>
          )}
        </div>

        {error && <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>}

        {!parcels && !error && (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-14 w-full rounded-lg" />
            ))}
          </div>
        )}

        {parcels && parcels.data.length === 0 && (
<div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-8 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-muted">
              <Package className="h-5 w-5 text-slate-300" />
            </span>
            <p className="mt-3 font-display text-[15px] font-bold text-foreground">No shipments yet</p>
            <p className="mt-1 max-w-sm text-[13px] leading-relaxed text-muted-foreground">
              Your recent shipments will appear here once a parcel is sent from one of your mailboxes.
            </p>
            <Link to="/shop-ship" className="mt-4 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">
              Start with your mailbox
            </Link>
          </div>
        )}

        {parcels && parcels.data.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border bg-white">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border/70 bg-surface/50 text-[12px] font-bold uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Tracking ID</th>
                  <th className="hidden px-5 py-3 md:table-cell">Route</th>
                  <th className="hidden px-5 py-3 sm:table-cell">Store</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="hidden px-5 py-3 lg:table-cell">Created</th>
                </tr>
              </thead>
              <tbody>
                {parcels.data.map((p) => (
                  <tr key={p._id} className="border-b border-border/50 last:border-0 hover:bg-surface/40">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-mono text-[13px] font-medium">{p.trackingId}</span>
                        <CopyButton value={p.trackingId} label="Copy" />
                        <ParcelQR trackingId={p.trackingId} variant="button" />
                      </div>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 md:table-cell">
                      {p.originCity} → {p.destinationCity}
                    </td>
                    <td className="hidden px-5 py-3 text-slate-600 sm:table-cell">{p.storeName || p.senderName}</td>
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold capitalize text-slate-600">
                        {statusOf(p).replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="hidden px-5 py-3 text-slate-500 lg:table-cell">
                      {new Date(p.createdAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <span className="flex items-center gap-1.5 text-[13px] text-slate-400"><Clock3 className="h-3.5 w-3.5" /> Shipments shown are from your account only.</span>
    </div>
  );
}