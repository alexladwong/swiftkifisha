import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard, UserRound, MapPin, ShieldCheck, Package, LogOut, Menu,
  HelpCircle, ArrowUpRight,
} from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import SideDrawer from "@/components/layout/SideDrawer";
import { logout } from "@/features/auth/authSlice";

const NAV = [
  { to: "/account", end: true, icon: LayoutDashboard, label: "Overview" },
  { to: "/account/profile", icon: UserRound, label: "My Profile" },
  { to: "/account/addresses", icon: MapPin, label: "My Addresses" },
  { to: "/account/security", icon: ShieldCheck, label: "Security" },
];

const initialsOf = (name) =>
  (name || "?").split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();

function SidebarNavItem({ item, onNavigate }) {
  return (
    <NavLink
      key={item.to}
      to={item.to}
      end={item.end}
      onClick={onNavigate}
      aria-current={({ isActive }) => (isActive ? "page" : undefined)}
      className={({ isActive }) =>
        "group relative flex items-center gap-3 rounded-[10px] px-3 py-[11px] text-[14px] font-medium transition-colors duration-150 " +
        (isActive ? "bg-primary/10 text-primary" : "text-slate-600 hover:bg-surface hover:text-foreground")
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <span aria-hidden="true" className="absolute left-0 top-1/2 h-6 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <item.icon className={"h-[18px] w-[18px] " + (isActive ? "text-primary" : "text-slate-400 group-hover:text-slate-600")} strokeWidth={isActive ? 2.2 : 1.8} />
          {item.label}
        </>
      )}
    </NavLink>
  );
}

function SidebarContent({ onNavigate }) {
  const { user } = useSelector((state) => state.auth);
  return (
    <div className="flex h-full flex-col">
      <div className="space-y-1 px-3 py-5">
        {NAV.map((item) => (
          <SidebarNavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </div>
      <div className="mt-auto space-y-3 border-t border-border/70 p-4">
        <div className="flex items-center gap-2.5 px-1">
          <Avatar className="h-8 w-8">
            <AvatarFallback className="bg-primary-soft text-primary text-xs">{initialsOf(user?.name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">{user?.email}</p>
          </div>
        </div>
        <Link to="/" className="flex items-center gap-2 rounded-lg px-2.5 py-2 text-[13px] font-medium text-slate-500 transition-colors hover:bg-surface hover:text-foreground">
          <ArrowUpRight className="h-4 w-4" /> Back to SwiftKifisha
        </Link>
      </div>
    </div>
  );
}

export default function PortalShell() {
  const { token, user } = useSelector((state) => state.auth);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  if (!token || !user) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-6 text-center">
        <Package className="h-10 w-10 text-slate-300" />
        <div>
          <p className="font-display text-xl font-bold text-foreground">Sign in to open your portal</p>
          <p className="mt-1 text-sm text-muted-foreground">Your mailboxes, shipments and settings live here.</p>
        </div>
        <Link to="/" className="rounded-lg bg-accent px-5 py-2.5 text-sm font-bold text-white hover:bg-accent/90">
          Back to SwiftKifisha
        </Link>
      </div>
    );
  }

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  return (
    <div className="min-h-[80vh] bg-[#f7f9fc]">
      {/* Slim portal context bar (single lightweight row under the global header) */}
      <div className="z-40 border-b border-border/70 bg-white lg:sticky lg:top-[88px]">
        <div className="mx-auto flex h-[52px] w-full max-w-[1400px] items-center gap-3 px-4 md:px-6">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            aria-label="Open account menu"
            className="flex h-9 w-9 items-center justify-center rounded-lg border border-border text-slate-600 lg:hidden"
          >
            <Menu className="h-4.5 w-4.5" style={{ width: 18, height: 18 }} />
          </button>
          <p className="flex items-center gap-2 text-[13px] font-semibold text-slate-600">
            <Package className="h-4 w-4 text-primary" />
            Member Portal
            <span className="hidden text-slate-300 sm:inline">/</span>
            <span className="hidden capitalize text-slate-400 sm:inline">
              {location.pathname === "/account" ? "Overview" : location.pathname.replace("/account/", "").replace(/-/g, " ")}
            </span>
          </p>
          <div className="ml-auto flex items-center gap-1">
            <Link to="/contact" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-surface hover:text-foreground">
              <HelpCircle className="h-4 w-4" /> Help
            </Link>
            <Link to="/" className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium text-slate-500 transition-colors hover:bg-surface hover:text-foreground">
              Back to website
            </Link>
          </div>
        </div>
      </div>

      {/* Sidebar + workspace */}
      <div className="mx-auto flex w-full max-w-[1400px]">
        <aside
          className="sticky top-[140px] hidden h-[calc(100vh-140px)] w-[252px] shrink-0 overflow-y-auto bg-white lg:block"
          aria-label="Account sections"
        >
          <SidebarContent />
        </aside>

        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile account drawer */}
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Account menu">
        <div className="flex h-full flex-col">
          <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          <button
            type="button"
            onClick={handleLogout}
            className="mb-4 flex items-center gap-2 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SideDrawer>
    </div>
  );
}