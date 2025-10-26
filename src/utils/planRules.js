// File: src/utils/planRules.js

// Minimal plan requirement per feature (used across the app)
export const FeaturePlan = {
  journalAccess: 'premium', // Journal from Premium upwards
  lucidAccess:   'pro',     // Lucid from Pro/ProPlus
  mediaAccess:   'pro',     // Media from Pro/ProPlus
};

// Simple rank ladder
export const TIER_RANK = { free: 0, premium: 1, pro: 2 };

/**
 * Normalize any plan string to one of: 'free' | 'premium' | 'pro'
 * - Treat all "ProPlus" variants as 'pro' (proplus, pro+, pro plus, pro_plus, pro-plus)
 * - Unknown => 'free'
 */
export function normalizePlan(plan) {
  if (plan == null) return 'free';
  const v = String(plan).trim().toLowerCase();

  // remove spaces, underscores and dashes for easy matching
  const compact = v.replace(/[\s_\-]+/g, '');

  // ProPlus variants -> 'pro'
  if (/^pro(\+|plus)?$/.test(compact)) return 'pro';

  if (compact === 'premium') return 'premium';
  if (compact === 'free') return 'free';

  // safe fallback
  return 'free';
}

/**
 * Does the user have access to a feature that requires 'need'?
 * 'need' must be one of 'free' | 'premium' | 'pro'
 */
export function hasAccess(userPlan, need) {
  const user = normalizePlan(userPlan);
  const req  = normalizePlan(need);
  const u = TIER_RANK[user] ?? 0;
  const r = TIER_RANK[req];
  if (typeof r !== 'number') return false;
  return u >= r;
}

/**
 * Show ads only to Free users.
 * (Premium / Pro / ProPlus: no ads)
 */
export function shouldShowAds(userPlan) {
  // Equivalent to: return !hasAccess(userPlan, 'premium');
  return normalizePlan(userPlan) === 'free';
}
