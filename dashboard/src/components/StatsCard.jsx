import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";

function useCountUp(target, duration = 1500) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    let start = 0;
    const increment = target / (duration / 16);
    const timer = setInterval(() => {
      start += increment;
      if (start >= target) {
        setCount(target);
        clearInterval(timer);
      } else {
        setCount(Math.floor(start));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

export function StatsCard({
  title,
  value,
  icon: Icon,
  prefix = "",
  suffix = "",
  index = 0,
  iconClassName,
}) {
  const animatedValue = useCountUp(value);
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card className="hover-scale cursor-default border-0 shadow-md">
        <CardContent className="flex items-center gap-4 p-6">
          <div
            className={`flex h-12 w-12 items-center justify-center rounded-xl ${iconClassName || "bg-primary/10 text-primary"}`}
          >
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold text-foreground">
              {prefix} {animatedValue.toLocaleString()}
              {suffix}
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
