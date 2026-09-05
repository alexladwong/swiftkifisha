import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { MapPin, Search, Copy, FileText } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import CopyButton from "@/components/portal/CopyButton";
import { fetchMe } from "@/lib/portalApi";
import { SHOP_HUBS } from "@/lib/intlData";

export default function AddressesSection() {
  const [member, setMember] = useState(null);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchMe().then((m) => {
      setMember(m);
      setSelected(m.hubAddresses?.[0] || null);
    }).catch(() => setError("Could not load your addresses."));
  }, []);

  const mailboxes = member?.hubAddresses || [];
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return mailboxes;
    return mailboxes.filter((m) =>
      (m.country + " " + m.city + " " + m.suite + " " + (m.addressLines || []).join(" ")).toLowerCase().includes(q),
    );
  }, [mailboxes, query]);

  const hubMeta = (country) => SHOP_HUBS.find((h) => h.country === country);
  const current = mailboxes.find((m) => m.country === selected?.country) || selected;

  const copyAll = async () => {
    if (!current) return;
    const lines = [
      "SwiftKifisha Mailbox - " + current.country,
      ...(current.addressLines || []),
      "Suite: " + current.suite,
    ];
    await navigator.clipboard.writeText(lines.join("\n"));
    toast.success("Address copied to clipboard");
  };

  if (error) {
    return <p className="rounded-lg border border-destructive/20 bg-destructive/5 px-4 py-3 text-sm text-destructive">{error}</p>;
  }
  if (!member) {
    return <div className="grid gap-6 lg:grid-cols-2"><Skeleton className="h-96 w-full rounded-xl" /><Skeleton className="h-96 w-full rounded-xl" /></div>;
  }

  return (
    <div className="mx-auto w-full max-w-[1180px] space-y-6">
      <header>
        <h1 className="font-display text-2xl font-extrabold tracking-tight text-foreground md:text-[28px]">My Addresses</h1>
        <p className="mt-1 text-[15px] text-muted-foreground">
          Your assigned SwiftKifisha mailbox addresses. Use these when you shop online.
        </p>
      </header>

      {mailboxes.length === 0 ? (
        <div className="flex flex-col items-center rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
          <MapPin className="h-10 w-10 text-slate-200" />
          <p className="mt-4 font-display text-base font-bold text-foreground">No mailboxes assigned yet</p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            Mailboxes are granted when you create your account. Contact support if this looks wrong.
          </p>
          <Link to="/contact" className="mt-5 rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">
            Contact support
          </Link>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[minmax(260px,340px)_1fr]">
          {/* List pane */}
          <div className="space-y-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search addresses"
                aria-label="Search addresses"
                className="h-11 rounded-[10px] border-border bg-white pl-10"
              />
            </div>
            <div role="list" aria-label="Mailbox addresses" className="space-y-2">
              {filtered.map((mb) => {
                const meta = hubMeta(mb.country);
                const active = current?.country === mb.country;
                return (
                  <button
                    key={mb.country}
                    type="button"
                    role="listitem"
                    onClick={() => setSelected(mb)}
                    aria-pressed={active}
                    className={
                      "flex w-full items-center gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors " +
                      (active ? "border-primary/30 bg-primary/5" : "border-border bg-white hover:border-slate-300")
                    }
                  >
                    <span className="text-xl leading-none">{meta ? meta.flag : "📦"}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-bold text-foreground">{mb.country}</span>
                      <span className="block truncate text-[13px] text-muted-foreground">{mb.city} · {mb.suite}</span>
                    </span>
                    {active && <span className="h-2 w-2 rounded-full bg-primary" aria-hidden="true" />}
                  </button>
                );
              })}
              {filtered.length === 0 && (
                <p className="rounded-xl border border-dashed border-border bg-white px-4 py-8 text-center text-sm text-muted-foreground">
                  No address matches "{query}".
                </p>
              )}
            </div>
          </div>

          {/* Detail pane */}
          <div className="rounded-xl border border-border bg-white p-6 md:p-8">
            {current ? (
              <>
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/70 pb-5">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl leading-none">{hubMeta(current.country)?.flag}</span>
                    <div>
                      <p className="font-display text-lg font-bold text-foreground">{current.country}</p>
                      <p className="text-sm text-muted-foreground">{current.city} hub · member mailbox</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={copyAll}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-3.5 text-[13px] font-bold text-primary-foreground hover:bg-primary/95"
                  >
                    <Copy className="h-3.5 w-3.5" /> Copy all
                  </button>
                </div>

                <dl className="divide-y divide-border/60">
                  <div className="flex items-center justify-between gap-4 py-4">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Mailbox name</dt>
                    <dd className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-foreground">SwiftKifisha Mailroom — {current.country}</span>
                      <CopyButton value={"SwiftKifisha Mailroom - " + current.country} label="Copy" />
                    </dd>
                  </div>
                  {(current.addressLines || []).map((line, i) => (
                    <div key={line} className="flex items-center justify-between gap-4 py-4">
                      <dt className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MapPin className="h-4 w-4" /> Address line {i + 1}
                      </dt>
                      <dd className="flex items-center gap-2">
                        <span className="text-right text-sm font-semibold text-foreground">{line}</span>
                        <CopyButton value={line} label="Copy" />
                      </dd>
                    </div>
                  ))}
                  <div className="flex items-center justify-between gap-4 py-4">
                    <dt className="flex items-center gap-2 text-sm text-muted-foreground"><FileText className="h-4 w-4" /> Your suite</dt>
                    <dd className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold text-foreground">{current.suite}</span>
                      <CopyButton value={current.suite} label="Copy" />
                    </dd>
                  </div>
                </dl>

                <div className="mt-5 rounded-xl bg-surface/70 px-4 py-3.5 text-[13px] leading-relaxed text-slate-500">
                  SwiftKifisha mailboxes are service addresses assigned to your membership - they cannot be edited or
                  deleted from here.{" "}
                  <Link to="/contact" className="font-semibold text-primary hover:underline">Ask support</Link> to change or add hubs.
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}