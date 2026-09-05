import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import {
  LayoutDashboard, UserRound, MapPin, ShieldCheck, Package, LogOut, Menu,
  ArrowLeft, ChevronDown, HelpCircle,
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
  (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function NavList({ onNavigate }) {
  return (
    <nav aria-label="Member portal" className="flex flex-col gap-1">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onNavigate}
          aria-current={({ isActive }) => (isActive ? "page" : undefined)}
          className={({ isActive }) =>
            "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[14px] font-medium transition-colors " +
            (isActive
              ? "bg-primary/10 text-primary"
              : "text-slate-600 hover:bg-surface hover:text-foreground")
          }
        >
          {({ isActive }) => (
            <>
              <span className={"flex h-6 w-6 items-center justify-center rounded-md " + (isActive ? "bg-primary text-primary-foreground" : "text-slate-400")}>
                <item.icon className="h-4 w-4" />
              </span>
              {item.label}
              {isActive && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" aria-hidden="true" />}
            </>
          )}
        </NavLink>
      ))}
    </nav>
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
          Back to SwiftUg
        </Link>
      </div>
    );
  }

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  return (
    <div className="min-h-[80vh] bg-[#f6f8fb]">
      {/* Slim portal header */}
      <header className="sticky top-0 z-40 border-b border-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-3 px-4 md:px-6">
          <Link to="/" className="flex items-center gap-2" aria-label="SwiftUg home">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Package className="" style={{ width: 18, height: 18 }} />
            </span>
            <span className="hidden font-display text-lg font-extrabold tracking-tight sm:inline">
              Swift<span className="text-accent">Ug</span>
            </span>
            <span className="rounded-md bg-surface-muted px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Member portal
            </span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              aria-label="Open portal menu"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-slate-600 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link to="/contact" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-foreground md:flex">
              <HelpCircle className="h-4 w-4" /> Help
            </Link>
            <Link to="/" className="hidden items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium text-slate-500 hover:text-foreground md:flex">
              <ArrowLeft className="h-4 w-4" /> Back to site
            </Link>
            <div className="flex items-center gap-2 rounded-full border border-border py-1 pl-1 pr-3">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary-soft text-primary text-xs">{initialsOf(user.name)}</AvatarFallback>
              </Avatar>
              <span className="hidden max-w-[130px] truncate text-sm font-semibold sm:inline">{user.name}</span>
              <ChevronDown className="h-3.5 w-3.5 text-slate-400" />
            </div>
            <button
              type="button"
              onClick={handleLogout}
              aria-label="Sign out"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-border text-slate-500 transition-colors hover:border-destructive/30 hover:text-destructive"
            >
              <LogOut className="" style={{ width: 18, height: 18 }} />
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1240px]">
        {/* Desktop sidebar */}
        <aside className="sticky top-16 hidden h-[calc(100vh-64px)] w-[240px] shrink-0 border-r border-border/70 py-6 pr-4 lg:block" aria-label="Portal sections">
          <NavList />
        </aside>

        {/* Main workspace */}
        <main className="min-w-0 flex-1 px-4 py-8 md:px-8 lg:px-10">
          <Outlet />
        </main>
      </div>

      {/* Mobile drawer */}
      <SideDrawer open={drawerOpen} onClose={() => setDrawerOpen(false)} label="Member portal menu" widthClass="w-[min(380px,94vw)]">
        <div className="space-y-6">
          <div className="flex items-center gap-3 rounded-xl border border-border p-3">
            <Avatar className="h-10 w-10">
              <AvatarFallback className="bg-primary-soft text-primary">{initialsOf(user.name)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-foreground">{user.name}</p>
              <p className="truncate text-xs text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <NavList onNavigate={() => setDrawerOpen(false)} />
          <button
            type="button"
            onClick={handleLogout}
            className="flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2.5 text-sm font-medium text-destructive"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </SideDrawer>
    </div>
  );
}