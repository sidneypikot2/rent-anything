require "rails_helper"

RSpec.describe Bookings::Change do
  let(:today) { Date.current }
  let(:user) { create(:user) }
  let(:listing) { create(:listing, :stay) }
  let(:item) { create(:trip_item, trip: create(:trip, user:), listing:, starts_on: today + 10, ends_on: today + 12) }

  def booking_with(status:)
    create(:booking, :checkout, listing:, user:, trip_item: item, starts_on: today + 10, ends_on: today + 12, status:)
  end

  def change_booking(booking, **params)
    Bookings::Change.call(booking, user:, params: ActionController::Parameters.new(params))
  end

  it "sends a confirmed booking back to its partner as a request, keeping its payment" do
    booking = booking_with(status: "confirmed")
    payment = booking.payment

    change_booking(booking, starts_on: (today + 12).iso8601, ends_on: (today + 13).iso8601)

    expect(booking.reload).to have_attributes(status: "requested", starts_on: today + 12, ends_on: today + 13,
      total_cents: 200_000, payment:, confirmed_at: nil)
    expect(booking.expires_at).to be_within(1.minute).of(24.hours.from_now)
  end

  it "re-dates a request that is still waiting, starting its clock again" do
    booking = booking_with(status: "requested")
    booking.update!(expires_at: 1.hour.from_now)

    change_booking(booking, guests: 3)

    expect(booking.reload).to have_attributes(status: "requested", guests: 3)
    expect(booking.expires_at).to be_within(1.minute).of(24.hours.from_now)
    expect(booking.events.last).to have_attributes(from_status: "requested", to_status: "requested", actor: "guest")
    expect(item.reload.quantity).to eq(3)
  end

  it "is never accepted automatically" do
    allow(Bookings).to receive(:auto_accept?).and_return(true)
    booking = booking_with(status: "confirmed")

    change_booking(booking, guests: 1)

    expect(booking.reload).to be_requested
  end

  it "refuses a cancelled booking and a past start date" do
    expect { change_booking(booking_with(status: "cancelled"), guests: 1) }
      .to raise_error(ActiveRecord::RecordInvalid, /A booking that is cancelled can't be changed/)
    expect { change_booking(booking_with(status: "requested"), starts_on: (today - 1).iso8601) }
      .to raise_error(ActiveRecord::RecordInvalid, /Start date can't be in the past/)
  end

  it "refuses days that are taken, changing nothing" do
    booking = booking_with(status: "confirmed")
    create(:booking, :checkout, listing:, starts_on: today + 12, ends_on: today + 13)

    expect { change_booking(booking, starts_on: (today + 11).iso8601, ends_on: (today + 13).iso8601) }
      .to raise_error(ActiveRecord::RecordInvalid, /fully booked|aren't available/)
    expect(booking.reload).to have_attributes(status: "confirmed", starts_on: today + 10)
    expect(item.reload.starts_on).to eq(today + 10)
  end

  it "changes a stay's split into rooms and its pets, and drops the split when only the guests change (RAA-182)" do
    listing.update!(attrs: { "place_type" => "entire_place", "guests" => 4, "pets_allowed" => true })
    listing.units.create!(position: 2)
    booking = booking_with(status: "requested")

    change_booking(booking, room_guests: [ { adults: 1 }, { adults: 2, infants: 1 } ], pets: 1)
    expect(booking.reload).to have_attributes(guests: 4, quantity: 2, pets: 1,
      room_guests: [ { "adults" => 1, "children" => 0, "infants" => 0 }, { "adults" => 2, "children" => 0, "infants" => 1 } ])
    expect(item.reload).to have_attributes(quantity: 4, pets: 1, room_guests: booking.room_guests)

    change_booking(booking, guests: 3)
    expect(booking.reload).to have_attributes(guests: 3, quantity: 1, room_guests: nil, pets: 1)
  end

  describe "the partner's answer to a change" do
    it "confirms a paid booking again on its payment when accepted" do
      booking = booking_with(status: "confirmed")
      change_booking(booking, guests: 1)

      expect { Bookings::Respond.call(booking, "accepted", user: listing.partner) }.not_to change(Payment, :count)
      expect(booking.reload).to have_attributes(status: "confirmed", payment_id: booking.payment_id)
    end

    it "records the whole payment as refunded when declined" do
      booking = booking_with(status: "confirmed")
      change_booking(booking, starts_on: (today + 12).iso8601, ends_on: (today + 13).iso8601)

      Bookings::Respond.call(booking, "declined", user: listing.partner)

      expect(booking.reload).to have_attributes(status: "declined", refund_cents: 200_000)
    end

    it "refunds nothing for a request that was never paid" do
      booking = booking_with(status: "requested")

      Bookings::Respond.call(booking, "declined", user: listing.partner)

      expect(booking.reload.refund_cents).to be_nil
    end
  end
end
