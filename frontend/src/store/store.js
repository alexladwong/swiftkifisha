import { configureStore } from "@reduxjs/toolkit";
import parcelReducer from "@/features/parcels/parcelSlice";
import authReducer from "@/features/auth/authSlice";

export const store = configureStore({
  reducer: {
    parcels: parcelReducer,
    auth: authReducer,
  },
});