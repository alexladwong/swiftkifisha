import { axiosInstance } from "@/services/axiosInstance";

const auth = () => {
  const token = localStorage.getItem("token");
  return { Authorization: "Bearer " + (token || "") };
};

export const fetchMe = async () => {
  const { data } = await axiosInstance.get("/members/me", { headers: auth() });
  return data.member;
};

export const fetchMyParcels = async (limit = 10) => {
  const { data } = await axiosInstance.get("/members/me/parcels", { params: { limit }, headers: auth() });
  return data;
};

export const updateMe = async (payload) => {
  const { data } = await axiosInstance.patch("/members/me", payload, { headers: auth() });
  return data;
};

export const fetchMembershipStatus = async () => {
  const { data } = await axiosInstance.get("/auth/membership/status", { headers: auth() });
  return data; // { status, note? }
};

export const changePassword = async (payload) => {
  const { data } = await axiosInstance.post(
    import.meta.env.VITE_AUTH_CHANGE_PASSWORD_PATH || "/auth/change-password",
    payload,
    { headers: auth() },
  );
  return data;
};

/* ------------------------- commercial package forwarding ------------------------- */

export const fetchMyPackages = async (status) => {
  const { data } = await axiosInstance.get("/packages", {
    params: status ? { status } : undefined,
    headers: auth(),
  });
  return data.packages || [];
};

export const fetchPackage = async (id) => {
  const { data } = await axiosInstance.get("/packages/" + encodeURIComponent(id), { headers: auth() });
  return data.package;
};

export const preAlertPackage = async (payload) => {
  const { data } = await axiosInstance.post("/packages/pre-alert", payload, { headers: auth() });
  return data; // { message, package }
};

export const requestPackageAction = async (id, action, note) => {
  const { data } = await axiosInstance.post(
    "/packages/" + encodeURIComponent(id) + "/action",
    { action, note },
    { headers: auth() },
  );
  return data; // { message, package } — the API may answer 409 with { message }
};

export const fetchOverviewStats = async () => {
  const { data } = await axiosInstance.get("/account/overview-stats", { headers: auth() });
  return data;
};

export const fetchMailboxes = async () => {
  const { data } = await axiosInstance.get("/mailboxes", { headers: auth() });
  return data.mailboxes || [];
};

export const createShippingQuote = async (payload) => {
  const { data } = await axiosInstance.post("/quotes", payload, { headers: auth() });
  return data.quote;
};

/** Photo files are stored server-side and only served with the bearer token.
 * Returns an object URL the caller must revoke (use the blob URL in an <img>
 * and call URL.revokeObjectURL once it is no longer needed). */
export const fetchPhotoUrl = async (filename) => {
  const res = await axiosInstance.get("/files/packages/" + encodeURIComponent(filename), {
    headers: auth(),
    responseType: "blob",
  });
  return URL.createObjectURL(res.data);
};
