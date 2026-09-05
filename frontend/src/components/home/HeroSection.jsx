import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import HeroVisual from "@/components/home/HeroVisual";

const ease = [0.22, 0.61, 0.36, 1];

export default function HeroSection() {
  return (
    <section aria-labelledby="hero-heading" className="relative overflow-hidden bg-background">
      <div className="shell-md grid items-center gap-14 pb-16 pt-14 md:pb-24 md:pt-20 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 lg:pt-24">
        {/* Copy */}
        <div className="max-w-[640px]">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-6 flex items-center gap-2 text-[14px] font-semibold text-slate-500"
          >
            <span className="h-2 w-2 rounded-full bg-accent" aria-hidden="true" />
            International Fikisha
          </motion.p>

          <motion.h1
            id="hero-heading"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.04, ease }}
            className="text-balance font-display text-[38px] font-extrabold leading-[1.06] tracking-[-0.02em] text-foreground sm:text-[48px] lg:text-[60px]"
          >
            Shop any store in the world.{" "}
            <span className="text-primary">We deliver it to your door.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.12, ease }}
            className="mt-6 max-w-[560px] text-pretty text-[17px] leading-[1.7] text-muted-foreground md:text-lg"
          >
            SwiftUg gives you a personal mailbox in the USA, UK, UAE and more. Buy from
            stores that would not ship to you - we receive, consolidate and deliver to your
            doorstep with transparent fees and live tracking.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2, ease }}
            className="mt-9 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link to="/shop-ship" className="w-full sm:w-auto">
              <Button className="h-[52px] w-full rounded-[10px] bg-accent px-7 text-base font-bold text-accent-foreground shadow-[0_14px_30px_-14px_hsl(25_95%_53%/0.8)] transition-all duration-200 hover:-translate-y-0.5 hover:bg-accent/90 sm:w-auto">
                Get your mailbox <ArrowRight className="ml-1.5 " style={{ width: 18, height: 18 }} />
              </Button>
            </Link>
            <Link to="/calculate" className="w-full sm:w-auto">
              <Button variant="outline" className="h-[52px] w-full rounded-[10px] border-border bg-white px-7 text-base font-semibold text-foreground transition-all duration-200 hover:-translate-y-0.5 hover:border-slate-300 sm:w-auto">
                Estimate shipping
              </Button>
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.35 }}
            className="mt-7 flex items-center gap-2 text-[14px] font-medium text-slate-500"
          >
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            US & UK mailboxes included when you join free
          </motion.p>
        </div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, y: 22 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.18, ease }}
          className="relative pb-6 pt-2 lg:pt-0"
        >
          <HeroVisual />
        </motion.div>
      </div>
    </section>
  );
}