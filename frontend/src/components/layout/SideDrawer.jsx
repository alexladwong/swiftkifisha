import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

/**
 * Accessible right-side off-canvas drawer.
 * - slides in from the right (220–320ms), overlay fades (~200ms)
 * - closes on X, overlay click, and Escape
 * - traps focus while open and restores it to the trigger on close
 * - locks body scroll while open
 * - announces itself to screen readers via role="dialog" + aria-modal
 */
export default function SideDrawer({ open, onClose, label = "Menu", children, widthClass = "w-[min(430px,92vw)]" }) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  // Remember which element opened the drawer so focus can be restored.
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => {
        panelRef.current?.focus();
      }, 40);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = "";
      };
    }
    return undefined;
  }, [open]);

  // Escape + focus trap
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const nodes = panelRef.current.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [open, onClose]);

  const handleClosed = () => {
    if (triggerRef.current?.focus) triggerRef.current.focus();
  };

  return (
    <AnimatePresence onExitComplete={handleClosed}>
      {open && (
        <>
          {/* Overlay */}
          <motion.button
            aria-label="Close menu"
            className="fixed inset-0 z-[70] bg-slate-950/45 backdrop-blur-[2px] cursor-default"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
          />
          {/* Panel */}
          <motion.aside
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label={label}
            tabIndex={-1}
            className={"fixed inset-y-0 right-0 z-[80] flex flex-col bg-white shadow-drawer outline-none " + widthClass}
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          >
            <div className="flex items-center justify-between border-b border-border/70 px-5 py-4">
              <p className="font-display text-lg font-bold tracking-tight text-foreground">
                Swift<span className="text-accent">Pak</span>
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{children}</div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
