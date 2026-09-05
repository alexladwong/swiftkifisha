import { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { Menu, Package, ChevronDown, LogOut, MapPin, User as UserIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { motion } from 'framer-motion';
import AuthDialog from '@/components/AuthDialog';
import { logout } from '@/features/auth/authSlice';

const navItems = [
  { label: 'Home', path: '/' },
  { label: 'Shop & Ship', path: '/shop-ship' },
  { label: 'Track Parcel', path: '/track' },
  { label: 'Calculate Cost', path: '/calculate' },
  { label: 'About', path: '/about' },
  { label: 'Contact', path: '/contact' },
];

const initialsOf = (name) =>
  (name || '?')
    .split(' ')
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join('')
    .toUpperCase();

const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState('signin');
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { token, user } = useSelector((state) => state.auth);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const openAuth = (mode) => {
    setAuthMode(mode);
    setOpen(false);
    setAuthOpen(true);
  };

  const handleLogout = () => {
    dispatch(logout());
    navigate('/');
  };

  return (
    <motion.nav
      initial={{ y: -100 }}
      animate={{ y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      className={'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ' + (scrolled ? 'bg-background/80 backdrop-blur-xl shadow-lg border-b border-border' : 'bg-transparent')}
    >
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-6">
        <Link to="/" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Package className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-xl font-bold text-foreground">
            Swift<span className="text-accent">Kifisha</span>
          </span>
        </Link>

        {/* Desktop */}
        <div className="hidden md:flex items-center gap-1">
          {navItems.slice(0, 4).map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={'px-3 py-2 rounded-lg text-sm font-medium transition-colors ' + (location.pathname === item.path ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
            >
              {item.label}
            </Link>
          ))}

          {token && user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="ml-2 flex items-center gap-2 rounded-full border border-border bg-background py-1 pl-1 pr-3 hover:bg-muted transition-colors">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback className="bg-accent text-accent-foreground text-xs">{initialsOf(user.name)}</AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium max-w-[110px] truncate">{user.name}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuLabel className="font-normal">
                  <p className="text-sm font-semibold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  {user.plan && (
                    <span className="mt-1 inline-block rounded-full bg-accent/10 text-accent px-2 py-0.5 text-[11px] font-medium uppercase tracking-wide">
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
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Button size="sm" variant="ghost" onClick={() => openAuth('signin')}>
                Sign In
              </Button>
              <Button size="sm" className="bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openAuth('signup')}>
                Join Free
              </Button>
            </div>
          )}
        </div>

        {/* Mobile */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild className="md:hidden">
            <Button variant="ghost" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <SheetTitle className="sr-only">Navigation Menu</SheetTitle>
            <div className="flex flex-col gap-2 mt-8">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setOpen(false)}
                  className={'px-4 py-3 rounded-lg text-sm font-medium transition-colors ' + (location.pathname === item.path ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted')}
                >
                  {item.label}
                </Link>
              ))}

              {token && user ? (
                <>
                  <div className="mt-2 flex items-center gap-3 rounded-lg border border-border px-4 py-3">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback className="bg-accent text-accent-foreground text-xs">{initialsOf(user.name)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </div>
                  <Link to="/account" onClick={() => setOpen(false)}>
                    <Button variant="outline" className="w-full justify-start">
                      <UserIcon className="mr-2 h-4 w-4" /> My Mailboxes & Plan
                    </Button>
                  </Link>
                  <Button variant="ghost" className="w-full justify-start text-destructive" onClick={() => { setOpen(false); handleLogout(); }}>
                    <LogOut className="mr-2 h-4 w-4" /> Sign out
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full mt-2" onClick={() => openAuth('signin')}>
                    Sign In
                  </Button>
                  <Button className="w-full bg-accent text-accent-foreground hover:bg-accent/90" onClick={() => openAuth('signup')}>
                    Join Free
                  </Button>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <AuthDialog open={authOpen} onOpenChange={setAuthOpen} initialMode={authMode} />
    </motion.nav>
  );
};

export default Navbar;
