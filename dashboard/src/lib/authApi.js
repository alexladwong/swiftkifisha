import axios from "axios";
import { axiosInstance } from "@/services/axiosInstance";

// Same JSON contract as the customer site (Express or Convex backend).
const FORGOT_PATH = import.meta.env.VITE_AUTH_FORGOT_PATH || "/auth/forgot-password";
const RESET_PATH = import.meta.env.VITE_AUTH_RESET_PATH || "/auth/reset-password";
const SOCIAL_SESSION_PATH = "/auth/social/session";
const SOCIAL_PROVIDERS_PATH = "/auth/social/providers";

/** POST /auth/forgot-password { email } → { message, devResetLink? } */
export const requestPasswordReset = async (email) => {
  const { data } = await axiosInstance.post(FORGOT_PATH, { email });
  return data;
};

/** POST /auth/reset-password { token, newPassword } → { message } */
export const resetPassword = async ({ token, newPassword }) => {
  const { data } = await axiosInstance.post(RESET_PATH, { token, newPassword });
  return data;
};

/* ----------------------------- social sign-in ----------------------------- */

const apiBaseUrl = () => {
  const base = import.meta.env.VITE_API_BASE_URL || "/api";
  if (/^https?:/i.test(base)) return base.replace(/\/+$/, "");
  const prefix = base.startsWith("/") ? base : "/" + base;
  return (window.location.origin + prefix).replace(/\/+$/, "");
};

/** GET /auth/social/providers → ["google"] (empty when unconfigured). */
export const fetchSocialProviders = async () => {
  const { data } = await axiosInstance.get(SOCIAL_PROVIDERS_PATH);
  return data?.providers || [];
};

export const socialSignInUrl = (provider, redirectPath = "/auth/callback") => {
  const callbackURL = window.location.origin + redirectPath;
  return `${apiBaseUrl()}/auth/sign-in/social?provider=${encodeURIComponent(provider)}&callbackURL=${encodeURIComponent(callbackURL)}`;
};

/** GET /auth/social/session (cookie) → { token, user } JSON contract. */
export const fetchSocialSession = async () => {
  const { data } = await axios.get(apiBaseUrl() + SOCIAL_SESSION_PATH, { withCredentials: true });
  return data;
};
