import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Package, Truck, Clock, Globe, Zap, Shield, MapPin, DollarSign,
  ArrowRight, Star, Search, ShoppingBag, Boxes, Radio
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import AnimatedCounter from '@/components/AnimatedCounter';

const fadeUp = {
  initial: { opacity: 0, y: 30 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.5 },
};

const services = [
  { icon: Globe, title: 'Shop & Ship', desc: 'Your personal mailbox in the US, UK, UAE & more — shop any store in the world.' },
  { icon: Boxes, title: 'Consolidation', desc: 'Combine multiple purchases into one shipment and pay a single international fee.' },
  { icon: Zap, title: 'Express Worldwide', desc: 'Door-to-door express delivery to 50+ countries and territories.' },
  { icon: Radio, title: 'Global Tracking', desc: 'Track every step of the journey — from the store shelf to your doorstep.' },
];

const steps = [
  { num: '01', title: 'Create your free account', desc: 'Sign up online in two minutes and pick your plan.' },
  { num: '02', title: 'Get your global mailbox', desc: 'We assign you personal addresses with suite numbers abroad.' },
  { num: '03', title: 'Shop & consolidate', desc: 'Buy from any store — we receive and combine your parcels.' },
  { num: '04', title: 'We deliver to your door', desc: 'One shipment, full tracking, customs handled, anywhere you live.' },
];

const features = [
  { icon: MapPin, title: 'Real-time Tracking', desc: 'Live updates from store to doorstep.' },
  { icon: Shield, title: 'Protected Shipments', desc: 'Coverage and careful handling on every box.' },
  { icon: Globe, title: 'Worldwide Network', desc: 'Mailboxes in 7 hub countries, delivery to 50+.' },
  { icon: DollarSign, title: 'Transparent Pricing', desc: 'See the full fee before you buy — no surprises.' },
];

const testimonials = [
  { name: 'Ahmed Khan', city: 'Dubai, UAE', text: 'Bought sneakers from a US store that never shipped here. My SwiftUg mailbox made it effortless — 6 days to my door.', rating: 5 },
  { name: 'Sara Malik', city: 'Toronto, Canada', text: 'Consolidated three orders from the UK and Germany into one box. Saved more than half the shipping cost.', rating: 5 },
  { name: 'Fatima Noor', city: 'Kampala, Uganda', text: 'The fee calculator is exact, tracking is live and customs clearance was handled without any hassle.', rating: 5 },
];

