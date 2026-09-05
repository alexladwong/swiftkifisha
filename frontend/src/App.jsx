import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Header from "@/components/layout/Header";
import Footer from "@/components/Footer";
import Index from "./pages/Index";
import ShopShip from "./pages/ShopShip";
import PortalShell from "@/components/portal/PortalShell";
import AccountOverview from "./pages/account/Overview";
import AccountProfile from "./pages/account/ProfileSection";
import AccountAddresses from "./pages/account/AddressesSection";
import AccountSecurity from "./pages/account/SecuritySection";
import TrackParcel from "./pages/TrackParcel";
import CalculateCost from "./pages/CalculateCost";
import About from "./pages/About";
import Contact from "./pages/Contact";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import SocialCallback from "./pages/SocialCallback";
import NotFound from "./pages/NotFound";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[90] focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>
      <Header />
      <main id="main" className="contents">
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/shop-ship" element={<ShopShip />} />
        <Route path="/account" element={<PortalShell />}>
          <Route index element={<AccountOverview />} />
          <Route path="profile" element={<AccountProfile />} />
          <Route path="addresses" element={<AccountAddresses />} />
          <Route path="security" element={<AccountSecurity />} />
        </Route>
        <Route path="/track" element={<TrackParcel />} />
        <Route path="/calculate" element={<CalculateCost />} />
        <Route path="/about" element={<About />} />
        <Route path="/contact" element={<Contact />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/auth/callback" element={<SocialCallback />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      </main>
      <Footer />
    </BrowserRouter>
  </TooltipProvider>
);

export default App;