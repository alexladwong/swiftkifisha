import { Link, NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { ChevronRight, LogOut } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import LanguageSwitcher from "@/components/LanguageSwitcher";
import { useI18n } from "@/i18n";

const GROUP_KEYS = {
  main: "main",
  support: "support",
  company: "company",
};

const GROUPS = [
  {
    key: "main",
    items: [
      { labelKey: "nav.home", to: "/", end: true },
      { labelKey: "nav.kifisha", to: "/shop-ship" },
      { labelKey: "nav.track", to: "/track" },
      { labelKey: "nav.estimate", to: "/calculate" },
    ],
  },
  {
    key: "support",
    items: [
      { labelKey: "drawer.helpCentre", to: "/contact" },
      { labelKey: "drawer.contactSupport", to: "/contact" },
    ],
  },
  {
    key: "company",
    items: [
      { labelKey: "drawer.aboutSwiftKifisha", to: "/about" },
      { labelKey: "drawer.mailboxHubs", to: "/shop-ship" },
    ],
  },
];

const MEMBER_ITEMS = [
  { labelKey: "drawer.myAccount", to: "/account", end: true },
  { labelKey: "drawer.myAddresses", to: "/account/addresses" },
  { labelKey: "drawer.myShipments", to: "/account" },
  { labelKey: "drawer.security", to: "/account/security" },
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
  const { t } = useI18n();

  return (
    <div className="flex flex-col gap-7">
      {GROUPS.map((group) => (
        <section key={group.key}>
          <GroupLabel>{t("drawer." + GROUP_KEYS[group.key])}</GroupLabel>
          <div className="space-y-1">
            {group.items.map((item) => (
              <Row key={group.key + item.to + item.labelKey} to={item.to} end={item.end} label={t(item.labelKey)} onNavigate={onNavigate} />
            ))}
          </div>
        </section>
      ))}

      {/* Member */}
      <section>
        <GroupLabel>{token && user ? t("drawer.member") : t("drawer.account")}</GroupLabel>
        {token && user ? (
          <div className="space-y-1">
            {MEMBER_ITEMS.map((item) => (
              <Row key={item.labelKey} to={item.to} end={item.end} label={t(item.labelKey)} onNavigate={onNavigate} />
            ))}
          </div>
        ) : (
          <div className="space-y-2 px-1 pt-1">
            <button
              type="button"
              onClick={() => onOpenAuth("signup")}
              className="flex h-11 w-full items-center justify-center rounded-[10px] bg-accent text-[15px] font-bold text-white transition-colors hover:bg-accent/90"
            >
              {t("drawer.createAccount")}
            </button>
            <button
              type="button"
              onClick={() => onOpenAuth("signin")}
              className="flex h-11 w-full items-center justify-center rounded-[10px] border border-[#e5eaf2] bg-white text-[15px] font-semibold text-slate-700 transition-colors hover:border-slate-300"
            >
              {t("drawer.signIn")}
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
              aria-label={t("drawer.signOutAria")}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border text-slate-500 transition-colors hover:border-destructive/30 hover:text-destructive"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2 px-1">
          <span className="inline-flex items-center rounded-md bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-slate-500">
            {t("drawer.ugandaGlobal")}
          </span>
          <LanguageSwitcher compact onSelect={onNavigate} />
        </div>
      </section>
    </div>
  );
}
