import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

export const fetchAnalyticsThunk = createAsyncThunk(
  "analytics/fetchAll",
  async (_, thunkAPI) => {
    try {
      const [summaryRes, revenueRes, parcelRes, topCitiesRes, deliveryPrefRes] =
        await Promise.all([
          axiosInstance.get("/analytics/summary"),
          axiosInstance.get("/analytics/revenue"),
          axiosInstance.get("/analytics/parcels"),
          axiosInstance.get("/analytics/top-cities"),
          axiosInstance.get("/analytics/delivery-performance"),
        ]);

      return {
        summary: summaryRes.data,
        revenueData: revenueRes.data,
        parcelGrowthData: parcelRes.data,
        topCitiesData: topCitiesRes.data,
        deliveryPerformanceData: deliveryPrefRes.data,
      };
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const initialState = {
  summary: null,
  revenueData: [],
  parcelGrowthData: [],
  topCitiesData: [],
  deliveryPerformanceData: [],
  loading: false,
  error: null,
};

const analyticsSlice = createSlice({
  name: "analytics",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAnalyticsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchAnalyticsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.summary = action.payload.summary;
        state.revenueData = action.payload.revenueData || [];
        state.parcelGrowthData = action.payload.parcelGrowthData || [];
        state.topCitiesData = action.payload.topCitiesData || [];
        state.deliveryPerformanceData =
          action.payload.deliveryPerformanceData || [];
      })
      .addCase(fetchAnalyticsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to load analytics";
      });
  },
});

export default analyticsSlice.reducer;
