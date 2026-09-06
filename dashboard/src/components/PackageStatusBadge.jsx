import { cn } from "@/lib/utils";
import { STATUS_LABEL, STATUS_STYLE } from "@/lib/packageOps";

/**
 * Status pill for Phase-1 warehouse packages (SWPK-*) — the legacy shipment
 * StatusBadge is for parcel checkpoints and is intentionally untouched.
 */
export function PackageStatusBadge({ status, className }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold",
        STATUS_STYLE[status] || "bg-muted text-muted-foreground",
        className,
      )}
    >
      {STATUS_LABEL[status] || status || "—"}
    </span>
  );
}
