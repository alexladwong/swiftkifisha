import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const getErrorMessage = (error) =>
  error?.response.data?.message || error?.message || "Something webt wrong";

export const trackParcelThunk = createAsyncThunk(
  "parcels/track",
  async (trackingId, thunkAPI) => {
    try {
      const { data } = await axiosInstance.get(`/parcels/track/${trackingId}`);
      toast.success("Parcel found");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const calculateCostThunk = createAsyncThunk(
  "parcels/calculateCost",
  async (payload, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(
        `/parcels/calculate-cost`,
        payload,
      );
      toast.success("Cost calculated");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const initialState = {
  trackParcel: null,
  trackLoading: false,
  trackError: null,

  costQuote: null,
  costLoading: false,
  costError: null,
};

const parcelSlice = createSlice({
  name: "parcels",
  initialState,
  reducers: {
    clearTrack: (state) => {
      state.trackParcel = null;
      state.trackError = null;
    },
    clearCost: (state) => {
      state.costQuote = null;
      state.costError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(trackParcelThunk.pending, (state) => {
        state.trackLoading = true;
        state.trackError = null;
        state.trackParcel = null;
      })
      .addCase(trackParcelThunk.fulfilled, (state, action) => {
        state.trackLoading = false;
        state.trackParcel = action.payload;
      })
      .addCase(trackParcelThunk.rejected, (state, action) => {
        state.trackLoading = false;
        state.trackError = action.payload || "Failed to track parcel";
      })
      .addCase(calculateCostThunk.pending, (state) => {
        state.costQuote = null;
        state.costError = null;
        state.costLoading = true;
      })
      .addCase(calculateCostThunk.fulfilled, (state, action) => {
        state.costQuote = action.payload;
        state.costLoading = false;
      })
      .addCase(calculateCostThunk.rejected, (state) => {
        state.costError = action.payload || "Failed to calculate cost";
        state.costLoading = false;
      });
  },
});

export const { clearCost, clearTrack } = parcelSlice.actions;
export default parcelSlice.reducer;
