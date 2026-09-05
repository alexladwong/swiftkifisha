import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import { Package, Globe2, Wallet, Clock3, MapPin, ArrowRight } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import CopyButton from "@/components/portal/CopyButton";
import { fetchMyParcels } from "@/lib/portalApi";

const statusOf = (p) => {
  const cps = p?.checkpoints || [];
  return cps.length ? cps[cps.length - 1].status : "arrived";
};

export default function Overview() {
  const { user } = useSelector((state) => state.auth);
  const [parcels, setParcels] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    fetchMyParcels(8)
      .then((res) => alive && setParcels(res))
      .catch(() => alive && setError("Could not load your recent shipments."));
    return () => { alive = false; };
  }, []);

  const mailboxes = Array.isArray(user.hubAddresses) ? user.hubAddresses : [];

  return (
    <div className="mx-auto max-w-[1080px] space-y-8">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
          Welcome back{user.name ? ", " + user.name.split(" ")[0] : ""}
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Manage your account, mailboxes, shipments and security.
        </p>
      </header>

      {/* Summary strip */}
      <section aria-label="Account summary" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <Wallet className="h-3.5 w-3.5" /> Plan
          </p>
          <div className="mt-2 flex items-center gap-2">
            <Badge className="bg-accent/10 text-accent">{user.plan || "Saver"}</Badge>
            {user.memberCode && <span className="font-mono text-[12px] text-slate-400">{user.memberCode}</span>}
          </div>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <MapPin className="h-3.5 w-3.5" /> Home
          </p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">
            {user.homeCity || "Kampala"}, {user.homeCountry || "Uganda"}
          </p>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
          <p className="flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wider text-slate-400">
            <Globe2 className="h-3.5 w-3.5" /> Mailboxes
          </p>
          <p className="mt-2 text-[15px] font-semibold text-foreground">{mailboxes.length} assigned</p>
          <Link to="/account/addresses" className="mt-0.5 text-[13px] font-medium text-primary hover:underline">
            View addresses
          </Link>
        </div>
        <div className="rounded-xl border border-border bg-white p-5">
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
        <div className="flex flex-wrap gap-2.5">
          {[
            { label: "Estimate shipping", to: "/calculate" },
            { label: "Track a parcel", to: "/track" },
            { label: "Explore hub countries", to: "/shop-ship" },
            { label: "Contact support", to: "/contact" },
          ].map((a) => (
            <Link key={a.label} to={a.to} className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-white px-4 py-2.5 text-sm font-semibold text-foreground transition-colors hover:border-primary/30 hover:text-primary">
              {a.label} <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          ))}
        </div>
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
          <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
            <Package className="h-10 w-10 text-slate-200" />
            <p className="mt-4 font-display text-base font-bold text-foreground">No shipments yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted-foreground">
              Once you shop to your mailbox and we ship to you, your parcels will appear here.
            </p>
            <Link to="/shop-ship" className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">
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
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[13px] font-medium">{p.trackingId}</span>
                        <CopyButton value={p.trackingId} label="Copy" />
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