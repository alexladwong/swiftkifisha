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
import NotFound from "@/pages/NotFound";
import ProtectedRoute from "@/components/ProtectedRoute";
import Analytics from "./pages/Analytics";
import AddAdmin from "@/pages/AddAdmin";

const App = () => (
  <TooltipProvider>
    <Toaster />
    <Sonner />
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<DashboardLayout />}>
            <Route path="/" element={<Dashboard />} />
            <Route path="/create-parcel" element={<CreateParcel />} />
            <Route path="/manage-parcels" element={<ManageParcels />} />
            <Route path="/parcel/:id" element={<ParcelDetails />} />
            <Route path="/tracking" element={<ParcelTracking />} />
            <Route path="/analytics" element={<Analytics />} />
            <Route path="/add-admin" element={<AddAdmin />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  </TooltipProvider>
);
export default App;
