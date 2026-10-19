// The cancellation policies a booking can be made under, as a guest reads them: the name the
// partner picked (Listing::CANCELLATION_POLICIES) and what it means for a refund. Shared by the
// bookings page's cancel dialog and the cart's item panel (RAA-135). The deadline itself comes
// from the API (free_cancellation_until), never worked out here.
export const CANCELLATION_POLICY: Record<string, { name: string; rule: string }> = {
  free_cancellation: { name: "Free cancellation", rule: "Free cancellation until the day before it starts." },
  seven_days: { name: "7-day cancellation", rule: "Free cancellation until 7 days before it starts." },
  fourteen_days: { name: "14-day cancellation", rule: "Free cancellation until 14 days before it starts." },
  non_refundable: { name: "Non-refundable", rule: "Non-refundable." },
};
