import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { DashboardLayout } from "@/components/DashboardLayout";
import Dashboard from "@/pages/Dashboard";
import CreateParcel from "@/pages/CreateParcel";
import ManageParcels from "@/pages/ManageParcels";
import ParcelDetails from "@/pages/ParcelDetails";
import ParcelTracking from "@/pages/ParcelTracking";
import LoginPage from "@/pages/Login";
import ResetPasswordPage from "@/pages/ResetPassword";
import SocialCallbackPage from "@/pages/SocialCallback";
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import Analytics from "./pages/Analytics";
import AddAdmin from "@/pages/AddAdmin";
import Members from "@/pages/Members";
import SecurityPage from "@/pages/Security";
import ProfilePage from "@/pages/Profile";
import MembershipApplicationsPage from "@/pages/MembershipApplications";
import MessagesPage from "@/pages/Messages";
import AnnouncementsPage from "@/pages/Announcements";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/auth/callback" element={<SocialCallbackPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-parcel" element={<CreateParcel />} />
            <Route path="/manage-parcels" element={<ManageParcels />} />
            <Route path="/parcel/:id" element={<ParcelDetails />} />
            <Route path="/tracking" element={<ParcelTracking />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/add-admin" element={<AddAdmin />} />
            <Route path="/members" element={<Members />} />
            <Route path="/security" element={<SecurityPage />} />
            <Route path="/profile" element={<ProfilePage />} />
            <Route path="/membership-applications" element={<MembershipApplicationsPage />} />
            <Route path="/messages" element={<MessagesPage />} />
            <Route path="/announcements" element={<AnnouncementsPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);
export default App;
