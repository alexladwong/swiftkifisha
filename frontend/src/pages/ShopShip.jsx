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
import { SHOP_HUBS, WORLD_COUNTRIES, MEMBER_PLANS, formatMoney } from "@/lib/intlData";

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const steps = [
  { icon: CreditCard, title: "1. Create your free account", desc: "Sign up in two minutes and choose your plan. No credit card needed to get started." },
  { icon: MapPin, title: "2. Get your international address", desc: "We assign you a personal mailbox with a suite number in the USA, UK, UAE and more." },
  { icon: ShoppingBag, title: "3. Shop any store, anywhere", desc: "Use your SwiftUg address at checkout. We receive your packages at our hub." },
  { icon: PackageCheck, title: "4. We consolidate & ship to your door", desc: "Combine parcels, save on fees, and track every step until it reaches you — worldwide." },
];

const services = [
  { icon: Globe2, title: "Shop the world", desc: "Access stores that don't ship to your country. If it's sold in a hub country, you can buy it." },
  { icon: PackageCheck, title: "Consolidation", desc: "Bundle several orders into one shipment and pay one international fee." },
  { icon: Repeat, title: "Repacking & photos", desc: "We remove extra packaging, take photos on request and protect fragile buys." },
  { icon: ShieldCheck, title: "Customs made easy", desc: "Prepared customs paperwork, clear guidance and door delivery, duties handled transparently." },
];

const ShopShip = () => {
  const totalCountries = useMemo(() => WORLD_COUNTRIES.length, []);
  return (
    <div className="min-h-screen pt-24 pb-20">
      <div className="container mx-auto px-4 md:px-6">
        {/* Hero */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center max-w-3xl mx-auto mb-16">
          <Badge variant="outline" className="mb-4 gap-1.5 px-3 py-1 text-accent border-accent/30">
            <Sparkles className="h-3.5 w-3.5" /> SwiftUg Shop &amp; Ship
          </Badge>
          <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground leading-tight">
            One membership. <span className="text-accent">Addresses around the world.</span>
          </h1>
          <p className="mt-4 text-lg text-muted-foreground">
            Shop any US, UK, UAE, German, Chinese, Singaporean or Hong Kong store. We receive your
            orders at your personal mailbox, consolidate them, and ship to your door in{" "}
            <span className="font-semibold text-foreground">{totalCountries}+ countries</span>.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/calculate">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <Globe2 className="mr-2 h-4 w-4" /> Estimate shipping fees
              </Button>
            </Link>
            <Link to="/contact">
              <Button size="lg" variant="outline" className="font-semibold border-accent/30">
                Become a member
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Hub country cards */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">Your mailboxes around the world</h2>
            <p className="mt-2 text-muted-foreground max-w-xl mx-auto">
              Every member gets a personal suite number at each subscribed hub. Merchants ship there
              exactly like shipping to a local customer.
            </p>
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
                          <p className="text-xs text-muted-foreground">{hub.city} hub</p>
                        </div>
                      </div>
                      <span className="text-xs font-medium bg-muted rounded-full px-2 py-1">
                        from {formatMoney(hub.pickupFee, "USD")}/shipment
                      </span>
                    </div>
                    <div className="rounded-lg bg-muted/60 border border-border/60 p-3 text-xs space-y-0.5 font-mono">
                      <p className="font-semibold text-foreground">{hub.sample.name}</p>
                      {hub.sample.lines.map((l) => (
                        <p key={l} className="text-muted-foreground">{l}</p>
                      ))}
                      <p className="pt-1 text-accent font-sans font-medium">+ your personal suite: SP-XXXXX-{hub.id}</p>
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
                      Popular stores: {hub.stores.slice(0, 3).join(" · ")}
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
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">How Shop &amp; Ship works</h2>
            <p className="mt-2 text-muted-foreground">From a checkout page anywhere in the world to your doorstep.</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {steps.map((step, i) => (
              <motion.div key={step.title} {...fadeUp} transition={{ delay: i * 0.1 }}>
                <Card className="h-full border-border/50 shadow-sm text-center">
                  <CardContent className="p-6 flex flex-col items-center gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-accent/10 text-accent">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground">{step.title}</h3>
                    <p className="text-sm text-muted-foreground">{step.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Service differentiators */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">Everything included</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <motion.div key={s.title} {...fadeUp} transition={{ delay: i * 0.08 }}>
                <Card className="h-full border-border/50 shadow-sm">
                  <CardContent className="p-6">
                    <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary mb-4">
                      <s.icon className="h-5 w-5" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="mb-20">
          <motion.div {...fadeUp} className="text-center mb-10">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">Plans for every shopper</h2>
            <p className="mt-2 text-muted-foreground">Annual membership. Start free, upgrade anytime.</p>
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
                        Choose {p.id} <ArrowRight className="ml-1 h-4 w-4" />
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
                We deliver to {totalCountries} countries and territories
              </h2>
              <p className="text-center text-sm text-muted-foreground max-w-2xl">
                Door-to-door worldwide with transparent fees, consolidated boxes and customs support.
                Estimate your fee in seconds.
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
                  <Globe2 className="mr-2 h-4 w-4" /> Estimate your shipping fee
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>

        <div className="mt-12 text-center text-xs text-muted-foreground flex items-center justify-center gap-1.5">
          <Camera className="h-3.5 w-3.5" />
          Member mailbox addresses shown are illustrative examples; your real suite number is issued after sign-up.
        </div>
      </div>
    </div>
  );
};

export default ShopShip;
