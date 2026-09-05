import { cn } from "@/lib/utils";
const statusConfig = {
    arrived: { label: "Arrived", className: "bg-muted text-muted-foreground" },
    created: { label: "Created", className: "bg-muted text-muted-foreground" },
    in_transit: { label: "In Transit", className: "bg-info/10 text-info" },
    out_for_delivery: { label: "Out for Delivery", className: "bg-secondary/10 text-secondary" },
    delivered: { label: "Delivered", className: "bg-success/10 text-success" },
};
export function StatusBadge({ status }) {
    const config = statusConfig[status] || { label: status, className: "bg-muted text-muted-foreground" };
    return (<span className={cn("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", config.className)}>
      {config.label}
    </span>);
}
