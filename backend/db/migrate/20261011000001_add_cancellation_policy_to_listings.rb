# Cancellation policies (RAA-88): what a guest gets back on cancelling, chosen by the
# partner for each listing. Existing listings are free to cancel. Refunds follow it in M4.
class AddCancellationPolicyToListings < ActiveRecord::Migration[8.1]
  def change
    add_column :listings, :cancellation_policy, :string, default: "free_cancellation", null: false
    add_check_constraint :listings,
      "cancellation_policy IN ('free_cancellation', 'non_refundable', 'seven_days', 'fourteen_days')",
      name: "listings_cancellation_policy_check"
  end
end
