import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

const LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH || "/auth/login";
const ADD_USER_PATH = import.meta.env.VITE_AUTH_ADD_USER_PATH || "/auth/add-user";

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (payload, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(LOGIN_PATH, payload);
      localStorage.setItem("token", data.token);
      toast.success("Logged In");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const addUserThunk = createAsyncThunk(
  "auth/addUser",
  async (payload, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(ADD_USER_PATH, payload);
      toast.success("User Created");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

const initialState = {
  token: localStorage.getItem("token") || null,
  user: null,
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem("token");
      state.token = null;
      state.user = null;
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
      })
      .addCase(loginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Login Failed";
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;