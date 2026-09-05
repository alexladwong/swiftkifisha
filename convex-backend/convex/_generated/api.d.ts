/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as adminTools from "../adminTools.js";
import type * as analytics from "../analytics.js";
import type * as authbridge from "../authbridge.js";
import type * as http from "../http.js";
import type * as lib_agg from "../lib/agg.js";
import type * as lib_authz from "../lib/authz.js";
import type * as lib_intl from "../lib/intl.js";
import type * as lib_pricing from "../lib/pricing.js";
import type * as lib_pricingFx from "../lib/pricingFx.js";
import type * as lib_types from "../lib/types.js";
import type * as members from "../members.js";
import type * as parcels from "../parcels.js";
import type * as seed from "../seed.js";
import type * as shop from "../shop.js";
import type * as stats from "../stats.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  adminTools: typeof adminTools;
  analytics: typeof analytics;
  authbridge: typeof authbridge;
  http: typeof http;
  "lib/agg": typeof lib_agg;
  "lib/authz": typeof lib_authz;
  "lib/intl": typeof lib_intl;
  "lib/pricing": typeof lib_pricing;
  "lib/pricingFx": typeof lib_pricingFx;
  "lib/types": typeof lib_types;
  members: typeof members;
  parcels: typeof parcels;
  seed: typeof seed;
  shop: typeof shop;
  stats: typeof stats;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {
  betterAuth: import("../betterAuth/_generated/component.js").ComponentApi<"betterAuth">;
};
