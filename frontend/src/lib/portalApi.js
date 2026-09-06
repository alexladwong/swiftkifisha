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

/* ------------------------- billing, invoices, payments & wallet ------------------------- */

export const fetchBillingOverview = async () => {
  const { data } = await axiosInstance.get("/billing/overview", { headers: auth() });
  return data; // { wallet, openInvoiceCount, openBalance, unpaidPayments, recentInvoices, recentPayments }
};

export const fetchMyInvoices = async () => {
  const { data } = await axiosInstance.get("/invoices", { headers: auth() });
  return data.invoices || [];
};

export const fetchInvoice = async (idOrInvoiceId) => {
  const { data } = await axiosInstance.get("/invoices/" + encodeURIComponent(idOrInvoiceId), {
    headers: auth(),
  });
  return data; // { invoice, payments, shipment, packages }
};

export const cancelInvoice = async (idOrInvoiceId, reason) => {
  const { data } = await axiosInstance.post(
    "/invoices/" + encodeURIComponent(idOrInvoiceId) + "/cancel",
    { reason: reason || undefined },
    { headers: auth() },
  );
  return data; // { message, invoice } — the API may answer 409 with { message }
};

export const fetchMyPayments = async () => {
  const { data } = await axiosInstance.get("/payments", { headers: auth() });
  return data.payments || [];
};

export const cancelPayment = async (idOrPaymentId) => {
  const { data } = await axiosInstance.post(
    "/payments/" + encodeURIComponent(idOrPaymentId) + "/cancel",
    {},
    { headers: auth() },
  );
  return data; // { message, payment } — pending only
};

export const fetchWallet = async () => {
  const { data } = await axiosInstance.get("/wallet", { headers: auth() });
  return data; // { balance, currency, entries, walletCurrency, balances, minTopup, rateUsdUgx }
};

export const payInvoiceFromWallet = async (invoiceId) => {
  const { data } = await axiosInstance.post("/wallet/pay-invoice", { invoiceId }, { headers: auth() });
  return data; // { message, payment, invoice, shipment? }
};

export const topUpWallet = async (payload) => {
  const { data } = await axiosInstance.post("/wallet/topup", payload, { headers: auth() });
  return data; // 201 { message, payment, paymentInstructions, channels, walletCurrency, minTopup }
};

export const createCheckout = async (payload) => {
  const { data } = await axiosInstance.post("/checkout", payload, { headers: auth() });
  return data; // 201 { message, invoice, payment, paymentInstructions, channels }
};

/* ------------------------- referrals & points ------------------------- */

export const fetchReferralInfo = async () => {
  const { data } = await axiosInstance.get("/referrals", { headers: auth() });
  return data; // { code, link, stats: { invitedSignups, accepted, balance } }
};

export const fetchReferralPoints = async () => {
  const { data } = await axiosInstance.get("/referrals/points", { headers: auth() });
  return data; // { balance, entries: [{ type, points, reason, createdAt }] }
};

export const redeemReferralPoints = async (points) => {
  const { data } = await axiosInstance.post("/referrals/redeem", { points }, { headers: auth() });
  return data; // { message, pointsDebited, usdCredited, balance, walletBalance }
};

/* ------------------------- payment lifecycle (manual money) ------------------------- */

/** GET /payments/:id — own payment + mobileMoney block (public only). */
export const fetchPayment = async (idOrPaymentId) => {
  const { data } = await axiosInstance.get(`/payments/${idOrPaymentId}`, { headers: auth() });
  return data; // { payment, mobileMoney?: { method, network, amount, currency, ussd, qrUrl, dialUrl, invoiceReference } }
};

/**
 * POST /payments/:id/submit — multipart (reference required; note?;
 * screenshot? optional image ≤ 5 MB). Moves PENDING → PAYMENT_SUBMITTED;
 * NEVER marks paid.
 */
export const submitPaymentReference = async (idOrPaymentId, { reference, note, screenshot }) => {
  const fd = new FormData();
  fd.append("reference", reference);
  if (note) fd.append("note", note);
  if (screenshot) fd.append("screenshot", screenshot);
  const { data } = await axiosInstance.post(`/payments/${idOrPaymentId}/submit`, fd, {
    headers: { ...auth(), "Content-Type": "multipart/form-data" },
  });
  return data; // { message, payment }
};

/** Strip a leading /api when the axios base URL already ends with /api. */
const apiPath = (url) => {
  const u = String(url || "");
  const base = axiosInstance.defaults.baseURL || "";
  return u.startsWith("/api") && base.endsWith("/api") ? u.slice(4) || "/" : u;
};

/** Authenticated fetch of a protected URL (QR image) → object URL (revoke after use). */
export const fetchBlobUrl = async (url, mime = "image/png") => {
  const res = await axiosInstance.get(apiPath(url), { headers: auth(), responseType: "blob" });
  return URL.createObjectURL(new Blob([res.data], { type: mime }));
};

/** GET payment dial tel: URI (owner only; call on explicit "Pay on phone" tap). */
export const fetchDialUri = async (dialUrl) => {
  const { data } = await axiosInstance.get(apiPath(dialUrl), { headers: auth() });
  return data.telUri; // tel:*165*…%23
};

/* ------------------------- M-Pesa (Daraja) ------------------------- */

/** POST /payments/mpesa/stk-push { paymentId, phoneNumber } → STK push (server amount). */
export const startMpesaPush = async (paymentId, phoneNumber) => {
  const { data } = await axiosInstance.post("/payments/mpesa/stk-push", { paymentId, phoneNumber }, { headers: auth() });
  return data; // { paymentId, status, message, checkoutRequestId }
};

/** POST /payments/:id/refresh — Daraja status query (throttled server-side). */
export const refreshPayment = async (idOrPaymentId) => {
  const { data } = await axiosInstance.post(`/payments/${idOrPaymentId}/refresh`, {}, { headers: auth() });
  return data; // { paymentId, status, message }
};

/* ------------------------- international: consolidations & customs ------------------------- */

/** GET /api/consolidations — my consolidation requests (newest first). */
export const fetchMyConsolidations = async () => {
  const { data } = await axiosInstance.get("/consolidations", { headers: auth() });
  return data.consolidations || [];
};

/** POST /api/consolidations { packageIds: [2+], note?, repack? } → 201 { message, consolidation }. */
export const createConsolidation = async (payload) => {
  const { data } = await axiosInstance.post("/consolidations", payload, { headers: auth() });
  return data; // the API may answer 400/403/409 with { message } — show it verbatim
};

/** GET /api/customs/me — my customs declarations (newest first). */
export const fetchMyDeclarations = async () => {
  const { data } = await axiosInstance.get("/customs/me", { headers: auth() });
  return data.declarations || [];
};

/** POST /api/customs { packageIds: [1+], purpose, currency?, items } → 201 { message, declaration }. */
export const createCustomsDeclaration = async (payload) => {
  const { data } = await axiosInstance.post("/customs", payload, { headers: auth() });
  return data; // the API may answer 400/403/409 with { message } — show it verbatim
};

/** GET /api/restricted/categories — advisory list of restricted/prohibited item categories. */
export const fetchRestrictedCategories = async () => {
  const { data } = await axiosInstance.get("/restricted/categories", { headers: auth() });
  return data; // { categories: [{ code, label, note }], note }
};
