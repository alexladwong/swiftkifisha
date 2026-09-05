import { useEffect, useRef } from "react";

import { X } from "lucide-react";

export default function SideDrawer({
  open,
  onClose,
  label = "Navigation menu",
  children,
  triggerRef,
}) {
  const drawerRef = useRef(null);

  const closeButtonRef = useRef(null);

  /*
   * Lock background scrolling while drawer is open.
   */
  useEffect(() => {
    if (!open) return;

    const previousOverflow =
      document.body.style.overflow;

    document.body.style.overflow =
      "hidden";

    return () => {
      document.body.style.overflow =
        previousOverflow;
    };
  }, [open]);

  /*
   * Escape to close.
   */
  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    document.addEventListener(
      "keydown",
      handleKeyDown,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      );
    };
  }, [open, onClose]);

  /*
   * Focus close button when opened.
   */
  useEffect(() => {
    if (!open) return;

    const timeout =
      window.setTimeout(() => {
        closeButtonRef.current?.focus();
      }, 50);

    return () =>
      window.clearTimeout(timeout);
  }, [open]);

  /*
   * When the drawer closes (or its content navigates away), no focus may stay
   * inside the aria-hidden subtree — blur anything still focused in it.
   */
  useEffect(() => {
    if (open) return;
    const drawer = drawerRef.current;
    if (drawer && drawer.contains(document.activeElement)) {
      document.activeElement.blur();
    }
  }, [open]);

  /*
   * Return focus to menu button when closed.
   */
  const handleClose = () => {
    onClose();

    window.setTimeout(() => {
      triggerRef?.current?.focus();
    }, 0);
  };

  /*
   * Basic focus trap.
   */
  useEffect(() => {
    if (!open) return;

    const drawer =
      drawerRef.current;

    if (!drawer) return;

    const handleTab = (event) => {
      if (event.key !== "Tab") {
        return;
      }

      const focusable = drawer.querySelectorAll([
            "a[href]",
            "button:not([disabled])",
            "input:not([disabled])",
            "select:not([disabled])",
            "textarea:not([disabled])",
            '[tabindex]:not([tabindex="-1"])',
        ].join(","));

      if (!focusable.length) {
        return;
      }

      const first =
        focusable[0];

      const last =
        focusable[
          focusable.length - 1
        ];

      if (
        event.shiftKey &&
        document.activeElement === first
      ) {
        event.preventDefault();
        last.focus();
      } else if (
        !event.shiftKey &&
        document.activeElement === last
      ) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener(
      "keydown",
      handleTab,
    );

    return () => {
      document.removeEventListener(
        "keydown",
        handleTab,
      );
    };
  }, [open]);

  return (
    <div
      className={[
        "fixed inset-0 z-[100]",
        open
          ? "pointer-events-auto"
          : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      {/* Background overlay */}
      <button
        type="button"
        aria-label="Close navigation"
        onClick={handleClose}
        tabIndex={open ? 0 : -1}
        className={[
          "absolute inset-0",
          "bg-slate-950/45",
          "transition-opacity duration-200",
          open
            ? "opacity-100"
            : "opacity-0",
        ].join(" ")}
      />

      {/* Right-side drawer */}
      <div
        id="swiftkifisha-navigation-drawer"
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        className={[
          "absolute right-0 top-0",
          "flex h-dvh flex-col",
          /*
           * THIS IS THE IMPORTANT WIDTH FIX.
           *
           * Mobile:
           * 90% viewport width.
           *
           * Larger screens:
           * 390px.
           *
           * Maximum:
           * 420px.
           */
          "w-[90vw]",
          "sm:w-[390px]",
          "lg:w-[400px]",
          "max-w-[420px]",
          "bg-white",
          "shadow-[-18px_0_50px_-25px_rgba(15,23,42,0.35)]",
          "transition-transform duration-300",
          "ease-[cubic-bezier(0.4,0,0.2,1)]",
          open
            ? "translate-x-0"
            : "translate-x-full",
        ].join(" ")}
      >
        {/* Drawer header */}
        <div className="flex h-[76px] shrink-0 items-center justify-between border-b border-border px-5 sm:px-6">
          <span className="font-display text-xl font-extrabold tracking-tight text-foreground">
            Swift
            <span className="text-accent">
              Kifisha
            </span>
          </span>

          <button
            ref={closeButtonRef}
            type="button"
            onClick={handleClose}
            aria-label="Close navigation"
            className="flex h-11 w-11 items-center justify-center rounded-xl border border-border bg-white text-foreground transition-colors hover:bg-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
          >
            <X
              className="h-5 w-5"
              strokeWidth={2}
            />
          </button>
        </div>

        {/* Scrollable navigation */}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-5 sm:px-6 sm:py-6">
          {children}
        </div>
      </div>
    </div>
  );
}