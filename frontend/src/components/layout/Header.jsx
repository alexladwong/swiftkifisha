import { useEffect, useRef, useState } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { Menu, Package, ChevronDown, LogOut, MapPin, Search, Globe2, Mail, ArrowRight, UserRound } from "lucide-react";
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
import AuthDialog from "@/components/AuthDialog";
import { logout } from "@/features/auth/authSlice";
import { SHOP_HUBS } from "@/lib/intlData";

const PRIMARY_NAV = [
  { label: "Home", path: "/" },
  { label: "Fikisha", path: "/shop-ship" },
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
        <Link to="/" className="flex shrink-0 items-center gap-2.5" aria-label="SwiftUg — home">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
            <Package className="h-5 w-5" strokeWidth={2.2} />
          </span>
          <span className="font-display text-[22px] font-extrabold tracking-tight text-foreground">
            Swift<span className="text-accent">Pak</span>
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
      <SideDrawer open={menuOpen} onClose={() => setMenuOpen(false)} label="SwiftUg menu">
        <div className="space-y-8">
          {/* Main links */}
          <nav aria-label="Menu">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Menu</p>
            <ul className="space-y-1">
              {[
                { label: "Home", path: "/" },
                { label: "Fikisha — mailboxes worldwide", path: "/shop-ship" },
                { label: "Track a parcel", path: "/track" },
                { label: "Estimate shipping fees", path: "/calculate" },
              ].map((item) => (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    className="group flex items-center justify-between rounded-xl px-3 py-3 text-[17px] font-semibold text-foreground transition-colors hover:bg-surface"
                  >
                    {item.label}
                    <ArrowRight className="h-4 w-4 text-slate-300 transition-transform group-hover:translate-x-0.5 group-hover:text-accent" />
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          {/* Membership */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Membership</p>
            {token && user ? (
              <Link
                to="/account"
                className="flex items-center gap-3 rounded-xl border border-border bg-white p-3 transition-colors hover:border-primary/30 hover:bg-surface"
              >
                <Avatar className="h-10 w-10">
                  <AvatarFallback className="bg-primary-soft text-primary text-sm">{initialsOf(user.name)}</AvatarFallback>
                </Avatar>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold text-foreground">{user.name}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {user.plan ? user.plan + " member" : "Member"} · My mailboxes
                  </span>
                </span>
              </Link>
            ) : (
              <div className="space-y-2">
                <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openAuth("signup")}>
                  Create free account <ArrowRight className="ml-1 h-4 w-4" />
                </Button>
                <Button variant="outline" className="w-full" onClick={() => openAuth("signin")}>
                  Sign in to my account
                </Button>
              </div>
            )}
          </div>

          {/* Mailbox hubs */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Mailbox hubs</p>
            <ul className="grid grid-cols-1 gap-1.5">
              {SHOP_HUBS.map((h) => (
                <li key={h.id}>
                  <Link
                    to="/shop-ship"
                    className="flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-surface hover:text-foreground"
                  >
                    <span className="text-lg leading-none">{h.flag}</span>
                    <span className="flex-1">{h.country}</span>
                    <span className="text-xs text-slate-400">{h.city}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Company */}
          <div>
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-400">Company</p>
            <ul className="space-y-1">
              {[
                { label: "About our story", path: "/about" },
                { label: "Contact & support", path: "/contact" },
              ].map((item) => (
                <li key={item.path}>
                  <Link to={item.path} className="block rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-surface hover:text-foreground">
                    {item.label}
                  </Link>
                </li>
              ))}
              <li>
                <a
                  href="mailto:care@swiftug.com"
                  className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[15px] font-medium text-slate-700 transition-colors hover:bg-surface hover:text-foreground"
                >
                  <Mail className="h-4 w-4 text-slate-400" /> care@swiftug.com
                </a>
              </li>
            </ul>
          </div>

          {/* Region / language (informational, real coverage) */}
          <div className="rounded-2xl border border-border bg-surface/60 p-4">
            <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-foreground">
              <Globe2 className="h-4 w-4 text-primary" /> Serving you worldwide
            </p>
            <p className="text-[13px] leading-relaxed text-muted-foreground">
              Mailboxes in 7 hub countries · delivery to 50+ countries · English-language support ·
              fees in USD and UGX.
            </p>
          </div>

          {!token && (
            <p className="text-center text-xs text-slate-400">
              Already have an account?{" "}
              <button type="button" onClick={() => openAuth("signin")} className="font-semibold text-primary underline-offset-2 hover:underline">
                Sign in
              </button>
            </p>
          )}
        </div>
      </SideDrawer>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </header>
  );
}