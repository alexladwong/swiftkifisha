import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

const LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH || "/auth/login";
const ADD_USER_PATH = import.meta.env.VITE_AUTH_ADD_USER_PATH || "/auth/add-user";
const ADMIN_OTP_VERIFY_PATH = import.meta.env.VITE_AUTH_OTP_VERIFY_PATH || "/auth/admin/otp/verify";
const ADMIN_DEV_LOGIN_PATH = "/auth/admin/dev-login";

export const loginThunk = createAsyncThunk(
  "auth/login",
  async (payload, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(LOGIN_PATH, payload);
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || null));
      toast.success("Logged In");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const adminOtpVerifyThunk = createAsyncThunk(
  "auth/otpVerify",
  async ({ email, code }, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(ADMIN_OTP_VERIFY_PATH, { email, code });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || null));
      toast.success("Logged In");
      return data;
    } catch (error) {
      const message = getErrorMessage(error);
      toast.error(message);
      return thunkAPI.rejectWithValue(message);
    }
  },
);

export const adminDevLoginThunk = createAsyncThunk(
  "auth/devLogin",
  async ({ email, password }, thunkAPI) => {
    try {
      const { data } = await axiosInstance.post(ADMIN_DEV_LOGIN_PATH, { email, password });
      localStorage.setItem("token", data.token);
      localStorage.setItem("user", JSON.stringify(data.user || null));
      toast.success("Logged In (developer)");
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

const storedUser = () => {
  try {
    return JSON.parse(localStorage.getItem("user") || "null");
  } catch {
    return null;
  }
};

const initialState = {
  token: localStorage.getItem("token") || null,
  user: storedUser(),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    logout: (state) => {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
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
      })
      .addCase(adminOtpVerifyThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(adminOtpVerifyThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
      })
      .addCase(adminOtpVerifyThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Sign-in failed";
      })
      .addCase(adminDevLoginThunk.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(adminDevLoginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
      })
      .addCase(adminDevLoginThunk.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || "Developer login failed";
      });
  },
});

export const { logout } = authSlice.actions;
export default authSlice.reducer;