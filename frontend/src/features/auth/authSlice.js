import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { toast } from "sonner";
import { axiosInstance } from "@/services/axiosInstance";

const LOGIN_PATH = import.meta.env.VITE_AUTH_LOGIN_PATH || "/auth/login";
const SIGNUP_PATH = import.meta.env.VITE_AUTH_SIGNUP_PATH || "/auth/signup";

const getErrorMessage = (error) =>
  error?.response?.data?.message || error?.message || "Something went wrong";

const stored = () => {
  try {
    const token = localStorage.getItem("token");
    const user = JSON.parse(localStorage.getItem("user") || "null");
    return { token, user };
  } catch {
    return { token: null, user: null };
  }
};

export const loginThunk = createAsyncThunk("auth/login", async (payload, thunkAPI) => {
  try {
    const { data } = await axiosInstance.post(LOGIN_PATH, payload);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user || null));
    toast.success("Welcome back, " + (data.user?.name || "member"));
    return data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    return thunkAPI.rejectWithValue(message);
  }
});

export const signupThunk = createAsyncThunk("auth/signup", async (payload, thunkAPI) => {
  try {
    const { data } = await axiosInstance.post(SIGNUP_PATH, payload);
    localStorage.setItem("token", data.token);
    localStorage.setItem("user", JSON.stringify(data.user || null));
    toast.success("Account created - welcome to SwiftKifisha!");
    return data;
  } catch (error) {
    const message = getErrorMessage(error);
    toast.error(message);
    return thunkAPI.rejectWithValue(message);
  }
});

const initialState = { ...stored(), loading: false, error: null };

const authSlice = createSlice({
  name: "auth",
  initialState,
  reducers: {
    // Used after OAuth/session exchange completes on /auth/callback so the
    // in-memory state matches localStorage without a full page reload.
    setSession: (state, action) => {
      const { token, user } = action.payload || {};
      state.token = token || null;
      state.user = user || null;
      state.error = null;
      if (token) localStorage.setItem("token", token);
      else localStorage.removeItem("token");
      if (user) localStorage.setItem("user", JSON.stringify(user));
      else localStorage.removeItem("user");
    },
    updateUser: (state, action) => {
      state.user = { ...(state.user || {}), ...action.payload };
      localStorage.setItem("user", JSON.stringify(state.user));
    },
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
      .addCase(loginThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(loginThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
      })
      .addCase(loginThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload || "Login failed"; })
      .addCase(signupThunk.pending, (state) => { state.loading = true; state.error = null; })
      .addCase(signupThunk.fulfilled, (state, action) => {
        state.loading = false;
        state.token = action.payload?.token || null;
        state.user = action.payload?.user || null;
      })
      .addCase(signupThunk.rejected, (state, action) => { state.loading = false; state.error = action.payload || "Sign up failed"; });
  },
});

export const { logout, updateUser, setSession } = authSlice.actions;
export default authSlice.reducer;