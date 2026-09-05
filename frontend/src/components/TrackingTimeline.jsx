import { motion } from "framer-motion";
import { MapPin, CheckCircle2 } from "lucide-react";

const TrackingTimeline = ({ checkpoints }) => (
  <div className="relative pl-8">
    {/* Animated progress line */}
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: '100%' }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className="absolute left-[15px] top-0 w-0.5 bg-primary/30"
    />
    <motion.div
      initial={{ height: 0 }}
      animate={{ height: '100%' }}
      transition={{ duration: 2, ease: 'easeOut', delay: 0.3 }}
      className="absolute left-[15px] top-0 w-0.5 bg-primary"
    />

    <div className="space-y-6">
      {checkpoints.map((cp, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.3 + i * 0.2 }}
          className="relative flex gap-4"
        >
          <div className="absolute -left-8 flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground">
            {i === checkpoints.length - 1 ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <MapPin className="h-4 w-4" />
            )}
          </div>
          <div className="rounded-xl border border-border bg-card p-4 flex-1 shadow-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="font-display font-semibold text-foreground">{cp.location}</span>
              <span className="text-xs text-muted-foreground">{cp.dateTime}</span>
            </div>
            <p className="text-sm text-muted-foreground">{cp.message}</p>
            <span className="mt-2 inline-block rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
              {cp.status}
            </span>
          </div>
        </motion.div>
      ))}
    </div>
  </div>
);

export default TrackingTimeline;
