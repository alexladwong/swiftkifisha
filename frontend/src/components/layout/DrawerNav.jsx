import { Link, NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const GROUPS = [
  {
    label: "Main",
    items: [
      { label: "Home", to: "/", end: true },
      { label: "Kifisha", to: "/shop-ship" },
      { label: "Track", to: "/track" },
      { label: "Estimate", to: "/calculate" },
    ],
  },
  {
    label: "Support",
    items: [
      { label: "Help centre", to: "/contact" },
      { label: "Contact support", to: "/contact" },
    ],
  },
  {
    label: "Company",
    items: [
      { label: "About SwiftKifisha", to: "/about" },
      { label: "Mailbox hubs", to: "/shop-ship" },
    ],
  },
];

const MEMBER_ITEMS = [
  { label: "My Account", to: "/account", end: true },
  { label: "My Addresses", to: "/account/addresses" },
  { label: "My Shipments", to: "/account" },
  { label: "Security", to: "/account/security" },
];

const initialsOf = (name) =>
  (name || "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

function Row({ to, end, label, onNavigate }) {
  const location = useLocation();
  const active = end ? location.pathname === to : location.pathname.startsWith(to);
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={
        "flex h-[52px] items-center justify-between rounded-[10px] px-4 text-[16px] font-medium transition-colors duration-150 " +
        (active ? "bg-primary/10 text-primary" : "text-slate-700 hover:bg-surface hover:text-foreground")
      }
    >
      {label}
      <ChevronRight className={"h-4 w-4 transition-colors " + (active ? "text-accent" : "text-slate-300")} />
    </NavLink>
  );
}

function GroupLabel({ children }) {
  return <p className="mb-1.5 px-1 pt-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</p>;
}

export default function DrawerNav({ onNavigate, onOpenAuth, onSignOut }) {
  const { token, user } = useSelector((state) => state.auth);

  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map((group) => (
        <section key={group.label}>
          <GroupLabel>{group.label}</GroupLabel>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Row key={group.label + item.to + item.label} to={item.to} end={item.end} label={item.label} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}

      {/* Member */}
      <section>
        <GroupLabel>{token && user ? "Member" : "Account"}</GroupLabel>
        {token && user ? (
          <div className="space-y-1">
            {MEMBER_ITEMS.map((item) => (
              <Row key={item.to} to={item.to} end={item.end} label={item.label} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 px-1 pt-1">
            <button
              type="button"
              onClick={() => onOpenAuth("signup")}
              className="flex h-11 w-full items-center justify-center rounded-[10px] bg-accent text-[15px] font-bold text-white transition-colors hover:bg-accent/90"
            >
              Create free account
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth("signin")}
              className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[#e5eaf2] bg-white text-[15px] font-semibold text-slate-700 transition-colors hover:border-slate-300"
            >
              Sign in to my account
            </button>
          </div>
        )}
      </section>

      {/* Footer utilities */}
      <section className="space-y-3 border-t border-border/80 pt-5">
        {token && user && (
          <div className="flex items-center justify-between gap-3 px-1">
            <Link to="/account" onClick={onNavigate} className="flex min-w-0 items-center gap-3">
              <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-primary-soft text-primary text-xs">{initialsOf(user.name)}</AvatarFallback>
              </Avatar>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                <span className="block truncate text-xs text-muted-foreground">{user.email}</span>
              </span>
            </Link>
            <button
              type="button"
              onClick={onSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 transition-colors hover:border-destructive/30 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex items-center gap-2 px-1">
          <span className="inline-flex items-center rounded-md bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-slate-500">
            🇺🇬 Uganda · Global
          </span>
          <span className="inline-flex items-center rounded-md bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-slate-500">
            English
          </span>
        </div>
      </section>
    </div>
  );
}