const Index = () => {
  const [trackingId, setTrackingId] = useState('');
  const navigate = useNavigate();

  const handleQuickTrack = () => {
    if (trackingId.trim()) navigate(`/track?id=${trackingId.trim()}`);
  };

  return (
    <div className="overflow-hidden">
      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center gradient-hero pt-16">
        <div className="container mx-auto px-4 md:px-6 py-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, x: -40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.6 }}
            >
              <span className="inline-block rounded-full bg-accent/10 px-4 py-1.5 text-sm font-medium text-accent mb-6">
                🌍 Shop Anywhere. Deliver Everywhere.
              </span>
              <h1 className="font-display text-4xl md:text-5xl lg:text-6xl font-extrabold text-foreground leading-tight">
                Worldwide Shopping,{' '}
                <span className="text-primary">Delivered to Your Door</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-lg leading-relaxed">
                Shop any store from your SwiftUg mailbox in New York, London or Dubai — then we
                consolidate, clear customs and deliver to your door, anywhere you live.
              </p>
              <div className="mt-8 flex flex-wrap gap-4">
                <Link to="/track">
                  <Button size="lg" className="bg-primary text-primary-foreground hover:bg-primary/90 font-semibold">
                    <Search className="mr-2 h-4 w-4" /> Track Parcel
                  </Button>
                </Link>
                <Link to="/shop-ship">
                  <Button size="lg" variant="outline" className="font-semibold border-primary/20">
                    <DollarSign className="mr-2 h-4 w-4" /> Shop & Ship
                  </Button>
                </Link>
              </div>
            </motion.div>

            {/* Animated parcel illustration */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="relative hidden lg:flex items-center justify-center"
            >
              <div className="relative w-80 h-80">
                {/* Path */}
                <svg viewBox="0 0 320 320" className="absolute inset-0 w-full h-full">
                  <motion.path
                    d="M 40 280 Q 160 40 280 280"
                    fill="none"
                    stroke="hsl(224 76% 40% / 0.2)"
                    strokeWidth="3"
                    strokeDasharray="8 4"
                  />
                  <motion.path
                    d="M 40 280 Q 160 40 280 280"
                    fill="none"
                    stroke="hsl(25 95% 53%)"
                    strokeWidth="3"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity, repeatDelay: 1 }}
                  />
                </svg>
                {/* Origin pin */}
                <div className="absolute bottom-6 left-4 flex flex-col items-center">
                  <MapPin className="h-8 w-8 text-primary" />
                  <span className="text-xs font-medium text-primary mt-1">New York</span>
                </div>
                {/* Destination pin */}
                <div className="absolute bottom-6 right-4 flex flex-col items-center">
                  <MapPin className="h-8 w-8 text-accent" />
                  <span className="text-xs font-medium text-accent mt-1">Dubai</span>
                </div>
                {/* Moving parcel */}
                <motion.div
                  className="absolute"
                  animate={{
                    offsetDistance: ['0%', '100%'],
                  }}
                  transition={{ duration: 3, ease: 'easeInOut', repeat: Infinity, repeatDelay: 0.5 }}
                  style={{
                    offsetPath: 'path("M 40 280 Q 160 40 280 280")',
                  }}
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent shadow-lg">
                    <Package className="h-5 w-5 text-accent-foreground" />
                  </div>
                </motion.div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Services */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">Our Services</h2>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">International shopping and shipping, made simple</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((s, i) => (
              <motion.div
                key={s.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                whileHover={{ y: -6 }}
              >
                <Card className="h-full border-border/50 shadow-sm hover:shadow-md transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 mb-4">
                      <s.icon className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="font-display font-semibold text-foreground mb-2">{s.title}</h3>
                    <p className="text-sm text-muted-foreground">{s.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">How Shop & Ship Works</h2>
            <p className="mt-3 text-muted-foreground">Four steps from global store to your doorstep</p>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {steps.map((step, i) => (
              <motion.div
                key={step.num}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 }}
                className="relative text-center"
              >
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-display text-xl font-bold mb-4">
                  {step.num}
                </div>
                {i < 3 && (
                  <div className="hidden md:block absolute top-8 left-[60%] w-[80%] h-0.5 bg-primary/20">
                    <motion.div
                      className="h-full bg-accent"
                      initial={{ width: 0 }}
                      whileInView={{ width: '100%' }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: 0.5 + i * 0.3 }}
                    />
                  </div>
                )}
                <h3 className="font-display font-semibold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground">{step.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Quick Track */}
      <section className="py-16 bg-primary">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div {...fadeUp} className="text-center">
            <h2 className="font-display text-2xl md:text-3xl font-bold text-primary-foreground mb-2">
              Track Your Parcel
            </h2>
            <p className="text-primary-foreground/70 mb-6">Enter your tracking ID to get instant updates</p>
            <div className="flex max-w-md mx-auto gap-2">
              <Input
                placeholder="Enter Tracking ID"
                value={trackingId}
                onChange={(e) => setTrackingId(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleQuickTrack()}
                className="bg-primary-foreground/10 border-primary-foreground/20 text-primary-foreground placeholder:text-primary-foreground/50"
              />
              <Button onClick={handleQuickTrack} className="bg-accent text-accent-foreground hover:bg-accent/90 shrink-0">
                Track <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">Why Shop & Ship with SwiftUg?</h2>
          </motion.div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((f, i) => (
              <motion.div
                key={f.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center p-6"
              >
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-accent/10 mb-4">
                  <f.icon className="h-7 w-7 text-accent" />
                </div>
                <h3 className="font-display font-semibold text-foreground mb-2">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 md:px-6">
          <motion.div {...fadeUp} className="text-center mb-14">
            <h2 className="font-display text-3xl md:text-4xl font-bold text-foreground">What Our Customers Say</h2>
          </motion.div>
          <div className="grid md:grid-cols-3 gap-6">
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
              >
                <Card className="h-full border-border/50">
                  <CardContent className="p-6">
                    <div className="flex gap-1 mb-3">
                      {Array.from({ length: t.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-accent text-accent" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground mb-4">"{t.text}"</p>
                    <div>
                      <p className="font-display font-semibold text-foreground text-sm">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.city}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-20 bg-background">
        <div className="container mx-auto px-4 md:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            <AnimatedCounter end={2000000} suffix="+" label="Parcels Delivered" />
            <AnimatedCounter end={52} suffix="+" label="Countries Served" />
            <AnimatedCounter end={50000} suffix="+" label="Global Members" />
            <AnimatedCounter end={99} suffix="%" label="On-time Delivery" />
          </div>
        </div>
      </section>
    </div>
  );
};

export default Index;