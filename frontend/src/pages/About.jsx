import { motion } from 'framer-motion';
import { Zap, Shield, Cpu, Heart, Truck, Globe, Boxes, MapPin } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';

const values = [
  { icon: Zap, title: 'Speed', desc: 'Express delivery across 50+ countries with optimized global routes.' },
  { icon: Shield, title: 'Trust', desc: 'Shipments insured and handled with the utmost care at every hub.' },
  { icon: Cpu, title: 'Technology', desc: 'Live tracking, smart consolidation and transparent fee calculators.' },
  { icon: Heart, title: 'Customer Care', desc: '24/7 support with dedicated account managers for every member.' },
];

const stats = [
  { value: '2M+', label: 'Parcels delivered' },
  { value: '7', label: 'International hubs' },
  { value: '50+', label: 'Countries served' },
  { value: '99%', label: 'On-time delivery' },
];

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const About = () => (
  <div className="min-h-screen pt-24 pb-20">
    <div className="container mx-auto px-4 md:px-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
        <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">About SwiftUg</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          From a local courier to the shop-and-ship network that lets anyone buy from the
          world's best stores — no matter where they live.
        </p>
      </motion.div>

      <motion.section {...fadeUp} className="max-w-3xl mx-auto mb-20">
        <h2 className="font-display text-2xl font-bold text-foreground mb-4">Our Story</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          SwiftUg started in 2010 with a handful of riders and one simple frustration: great
          products were locked inside borders. Stores in New York, London or Dubai would not
          ship abroad — and when they did, it was slow, costly and opaque.
        </p>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Today we operate mailboxes in seven hub countries — the USA, UK, UAE, Germany, China,
          Singapore and Hong Kong — and deliver to more than 50 countries. Members shop with
          their personal suite number, we receive, consolidate and repack their orders, clear
          customs on their behalf, and hand the box to them at their door with live tracking
          from store to doorstep.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          We process over two million parcels a year, powered by route optimization, real-time
          tracking and a team of logistics professionals who care about every single delivery.
        </p>
      </motion.section>

      <div className="grid md:grid-cols-2 gap-8 mb-20">
        <motion.div {...fadeUp}>
          <Card className="h-full border-border/50 shadow-sm">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-3">Our Mission</h3>
              <p className="text-muted-foreground">
                To give every shopper on earth access to every store on earth — with fair fees,
                fast delivery and full transparency, empowering people and businesses across
                borders.
              </p>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div {...fadeUp} transition={{ delay: 0.1 }}>
          <Card className="h-full border-border/50 shadow-sm">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-accent/10 mb-4">
                <Globe className="h-6 w-6 text-accent" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-3">Our Vision</h3>
              <p className="text-muted-foreground">
                To build the world's most modern cross-border shopping network — one that makes
                international delivery feel as simple as local delivery.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <motion.div {...fadeUp} className="mb-20">
        <Card className="border-border/50 shadow-sm">
          <CardContent className="p-8 text-center">
            <MapPin className="h-7 w-7 text-accent mx-auto mb-3" />
            <h2 className="font-display text-2xl font-bold text-foreground mb-2">Seven hubs. One membership.</h2>
            <p className="text-muted-foreground mb-6 max-w-xl mx-auto">
              Your personal suite numbers in New York, London, Dubai, Frankfurt, Shanghai,
              Singapore and Hong Kong.
            </p>
            <Link to="/shop-ship">
              <Button size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90 font-semibold">
                <Boxes className="mr-2 h-4 w-4" /> Explore Shop &amp; Ship
              </Button>
            </Link>
          </CardContent>
        </Card>
      </motion.div>

      <motion.div {...fadeUp} className="text-center mb-10">
        <h2 className="font-display text-2xl md:text-3xl font-bold text-foreground">Our Values</h2>
      </motion.div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {values.map((v, i) => (
          <motion.div
            key={v.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ y: -4 }}
          >
            <Card className="h-full border-border/50 shadow-sm text-center">
              <CardContent className="p-6">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 mb-4">
                  <v.icon className="h-7 w-7 text-primary" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{v.title}</h3>
                <p className="text-sm text-muted-foreground">{v.desc}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <motion.div {...fadeUp} className="mt-20">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <p className="font-display text-3xl md:text-4xl font-bold text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  </div>
);

export default About;
