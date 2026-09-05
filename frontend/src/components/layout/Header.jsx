import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Menu, Package, ChevronDown, LogOut, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import SideDrawer from "@/components/layout/SideDrawer";
import DrawerNav from "@/components/layout/DrawerNav";
import AuthDialog from "@/components/AuthDialog";
import { logout } from "@/features/auth/authSlice";
import { SHOP_HUBS } from "@/lib/intlData";

const PRIMARY_NAV = [
  { label: "Home", path: "/" },
  { label: "Kifisha", path: "/shop-ship" },
  { label: "Track", path: "/track" },
  { label: "Estimate", path: "/calculate" },
];

const initialsOf = (name) =>
  (name || "?")
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

export default function Header() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("signin");
  const [query, setQuery] = useState("");
  const menuButtonRef = useRef(null);
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Close drawer + reset query on route change
  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const submitTrack = (e) => {
    e.preventDefault();
    const id = query.trim();
    if (!id) return;
    setQuery("");
    navigate("/track?id=" + encodeURIComponent(id));
  };

  const openAuth = (mode) => {
    setMenuOpen(false);
    setAuthMode(mode);
    setAuthOpen(true);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate("/");
  };

  const navLinkClass = ({ isActive }) =>
    "rounded-md px-3 py-2 text-[15px] font-medium transition-colors duration-150 " +
    (isActive ? "text-primary" : "text-slate-600 hover:text-foreground hover:bg-surface");

  return (
    <header
      className={
        "sticky top-0 z-50 w-full bg-white/95 backdrop-blur-md transition-shadow duration-200 " +
        (scrolled ? "shadow-[0_1px_0_rgba(15,23,42,0.06),0_10px_30px_-18px_rgba(15,23,42,0.25)]" : "border-b border-border/60")
      }
    >
      <div className="shell-md flex h-[76px] items-center gap-3 lg:h-20">
        {/* Brand */}
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="SwiftKifisha — home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Package className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-tight text-foreground">
            Swift<span className="text-accent">Kifisha</span>
          </span>
        </Link>

        {/* Primary nav */}
        <nav aria-label="Primary" className="ml-4 hidden items-center gap-1 lg:flex">
          {PRIMARY_NAV.map((item) => (
            <NavLink key={item.path} to={item.path} end={item.path === "/"} className={navLinkClass}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        {/* Track/search field */}
        <form
          onSubmit={submitTrack}
          role="search"
          aria-label="Track a parcel"
          className="relative ml-auto hidden w-full max-w-[340px] xl:block"
        >
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track parcel or enter ID"
            aria-label="Tracking ID"
            className="h-11 rounded-full border-border bg-surface pl-10 pr-3 text-[15px] focus-visible:bg-white"
          />
        </form>

        {/* Right actions */}
        <div className="ml-auto flex items-center gap-2 lg:ml-0 xl:ml-3">
          {token && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="flex items-center gap-2 rounded-full border border-border bg-white py-1 pl-1 pr-2.5 text-sm font-medium transition-colors hover:border-primary/30 hover:bg-surface xl:pr-3"
                  aria-label="Account menu"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback className="bg-primary-soft text-primary text-xs">{initialsOf(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="hidden max-w-[110px] truncate sm:inline">{user.name}</span>
                  <ChevronDown className="hidden h-3.5 w-3.5 text-slate-400 sm:block" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="truncate text-xs text-muted-foreground">{user.email}</p>
                  {user.plan && (
                    <span className="mt-1.5 inline-flex items-center rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-accent">
                      {user.plan} member
                    </span>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/account" className="cursor-pointer">
                    <MapPin className="mr-2 h-4 w-4" /> My Mailboxes & Plan
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/track" className="cursor-pointer">
                    <Package className="mr-2 h-4 w-4" /> Track a parcel
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="hidden items-center gap-2 sm:flex">
              <Button variant="outline" size="sm" onClick={() => openAuth("signin")} className="h-10 px-4 text-[15px] font-semibold">
                Sign In
              </Button>
              <Button
                size="sm"
                onClick={() => openAuth("signup")}
                className="h-10 bg-accent px-4 text-[15px] font-semibold text-accent-foreground shadow-sm transition hover:bg-accent/90"
              >
                Join Free
              </Button>
            </div>
          )}

          {/* Drawer trigger */}
          <button
            ref={menuButtonRef}
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            aria-expanded={menuOpen}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-white text-foreground transition-colors hover:bg-surface"
          >
            <Menu className="h-5 w-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {/* Mobile quick track (below header row) */}
      <div className="border-t border-border/60 px-5 pb-3 pt-3 sm:px-7 lg:hidden">
        <form onSubmit={submitTrack} role="search" aria-label="Track a parcel" className="relative mx-auto w-full max-w-xl">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Track parcel or enter tracking ID (UG-…)"
            aria-label="Tracking ID"
            className="h-11 rounded-full border-border bg-surface pl-10 text-[15px]"
          />
        </form>
      </div>

      {/* Drawer */}
      <SideDrawer open={menuOpen} onClose={() => setMenuOpen(false)} label="SwiftKifisha menu">
        <DrawerNav onNavigate={() => setMenuOpen(false)} onOpenAuth={openAuth} onSignOut={handleLogout} />
      </SideDrawer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </header>
  );
}