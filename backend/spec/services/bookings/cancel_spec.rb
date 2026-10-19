require "rails_helper"

RSpec.describe Bookings::Cancel do
  describe ".free_until" do
    let(:starts_on) { Date.current + 20 }

    def booking(policy, **values)
      build(:booking, :checkout, listing: build(:listing), starts_on:, cancellation_policy: policy, **values)
    end

    it "is the last day a guest can cancel for a full refund, by the policy" do
      expect(described_class.free_until(booking("free_cancellation"))).to eq(starts_on - 1)
      expect(described_class.free_until(booking("seven_days"))).to eq(starts_on - 7)
      expect(described_class.free_until(booking("fourteen_days"))).to eq(starts_on - 14)
    end

    it "is nil when nothing is refunded, or the booking was taken offline" do
      expect(described_class.free_until(booking("non_refundable"))).to be_nil
      expect(described_class.free_until(booking(nil))).to be_nil
      expect(described_class.free_until(build(:booking, starts_on:, cancellation_policy: "seven_days"))).to be_nil
    end

    it "agrees with the refund: in full up to that day, nothing after it" do
      paid = create(:booking, :checkout, starts_on:, cancellation_policy: "seven_days")
      on_the_day = (starts_on - 7).in_time_zone("UTC").noon
      expect(described_class.refund_cents(paid, by: "guest", at: on_the_day)).to eq(paid.total_cents)
      expect(described_class.refund_cents(paid, by: "guest", at: on_the_day + 1.day)).to eq(0)
    end
  end
end
