import { configureStore } from "@reduxjs/toolkit";
import parcelReducer from "@/features/parcels/parcelSlice";

export const store = configureStore({
  reducer: {
    parcels: parcelReducer,
  },
});
