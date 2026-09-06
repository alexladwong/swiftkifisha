import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Mailbox, RefreshCw, FileText } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import CopyButton from "@/components/portal/CopyButton";
import { fetchMailboxes } from "@/lib/portalApi";

export default function MailboxesPage() {
  const [mailboxes, setMailboxes] = useState(null);
  const [error, setError] = useState("");

  const load = () => {
    setError("");
    setMailboxes(null);
    fetchMailboxes()
      .then((rows) => setMailboxes(rows))
      .catch(() => setError("Could not load your mailboxes. Please try again."));
  };

  useEffect(() => {
    let alive = true;
    fetchMailboxes()
      .then((rows) => alive && setMailboxes(rows))
      .catch(() => alive && setError("Could not load your mailboxes. Please try again."));
    return () => {
      alive = false;
    };
  }, []);

  const fullAddress = (mb) =>
    [
      mb.recipientName,
      mb.suite,
      ...(mb.addressLines || []),
      [mb.city, mb.country].filter(Boolean).join(", "),
    ]
      .filter((l) => String(l).trim())
      .join("\n");

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">
          My Mailboxes
        </h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Your operational mailbox addresses — use these when shopping online.
        </p>
      </header>

      {error && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          <p>{error}</p>
          <button
            type="button"
            onClick={load}
            className="inline-flex h-8 items-center gap-1.5 rounded-md border border-destructive/25 px-3 text-[12px] font-bold text-destructive transition-colors hover:bg-destructive/10"
          >
            <RefreshCw className="h-3.5 w-3.5" /> Retry
          </button>
        </div>
      )}

      {!mailboxes && !error && (
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-xl" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      )}

      {mailboxes && mailboxes.length === 0 && (
        <div className="flex min-h-[300px] flex-col items-center justify-center rounded-xl border border-dashed border-border bg-white px-6 py-12 text-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-muted">
            <Mailbox className="h-6 w-6 text-slate-300" />
          </span>
          <p className="mt-4 font-display text-lg font-bold text-foreground">No mailboxes assigned yet</p>
          <p className="mt-1 max-w-md text-sm leading-relaxed text-muted-foreground">
            Your mailbox is assigned once membership is approved — we'll email you the moment it's ready.
            If you believe this is a mistake, contact support.
          </p>
          <Link to="/contact" className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">
            Contact support
          </Link>
        </div>
      )}

      {mailboxes && mailboxes.length > 0 && (
        <div className="grid items-start gap-6 md:grid-cols-2">
          {mailboxes.map((mb) => (
            <article key={mb.country} className="rounded-xl border border-[#e5eaf2] bg-white p-6">
              {/* Warehouse country / city header */}
              <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
                <div className="flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                    <MapPin className="h-5 w-5" />
                  </span>
                  <div>
                    <h2 className="font-display text-lg font-bold text-foreground">{mb.country}</h2>
                    <p className="text-[13px] text-muted-foreground">
                      {(mb.city ? mb.city + " warehouse" : "Warehouse") +
                        (mb.warehouseId ? "" : " · details coming soon")}
                    </p>
                  </div>
                </div>
                <CopyButton
                  value={fullAddress(mb)}
                  label="Copy address"
                  className="shrink-0"
                />
              </div>

              <dl className="divide-y divide-border/60">
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <FileText className="h-4 w-4" /> Recipient name
                  </dt>
                  <dd className="flex items-center gap-2 text-right">
                    <span className="text-sm font-semibold text-foreground">{mb.recipientName}</span>
                    <CopyButton value={mb.recipientName} label="Copy" />
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-4 py-3.5">
                  <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mailbox className="h-4 w-4" /> Your suite
                  </dt>
                  <dd className="flex items-center gap-2 text-right">
                    <span className="font-mono text-sm font-semibold text-foreground">{mb.suite}</span>
                    <CopyButton value={mb.suite} label="Copy" />
                  </dd>
                </div>
                {(mb.addressLines || []).map((line, i) => (
                  <div key={line} className="flex items-center justify-between gap-4 py-3.5">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4" /> Address line {i + 1}
                    </dt>
                    <dd className="flex items-center gap-2 text-right">
                      <span className="text-sm font-semibold text-foreground">{line}</span>
                      <CopyButton value={line} label="Copy" />
                    </dd>
                  </div>
                ))}
              </dl>

              {mb.instructions && (
                <div className="mt-3 rounded-xl bg-surface/70 px-4 py-3.5 text-[13px] leading-relaxed text-slate-500">
                  {mb.instructions}
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
