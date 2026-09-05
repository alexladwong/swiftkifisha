import { useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { MapPin, Wallet, Boxes, Lock, Radio, ShieldCheck, Globe2, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroSection from "@/components/home/HeroSection";
import CalculatorTeaser from "@/components/home/CalculatorTeaser";
import SectionHeading from "@/components/home/SectionHeading";
import AuthDialog from "@/components/AuthDialog";
import { useI18n } from "@/i18n";
import { SHOP_HUBS } from "@/lib/intlData";

const STEPS = [
  { num: "01", titleKey: "home.step1Title", descKey: "home.step1Desc" },
  { num: "02", titleKey: "home.step2Title", descKey: "home.step2Desc" },
  { num: "03", titleKey: "home.step3Title", descKey: "home.step3Desc" },
];

const BENEFITS = [
  { icon: MapPin, titleKey: "home.benefit1Title", descKey: "home.benefit1Desc" },
  { icon: Wallet, titleKey: "home.benefit2Title", descKey: "home.benefit2Desc" },
  { icon: Boxes, titleKey: "home.benefit3Title", descKey: "home.benefit3Desc" },
];

const TRUST = [
  { icon: Lock, labelKey: "home.trust1" },
  { icon: Radio, labelKey: "home.trust2" },
  { icon: ShieldCheck, labelKey: "home.trust3" },
  { icon: Globe2, labelKey: "home.trust4" },
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
  const { t } = useI18n();
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <div className="overflow-x-clip bg-background">
      <HeroSection />

      {/* How it works */}
      <section aria-labelledby="how-heading" className="border-t border-border/60">
        <div className="shell-md py-20 md:py-28">
          <SectionHeading
            eyebrow={t("home.stepsEyebrow")}
            title={t("home.stepsTitle")}
            subtitle={t("home.stepsSubtitle")}
          />
          <ol className="mt-16 grid gap-x-12 gap-y-12 md:grid-cols-3">
            {STEPS.map((step, i) => (
              <motion.li key={step.num} {...fadeUp} transition={{ duration: 0.45, delay: i * 0.08 }}>
                <div className="flex items-baseline gap-4">
                  <span className="font-display text-[15px] font-extrabold tracking-tight text-accent">{step.num}</span>
                  <span aria-hidden="true" className="h-px flex-1 bg-border/80" />
                </div>
                <h3 className="mt-5 font-display text-xl font-bold tracking-tight text-foreground">{t(step.titleKey)}</h3>
                <p className="mt-2.5 max-w-[320px] text-pretty text-[15px] leading-relaxed text-muted-foreground">{t(step.descKey)}</p>
              </motion.li>
            ))}
          </ol>
        </div>
      </section>

      {/* Benefits */}
      <section aria-labelledby="benefits-heading" className="bg-surface/60">
        <div className="shell-md py-20 md:py-28">
          <SectionHeading
            eyebrow={t("home.benefitsEyebrow")}
            title={t("home.benefitsTitle")}
          />
          <div className="mt-14 grid gap-x-14 gap-y-12 md:grid-cols-3">
            {BENEFITS.map((b, i) => (
              <motion.div key={b.titleKey} {...fadeUp} transition={{ duration: 0.45, delay: i * 0.08 }}>
                <span className="flex h-12 w-12 items-center justify-center rounded-[10px] border border-border bg-white text-primary shadow-soft">
                  <b.icon className="h-6 w-6" strokeWidth={1.8} />
                </span>
                <h3 className="mt-6 font-display text-[19px] font-bold tracking-tight text-foreground">{t(b.titleKey)}</h3>
                <p className="mt-2.5 max-w-[360px] text-pretty text-[15px] leading-relaxed text-muted-foreground">{t(b.descKey)}</p>
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
            <SectionHeading align="center" title={t("home.trustHeading")} />
          </div>
          <div className="mx-auto mt-12 grid max-w-3xl grid-cols-1 gap-x-12 gap-y-6 sm:grid-cols-2">
            {TRUST.map((item, i) => (
              <motion.div key={item.labelKey} {...fadeUp} transition={{ duration: 0.4, delay: i * 0.05 }} className="flex items-center gap-3">
                <item.icon className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.9} />
                <span className="text-[15px] font-medium text-slate-700">{t(item.labelKey)}</span>
              </motion.div>
            ))}
          </div>
          <p className="mt-12 text-center text-[13px] font-medium text-slate-400">
            {t("home.shopperBefore")} <span className="text-slate-500">{STORES.join(" · ")}</span> {t("home.shopperAfter")}
          </p>
        </div>
      </section>

      {/* CTA */}
      <section aria-labelledby="cta-heading" className="bg-background">
        <div className="shell-md py-24 text-center md:py-32">
          <motion.div {...fadeUp} className="mx-auto max-w-[640px]">
            <h2 id="cta-heading" className="text-balance font-display text-3xl font-extrabold leading-[1.12] tracking-tight text-foreground md:text-[44px]">
              {t("home.ctaTitle")}
            </h2>
            <p className="mx-auto mt-5 max-w-[480px] text-pretty text-[16px] leading-[1.7] text-muted-foreground md:text-[17px]">
              {t("home.ctaSubtitle")}
            </p>
            <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                onClick={() => setAuthOpen(true)}
                className="h-[52px] w-full rounded-[10px] bg-accent px-8 text-base font-bold text-accent-foreground shadow-[0_14px_30px_-14px_hsl(25_95%_53%/0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto"
              >
                {t("home.ctaPrimary")} <ArrowRight className="ms-1.5" style={{ width: 18, height: 18 }} />
              </Button>
              <Link to="/shop-ship" className="w-full sm:w-auto">
                <Button variant="outline" className="h-[52px] w-full rounded-[10px] border-border bg-white px-8 text-base font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:w-auto">
                  {t("home.ctaSecondary")}
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
