require "rails_helper"

RSpec.describe "The booking lifecycle" do
  include ActiveSupport::Testing::TimeHelpers

  let(:today) { Date.current }
  let(:listing) { create(:listing, :stay) }

  describe Bookings::Transition do
    let(:booking) { create(:booking, :checkout, listing:, status: "requested", expires_at: 1.hour.from_now) }

    it "moves along the lifecycle, recording who and why" do
      Bookings::Transition.call(booking, "accepted", actor: "partner", user: listing.partner)
      Bookings::Transition.call(booking, "awaiting_payment", actor: "system")

      expect(booking).to be_awaiting_payment
      expect(booking.responded_at).to be_present
      expect(booking.expires_at).to be_future
      expect(booking.events.pluck(:from_status, :to_status, :actor)).to eq(
        [ %w[requested accepted partner], %w[accepted awaiting_payment system] ]
      )
    end

    it "gives an accepted request a day to be paid, or until the day it starts" do
      booking.update!(starts_on: today + 10, ends_on: today + 12)
      Bookings::Transition.call(booking, "accepted", actor: "partner", user: listing.partner)
      Bookings::Transition.call(booking, "awaiting_payment", actor: "system")
      expect(booking.expires_at).to be_within(1.minute).of(Booking::ACCEPTED_PAYMENT_TTL.from_now)

      soon = create(:booking, :checkout, listing:, status: "accepted", starts_on: today + 1, ends_on: today + 2)
      travel_to(soon.starts_on.in_time_zone("UTC").beginning_of_day - 3.hours) do
        Bookings::Transition.call(soon, "awaiting_payment", actor: "system")
        expect(soon.expires_at).to eq(soon.starts_on.in_time_zone("UTC").beginning_of_day)
      end
    end

    it "never gives an accepted request less time to pay than an instant hold" do
      soon = create(:booking, :checkout, listing:, status: "accepted", starts_on: today, ends_on: today + 1)
      Bookings::Transition.call(soon, "awaiting_payment", actor: "system")
      expect(soon.expires_at).to be_within(1.minute).of(Booking::PAYMENT_TTL.from_now)
    end

    it "refuses a move the lifecycle doesn't allow, and changes nothing" do
      expect { Bookings::Transition.call(booking, "completed", actor: "system") }
        .to raise_error(ActiveRecord::RecordInvalid, /A booking that is requested can't be completed/)
      expect(booking.reload).to be_requested
      expect(booking.events).to be_empty
    end

    it "changes nothing when the booking already has that status" do
      expect { Bookings::Transition.call(booking, "requested", actor: "system") }.not_to change(BookingEvent, :count)
    end

    it "never leaves a declined, cancelled or expired booking" do
      %w[declined cancelled expired].each do |status|
        expect(Bookings::Transition::ALLOWED.fetch(status)).to be_empty
      end
    end
  end

  describe Bookings::Expire do
    it "expires unanswered requests and unpaid holds, freeing their days" do
      late_request = create(:booking, :checkout, listing:, status: "requested", expires_at: 1.minute.ago)
      late_hold = create(:booking, :checkout, listing:, status: "awaiting_payment", expires_at: 1.minute.ago,
        starts_on: today + 5, ends_on: today + 6)
      waiting = create(:booking, :checkout, listing:, status: "requested", expires_at: 1.hour.from_now,
        starts_on: today + 8, ends_on: today + 9)

      expect(Bookings::Expire.call).to eq(2)

      expect(late_request.reload).to be_expired
      expect(late_request.events.last).to have_attributes(actor: "system", reason: "Not answered in time")
      expect(late_hold.reload.events.last.reason).to eq("Not paid in time")
      expect(waiting.reload).to be_requested
      ledger = Availability::Ledger.new([ listing ], today + 1, today + 2)
      expect(ledger.day(listing, today + 1)[:booked]).to eq(0)
    end
  end

  describe Bookings::Progress do
    it "starts bookings on their first day and completes them once their last day has passed" do
      starting = create(:booking, :checkout, listing:, starts_on: today, ends_on: today + 2)
      # A stay's last night is the one before check-out.
      checking_out = create(:booking, :checkout, listing:, starts_on: today - 2, ends_on: today, status: "in_progress")
      missed = create(:booking, :checkout, listing:, starts_on: today - 5, ends_on: today - 3)
      later = create(:booking, :checkout, listing:, starts_on: today + 4, ends_on: today + 5)

      expect(Bookings::Progress.call).to eq(3)

      expect(starting.reload).to be_in_progress
      expect(checking_out.reload).to be_completed
      expect(missed.reload).to be_completed
      expect(missed.events.pluck(:to_status)).to eq(%w[in_progress completed])
      expect(later.reload).to be_confirmed
    end
  end

  describe Bookings::Cancel, ".refund_cents" do
    def refund(policy, starts_in_days, by: "guest", paid: true)
      booking = build(:booking, :checkout, listing:, cancellation_policy: policy, starts_on: today + starts_in_days,
        ends_on: today + starts_in_days + 1, status: paid ? "confirmed" : "requested")
      Bookings::Cancel.refund_cents(booking, by:)
    end

    it "follows the policy the booking was made under" do
      expect(refund("free_cancellation", 1)).to eq(400_000)
      expect(refund("non_refundable", 30)).to eq(0)
      expect(refund("seven_days", 7)).to eq(400_000)
      expect(refund("seven_days", 6)).to eq(0)
      expect(refund("fourteen_days", 14)).to eq(400_000)
      expect(refund("fourteen_days", 13)).to eq(0)
    end

    it "refunds in full when the partner cancels, and nothing when nothing was paid" do
      expect(refund("non_refundable", 1, by: "partner")).to eq(400_000)
      expect(refund("free_cancellation", 10, paid: false)).to eq(0)
    end

    it "records no refund for an offline booking" do
      expect(Bookings::Cancel.refund_cents(build(:booking, listing:), by: "partner")).to be_nil
    end
  end

  describe Trips::Cleanup do
    it "keeps a trip with booked items, deleting only its unbooked ones" do
      trip = create(:trip)
      trip.update_columns(starts_on: today - 20, ends_on: today - 18)
      booked = create(:trip_item, trip:, listing:, starts_on: nil, ends_on: nil)
      unbooked = create(:trip_item, trip:, listing: create(:listing), starts_on: nil, ends_on: nil)
      create(:booking, :checkout, listing:, trip_item: booked, user: trip.user, status: "completed",
        starts_on: today - 20, ends_on: today - 19)

      expect(Trips::Cleanup.call).to eq(0)

      expect(trip.reload.items).to eq([ booked ])
      expect(TripItem.exists?(unbooked.id)).to be(false)
    end
  end
end
