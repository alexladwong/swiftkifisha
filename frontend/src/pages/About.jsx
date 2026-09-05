import { motion } from 'framer-motion';
import { Zap, Shield, Cpu, Heart, Truck, Globe } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';

const values = [
  { icon: Zap, title: 'Speed', desc: 'Lightning-fast deliveries across Pakistan with optimized routes.' },
  { icon: Shield, title: 'Trust', desc: 'Your parcels are insured and handled with utmost care.' },
  { icon: Cpu, title: 'Technology', desc: 'AI-powered logistics and real-time tracking systems.' },
  { icon: Heart, title: 'Customer Care', desc: '24/7 support with dedicated account managers.' },
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
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center mb-16">
        <h1 className="font-display text-3xl md:text-5xl font-bold text-foreground">About SwiftUG</h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Revolutionizing parcel delivery across Pakistan with speed, reliability, and cutting-edge technology.
        </p>
      </motion.div>

      {/* Story */}
      <motion.section {...fadeUp} className="max-w-3xl mx-auto mb-20">
        <h2 className="font-display text-2xl font-bold text-foreground mb-4">Our Story</h2>
        <p className="text-muted-foreground leading-relaxed mb-4">
          Founded in 2020, SwiftUG emerged from a simple idea: Pakistan deserves a courier service that matches global standards. Starting with just 5 riders in Lahore, we've grown into a nationwide network covering 200+ cities.
        </p>
        <p className="text-muted-foreground leading-relaxed">
          Today, we process over 50,000 parcels daily, powered by advanced route optimization, real-time tracking, and a team of dedicated logistics professionals who care about every single delivery.
        </p>
      </motion.section>

      {/* Mission & Vision */}
      <div className="grid md:grid-cols-2 gap-8 mb-20">
        <motion.div {...fadeUp}>
          <Card className="h-full border-border/50 shadow-sm">
            <CardContent className="p-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                <Truck className="h-6 w-6 text-primary" />
              </div>
              <h3 className="font-display text-xl font-bold text-foreground mb-3">Our Mission</h3>
              <p className="text-muted-foreground">
                To provide fast, affordable, and reliable delivery services that connect every corner of Pakistan, empowering businesses and individuals alike.
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
                To build Pakistan's most modern logistics network — one that leverages technology to deliver parcels faster, smarter, and with complete transparency.
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Values */}
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
    </div>
  </div>
);

export default About;
