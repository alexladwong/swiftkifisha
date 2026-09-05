import { Package, Radio, ShieldCheck, Wallet, ArrowRight } from "lucide-react";
import { SHOP_HUBS } from "@/lib/intlData";

/**
 * Product visual: the SwiftKifisha mailbox concept rendered as a clean interface
 * card - no screenshots, no stock images, no invented numbers.
 */
export default function HeroVisual() {
  const us = SHOP_HUBS.find((h) => h.country === "United States");
  return (
    <div className="relative mx-auto w-full max-w-[520px]" aria-hidden="true">
      {/* faint containment ring */}
      <svg className="pointer-events-none absolute -inset-10 h-[calc(100%+80px)] w-[calc(100%+80px)] opacity-60" viewBox="0 0 600 600" fill="none">
        <circle cx="300" cy="300" r="290" stroke="hsl(224 76% 40% / 0.06)" strokeWidth="1.5" />
        <circle cx="300" cy="300" r="250" stroke="hsl(224 76% 40% / 0.05)" strokeWidth="1" />
        <circle cx="300" cy="300" r="210" stroke="hsl(25 95% 53% / 0.05)" strokeWidth="1" />
      </svg>

      <div className="relative rounded-2xl border border-border bg-white p-6 shadow-[0_24px_60px_-30px_rgba(15,23,42,0.35)] md:p-8">
        {/* header */}
        <div className="flex items-center justify-between border-b border-border/70 pb-5">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
              <Package className="h-5 w-5" strokeWidth={2} />
            </span>
            <div>
              <p className="font-display text-[15px] font-bold text-foreground">SwiftKifisha Mailbox</p>
              <p className="text-[13px] text-muted-foreground">New York, United States</p>
            </div>
          </div>
          <span className="rounded-md bg-surface-muted px-2.5 py-1 font-mono text-[12px] font-medium text-slate-500">
            SP-21084-US
          </span>
        </div>

        {/* journey */}
        <div className="py-6">
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.1em] text-slate-400">Your order</p>
          <div className="rounded-xl border border-border/70 bg-surface/60 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Any US store</p>
            <p className="text-[13px] text-muted-foreground">Ships to your personal suite</p>
          </div>

          <div className="my-4 flex items-center justify-center gap-3">
            <span className="text-[13px] font-semibold text-slate-500">New York</span>
            <span className="flex items-center gap-1 text-[11px] font-medium text-slate-300">
              ——— <ArrowRight className="h-3.5 w-3.5" /> ———
            </span>
            <span className="text-[13px] font-semibold text-slate-500">Kampala</span>
          </div>

          <div className="rounded-xl border border-border/70 bg-surface/60 px-4 py-3.5">
            <p className="text-sm font-semibold text-foreground">Delivered to your door</p>
            <p className="text-[13px] text-muted-foreground">Customs cleared · tracked end to end</p>
          </div>
        </div>

        {/* footer chips */}
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-border/70 pt-5">
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
            <Radio className="h-4 w-4 text-primary" /> Live tracking
          </span>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
            <Wallet className="h-4 w-4 text-primary" /> Transparent fees
          </span>
          <span className="flex items-center gap-1.5 text-[13px] font-medium text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Insured handling
          </span>
        </div>
      </div>

      {/* floating mini-address card (real address template, muted) */}
      <div className="absolute -bottom-6 -left-4 hidden max-w-[250px] rounded-xl border border-border bg-white px-4 py-3 shadow-[0_16px_36px_-22px_rgba(15,23,42,0.4)] sm:block">
        <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">Mailbox address</p>
        <p className="mt-1 text-[13px] font-medium leading-snug text-slate-700">
          {(us?.sample.lines[0] || "").replace("SP-100", "SP-21084")}
        </p>
        <p className="text-[12px] text-muted-foreground">{us?.sample.lines[1]}</p>
      </div>
      {/* floating route chip */}
      <div className="absolute -right-3 -top-4 hidden items-center gap-1.5 rounded-lg border border-border bg-white px-3 py-1.5 shadow-sm md:flex">
        <span className="text-base leading-none">{us?.flag}</span>
        <span className="text-[12px] font-semibold text-slate-600">USD fees · paid when you ship</span>
      </div>
    </div>
  );
}
