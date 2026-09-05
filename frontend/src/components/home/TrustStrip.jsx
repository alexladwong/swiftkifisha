import { SHOP_HUBS } from "@/lib/intlData";

// Stores you can buy from through our mailboxes — real data from the hubs.
const STORES = SHOP_HUBS.reduce((acc, hub) => {
  for (const s of hub.stores.slice(0, 2)) {
    if (!acc.includes(s)) acc.push(s);
  }
  return acc;
}, []).slice(0, 9);

const wordmark = (name) => name.replace(/.(com|co.uk|ae|de|sg)$/i, "");

export default function TrustStrip() {
  return (
    <section aria-label="Stores you can shop from" className="border-y border-border/70 bg-white">
      <div className="shell py-8">
        <p className="text-center text-[13px] font-medium text-slate-400">
          Shop any store that ships to your SwiftUg mailbox — including
        </p>
        <ul className="mt-5 flex flex-wrap items-center justify-center gap-x-9 gap-y-4">
          {STORES.map((s) => (
            <li key={s} className="flex items-center gap-1.5 font-display text-[17px] font-bold tracking-tight text-slate-300 transition-colors duration-200 hover:text-slate-500" title={s}>
              <span className="opacity-90">{wordmark(s)}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
