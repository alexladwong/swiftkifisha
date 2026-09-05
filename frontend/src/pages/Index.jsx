import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Wallet, Boxes, Lock, Radio, ShieldCheck, Globe2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/home/HeroSection";
import CalculatorTeaser from "@/components/home/CalculatorTeaser";
import SectionHeading from "@/components/home/SectionHeading";
import AuthDialog from "@/components/AuthDialog";
import { SHOP_HUBS } from "@/lib/intlData";

const STEPS = [
  {
    num: "01",
    title: "Create your free account",
    desc: "Two minutes, no card required. Your US and UK mailbox addresses are included.",
  },
  {
    num: "02",
    title: "Shop to your mailbox",
    desc: "Buy from stores that do not ship to you yet - they deliver straight to your personal suite.",
  },
  {
    num: "03",
    title: "We deliver to your door",
    desc: "We consolidate, clear customs and track every step until the box reaches you.",
  },
];

const BENEFITS = [
  {
    icon: MapPin,
    title: "Mailboxes in 7 hub countries",
    desc: "A personal suite number in the USA, UK, UAE, Germany, China, Singapore and Hong Kong - one membership.",
  },
  {
    icon: Wallet,
    title: "Fees you can see before you buy",
    desc: "Domestic quotes are distance and content based; international quotes are zone based. No hidden surcharges.",
  },
  {
    icon: Boxes,
    title: "Consolidation and customs handled",
    desc: "Combine several orders into one box, with repacking and customs paperwork taken care of for you.",
  },
];

const TRUST = [
  { icon: Lock, label: "Secure sign-in" },
  { icon: Radio, label: "Live tracking on every parcel" },
  { icon: ShieldCheck, label: "Consolidation and customs support" },
  { icon: Globe2, label: "Delivery to 50+ countries" },
];

const STORES = SHOP_HUBS.reduce((acc, hub) => {
  for (const s of hub.stores) {
    if (!acc.includes(s)) acc.push(s);
  }
  return acc;
}, []).slice(0, 8);

const fadeUp = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.45 },
};

export default function Index() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="overflow-x-clip bg-background">
      <HeroSection />

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-t border-border/60">
        <div className="shell-md py-20 md:py-28">
          <SectionHeading
            eyebrow="How it works"
            title="Three steps between you and any store"
            subtitle="No warehouse visits, no confusing forms. Just an address, your order, and your doorstep."
          />
          <ol className="mt-16 grid gap-x-12 gap-y-12 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.li key={step.num} {...fadeUp} transition={{ duration: 0.45, delay: i * 0.08 }}>
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-accent">{step.num}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-border/80" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-foreground">{step.title}</h3>
                <p className="mt-2.5 max-w-[320px] text-pretty text-[15px] leading-relaxed text-muted-foreground">{step.desc}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-heading" className="bg-surface/60">
        <div className="shell-md py-20 md:py-28">
          <SectionHeading
            eyebrow="Why SwiftKifisha"
            title="Quietly better cross-border shopping"
          />
          <div className="mt-14 grid gap-x-14 gap-y-12 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.title} {...fadeUp} transition={{ duration: 0.45, delay: i * 0.08 }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-white text-primary shadow-soft">
                  <b.icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <h3 className="mt-6 font-display text-[19px] font-bold tracking-tight text-foreground">{b.title}</h3>
                <p className="mt-2.5 max-w-[360px] text-pretty text-[15px] leading-relaxed text-muted-foreground">{b.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Interactive tool */}
      <CalculatorTeaser />

      {/* Trust */}
      <section aria-labelledby="trust-heading" className="border-b border-border/60">
        <div className="shell-md py-16 md:py-24">
          <div className="mx-auto max-w-[680px] text-center">
            <SectionHeading align="center" title="Built for serious cross-border shopping" />
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
            {TRUST.map((t, i) => (
              <motion.div key={t.label} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.05 }} className="flex items-center gap-3">
                <t.icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
                <span className="text-[15px] font-medium text-slate-700">{t.label}</span>
              </motion.div>
            ))}
          </div>
          <p className="mt-12 text-center text-[13px] font-medium text-slate-400">
            Shoppers at <span className="text-slate-500">{STORES.join(" · ")}</span> can send their orders to a SwiftKifisha mailbox.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-heading" className="bg-background">
        <div className="shell-md py-24 text-center md:py-32">
          <motion.div {...fadeUp} className="mx-auto max-w-[640px]">
            <h2 id="cta-heading" className="text-balance font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground md:text-[44px]">
              Ready to shop the world?
            </h2>
            <p className="mx-auto mt-5 max-w-[480px] text-pretty text-[16px] leading-[1.7] text-muted-foreground md:text-[17px]">
              Create your free account and get your US and UK mailbox addresses within minutes.
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => setAuthOpen(true)}
                className="h-[52px] w-full rounded-[10px] bg-accent px-8 text-base font-bold text-accent-foreground shadow-[0_14px_30px_-14px_hsl(25_95%_53%/0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto"
              >
                Create free account <ArrowRight className="ml-1.5" style={{ width: 18, height: 18 }} />
              </Button>
              <Link to="/shop-ship" className="w-full sm:w-auto">
                <Button variant="outline" className="h-[52px] w-full rounded-[10px] border-border bg-white px-8 text-base font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:w-auto">
                  Explore the mailboxes
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </section>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode="signup" />
    </div>
  );
}
