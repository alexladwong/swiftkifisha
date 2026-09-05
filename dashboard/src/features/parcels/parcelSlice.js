import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

export const fetchParcelsThunk = createAsyncThunk(
  "parcels/fetchAll",
  async (params, thunkAPI) => {
    try {
      const { page = 1, limit = 10, search = "" } = params || {};
      const { data } = await axiosInstance.get("/parcels", {
        params: { page, limit, search: search || undefined },
      });
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const createParcelThunk = createAsyncThunk(
  "parcels/create",
  async (payload, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post("/parcels", payload);
      toast.success(`Parcel Created: ${data.trackingId}`);
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const addCheckpointThunk = createAsyncThunk(
  "parcels/addCheckpoint",
  async ({ id, checkpoint }, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(
        `/parcels/${id}/checkpoint`,
        checkpoint,
      );
      toast.success(`Checkpoint Added`);
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const trackParcelThunk = createAsyncThunk(
  "parcels/track",
  async (trackingId, thunkAPI) => {
    try {
      const { data } = await axiosInstance.get(`/parcels/track/${trackingId}`);
      toast.success(`Parcel Found`);
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const initialState = {
  items: [],
  meta: { page: 1, limit: 10, total: 0, totalPages: 1 },
  loading: false,
  error: null,

  createLoading: false,
  createError: null,

  updateLoading: false,
  updateError: null,

  trackedParcel: null,
  trackError: null,
  trackLoading: false,
};

const parcelSlice = createSlice({
  name: "parcels",
  initialState,
  reducers: {
    clearTrack: (state) => {
      state.trackedParcel = null;
      state.trackError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchParcelsThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchParcelsThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload?.data || [];
        state.meta = {
          page: action.payload?.page || 1,
          limit: action.payload?.limit || 10,
          total: action.payload?.total || 0,
          totalPages: action.payload?.totalPages || 1,
        };
      })

      .addCase(fetchParcelsThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Failed to fetch parcels";
      })

      .addCase(createParcelThunk.pending, (state) => {
        state.createLoading = true;
        state.createError = null;
      })
      .addCase(createParcelThunk.fulfilled, (state, action) => {
        state.createLoading = false;
        state.items = [action.payload, ...state.items];
        state.meta.total += 1;
      })
      .addCase(createParcelThunk.rejected, (state, action) => {
        state.createLoading = false;
        state.createError = action.payload || "Failed to create parcel";
      })

      .addCase(addCheckpointThunk.pending, (state) => {
        state.updateLoading = true;
        state.updateError = null;
      })
      .addCase(addCheckpointThunk.fulfilled, (state, action) => {
        state.updateLoading = false;
        const updated = action.payload;
        state.items = state.items.map((p) =>
          p._id === updated._id ? updated : p,
        );
        if (state.trackedParcel?._id === updated._id) {
          state.trackedParcel = updated;
        }
      })
      .addCase(addCheckpointThunk.rejected, (state, action) => {
        state.updateLoading = false;
        state.updateError = action.payload || "Failed to add checkpoint";
      })

      .addCase(trackParcelThunk.pending, (state) => {
        state.trackLoading = true;
        state.trackError = null;
        state.trackedParcel = null;
      })
      .addCase(trackParcelThunk.fulfilled, (state, action) => {
        state.trackLoading = false;
        state.trackedParcel = action.payload;
      })
      .addCase(trackParcelThunk.rejected, (state, action) => {
        state.trackLoading = false;
        state.trackError = action.payload || "Failed to track parcel";
      });
  },
});

export const { clearTrack } = parcelSlice.actions;
export default parcelSlice.reducer;
