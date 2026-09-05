import { configureStore } from "@reduxjs/toolkit";
import authReducer from "@/features/auth/authSlice";
import parcelReducer from "@/features/parcels/parcelSlice";
import dashboardReducer from "@/features/dashboard/dashboardSlice";
import analyticsReducer from "@/features/analytics/analyticsSlice";

export const store = configureStore({
  reducer: {
    auth: authReducer,
    parcels: parcelReducer,
    dashboard: dashboardReducer,
    analytics: analyticsReducer,
  },
});
