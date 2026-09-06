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
