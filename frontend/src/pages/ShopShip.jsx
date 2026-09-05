import { useMemo } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Globe2, MapPin, ShoppingBag, PackageCheck, CreditCard, Truck, Sparkles,
  ArrowRight, ShieldCheck, Repeat, Camera, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useI18n } from "@/i18n";
import { SHOP_HUBS, WORLD_COUNTRIES, MEMBER_PLANS, formatMoney } from "@/lib/intlData";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const steps = [
  { icon: CreditCard, titleKey: "shop.step1Title", descKey: "shop.step1Desc" },
  { icon: MapPin, titleKey: "shop.step2Title", descKey: "shop.step2Desc" },
  { icon: ShoppingBag, titleKey: "shop.step3Title", descKey: "shop.step3Desc" },
  { icon: PackageCheck, titleKey: "shop.step4Title", descKey: "shop.step4Desc" },
];

const services = [
  { icon: Globe2, titleKey: "shop.svc1Title", descKey: "shop.svc1Desc" },
  { icon: PackageCheck, titleKey: "shop.svc2Title", descKey: "shop.svc2Desc" },
  { icon: Repeat, titleKey: "shop.svc3Title", descKey: "shop.svc3Desc" },
  { icon: ShieldCheck, titleKey: "shop.svc4Title", descKey: "shop.svc4Desc" },
];

const ShopShip = () => {
  const { t } = useI18n();
  const totalCountries = useMemo(() => WORLD_COUNTRIES.length, []);
  return (
    <div className="min-h-screen pb-20 pt-8 md:pt-14">
      <div className="container mx-auto px-4 md:px-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 gap-1.5 px-3 py-1 text-accent border-accent/30">
            <Sparkles className="h-3.5 w-3.5" /> {t("shop.badge")}
          </Badge>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground leading-tight">
            {t("shop.heroTitleA")} <span className="text-accent">{t("shop.heroTitleAccent")}</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            {t("shop.heroSubtitleStart")}{" "}
            <span className="font-semibold text-foreground">{totalCountries}{t("shop.heroSubtitleCountries")}</span>.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/calculate">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <Globe2 className="mr-2 h-4 w-4" /> {t("shop.ctaEstimate")}
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="font-semibold border-accent/30">
                {t("shop.ctaBecomeMember")}
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Hub country cards */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("shop.hubsTitle")}</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">{t("shop.hubsSubtitle")}</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {SHOP_HUBS.map((hub, i) => (
              <motion.div key={hub.id} {...fadeUp} transition={{ delay: (i % 3) * 0.08 }}>
                <Card className="h-full border-border/50 shadow-sm hover:shadow-lg transition-shadow overflow-hidden">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="text-3xl">{hub.flag}</span>
                        <div>
                          <p className="font-display font-bold text-foreground">{hub.country}</p>
                          <p className="text-xs text-muted-foreground">{t("shop.hubCity", { city: hub.city })}</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium bg-muted rounded-full px-2 py-1">
                        {t("shop.hubFromFee", { fee: formatMoney(hub.pickupFee, "USD") })}
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/60 border border-border/60 p-3 text-xs space-y-0.5 font-mono">
                      <p className="font-semibold text-foreground">{hub.sample.name}</p>
                      {hub.sample.lines.map((l) => (
                        <p key={l} className="text-muted-foreground">{l}</p>
                      ))}
                      <p className="pt-1 text-accent font-sans font-medium">{t("shop.hubSuite", { suite: "SP-XXXXX-" + hub.id })}</p>
                    </div>
                    <ul className="space-y-1.5 text-sm text-muted-foreground flex-1">
                      {hub.perks.map((p) => (
                        <li key={p} className="flex gap-2">
                          <ChevronRight className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          {p}
                        </li>
                      ))}
                    </ul>
                    <p className="text-xs text-muted-foreground border-t border-border/60 pt-3">
                      <ShoppingBag className="h-3.5 w-3.5 inline mr-1 text-accent" />
                      {t("shop.hubPopularStores", { stores: hub.stores.slice(0, 3).join(" · ") })}
                    </p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* How it works */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("shop.howTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("shop.howSubtitle")}</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.titleKey} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="h-full border-border/50 shadow-sm text-center">
                  <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">{t(step.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(step.descKey)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Service differentiators */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("shop.includedTitle")}</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <motion.div key={s.titleKey} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <Card className="h-full border-border/50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground mb-2">{t(s.titleKey)}</h3>
                    <p className="text-sm text-muted-foreground">{t(s.descKey)}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">{t("shop.plansTitle")}</h2>
            <p className="mt-2 text-muted-foreground">{t("shop.plansSubtitle")}</p>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {MEMBER_PLANS.map((p, i) => (
              <motion.div key={p.id} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <Card className={`h-full border-border/50 shadow-sm ${p.id === "Classic" ? "ring-2 ring-accent/40" : ""}`}>
                  <CardContent className="p-6 flex flex-col gap-3">
                    <p className="font-display text-xl font-bold text-foreground">{p.id}</p>
                    <p className="text-sm text-muted-foreground">{p.blurb}</p>
                    <ul className="space-y-1.5 text-sm text-muted-foreground flex-1">
                      {p.perks.map((perk) => (
                        <li key={perk} className="flex gap-2">
                          <ShieldCheck className="h-4 w-4 text-accent shrink-0 mt-0.5" />
                          {perk}
                        </li>
                      ))}
                    </ul>
                    <Link to="/contact" className="mt-2">
                      <Button variant={p.id === "Classic" ? "default" : "outline"} className="w-full">
                        {t("shop.choosePlan", { plan: p.id })} <ArrowRight className="ml-1 h-4 w-4" />
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Coverage strip */}
        <motion.div {...fadeUp}>
          <Card className="border-border/50 shadow-sm bg-gradient-to-r from-primary/5 via-background to-accent/10">
            <CardContent className="p-8 flex flex-col items-center gap-4">
              <Truck className="h-8 w-8 text-accent" />
              <h2 className="font-display text-2xl font-bold text-foreground text-center">
                {t("shop.coverageTitle", { count: totalCountries })}
              </h2>
              <p className="text-center text-sm text-muted-foreground max-w-2xl">
                {t("shop.coverageDesc")}
              </p>
              <div className="flex flex-wrap justify-center gap-1.5 max-w-3xl">
                {WORLD_COUNTRIES.map((c) => (
                  <span key={c} className="text-xs bg-background border border-border rounded-full px-2.5 py-0.5 text-muted-foreground">
                    {c}
                  </span>
                ))}
              </div>
              <Link to="/calculate" className="mt-2">
                <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                  <Globe2 className="mr-2 h-4 w-4" /> {t("shop.coverageCta")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          {t("shop.disclaimer")}
        </div>
      </div>
    </div>
  );
};

export default ShopShip;
