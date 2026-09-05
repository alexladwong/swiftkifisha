import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Package } from "lucide-react";

/**
 * Full-height off-canvas drawer (right or left).
 * - flex column: fixed header / scrollable content / fixed footer -> no clipping
 * - overlay fade ~200ms, panel slide 260ms cubic-bezier(0.4,0,0.2,1)
 * - closes on X, overlay and Escape; focus trapped; returns to trigger on close
 * - body scroll locked while open; drawer scrolls independently
 */
export default function SideDrawer({
  open,
  onClose,
  label = "Menu",
  children,
  footer = null,
  widthClass = "w-[min(430px,94vw)]",
  side = "right",
}) {
  const panelRef = useRef(null);
  const triggerRef = useRef(null);

  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement;
      const prevOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      const t = window.setTimeout(() => panelRef.current?.focus(), 60);
      return () => {
        window.clearTimeout(t);
        document.body.style.overflow = prevOverflow;
      };
    }
    return undefined;
  }, [open]);

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

  const restoreFocus = () => {
    if (triggerRef.current?.focus) triggerRef.current.focus();
  };

  const from = side === "left" ? "-100%" : "100%";

  return (
    <AnimatePresence onExitComplete={restoreFocus}>
      {open && (
        <>
          {/* Overlay */}
          <motion.button
            aria-label="Close menu"
            className="fixed inset-0 z-[70] cursor-default bg-[rgba(15,23,42,0.5)] backdrop-blur-[1.5px]"
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
            className={
              "fixed inset-y-0 z-[80] flex h-dvh w-full flex-col bg-white outline-none " +
              (side === "left" ? "left-0 border-r border-border shadow-[18px_0_48px_-24px_rgba(15,23,42,0.28)] " : "right-0 shadow-drawer ") +
              widthClass
            }
            initial={{ x: from }}
            animate={{ x: 0 }}
            exit={{ x: from }}
            transition={{ type: "tween", duration: 0.26, ease: [0.4, 0, 0.2, 1] }}
          >
            {/* Header: fixed, never overlapped by content */}
            <div className="flex h-[72px] shrink-0 items-center justify-between border-b border-border/80 px-6">
              <p className="flex items-center gap-2.5 font-display text-lg font-extrabold tracking-tight text-foreground">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <Package className="h-4 w-4" strokeWidth={2.2} />
                </span>
                Swift<span className="text-accent">Ug</span>
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close navigation"
                className="flex h-11 w-11 items-center justify-center rounded-[10px] border border-border text-slate-500 transition-colors hover:bg-surface hover:text-foreground"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Content: flex-1, own scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-6 md:px-6">{children}</div>

            {/* Footer: optional persistent controls */}
            {footer && <div className="shrink-0 border-t border-border/80">{footer}</div>}
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
