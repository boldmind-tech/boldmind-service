/** Events BoldmindNG fires — kept in sync with boldmind-service-canonical.md §4.17 */
export const WEBHOOK_EVENTS = [
  "payment.success",
  "payment.failed",
  "subscription.activated",
  "subscription.cancelled",
  "article.published",
  "user.registered",
  "vibecoders.applicant.applied",
] as const;

export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];
