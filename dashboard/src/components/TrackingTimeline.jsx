import { motion } from "framer-motion";
import { CheckCircle, Circle, MapPin } from "lucide-react";
export function TrackingTimeline({ checkpoints }) {
    return (<div className="relative space-y-0">
      {checkpoints.map((cp, i) => {
            const isLast = i === checkpoints.length - 1;
            const isCompleted = i < checkpoints.length - 1;
            return (<motion.div key={i} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.3, delay: i * 0.15 }} className="relative flex gap-4 pb-8">
            <div className="flex flex-col items-center">
              {isCompleted ? (<CheckCircle className="h-5 w-5 text-success shrink-0"/>) : isLast ? (<Circle className="h-5 w-5 text-secondary shrink-0 fill-secondary"/>) : (<Circle className="h-5 w-5 text-muted-foreground shrink-0"/>)}
              {!isLast && (<motion.div initial={{ height: 0 }} animate={{ height: "100%" }} transition={{ duration: 0.5, delay: i * 0.15 }} className={`w-0.5 flex-1 mt-1 ${isCompleted ? "bg-success" : "bg-border"}`}/>)}
            </div>
            <div className="flex-1 -mt-0.5">
              <p className="text-sm font-semibold text-foreground capitalize">{cp.status.replace("_", " ")}</p>
              <p className="text-sm text-muted-foreground">{cp.message}</p>
              <div className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <MapPin className="h-3 w-3"/>
                <span>{cp.location}</span>
                <span className="mx-1">•</span>
                <span>{new Date(cp.timestamps).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
              </div>
            </div>
          </motion.div>);
        })}
    </div>);
}
