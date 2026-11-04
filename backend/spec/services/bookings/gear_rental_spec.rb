require "rails_helper"

# Gear on the rental rules a vehicle has (RAA-254), still booked by the count.
RSpec.describe "Gear rentals" do
  let(:day) { 20.days.from_now.to_date }
  let(:camera) { create(:listing, :gear) }
  let(:rate) { camera.vehicle_rate }

  def zone_up
    rate.assign_delivery(delivers: true, picks_up: true, zones: [ { max_distance_m: 5000, fee_cents: 20_000 } ])
    rate.update!(security_deposit_cents: 200_000)
  end

  describe Bookings::Price do
    it "charges each item and day, keeps the deposit apart, and one handover fee for the whole drop-off" do
      zone_up
      price = described_class.call(camera, starts_on: day, ends_on: day + 2, quantity: 3, guests: 3,
        delivery: true, return_pickup: true, delivery_distance_m: 1000)

      expect(price[:total_cents]).to eq((30_000 * 3 * 2) + 20_000 + 20_000)
      expect(price[:breakdown]).to include(kind: "gear", days: 2, quantity: 3, deposit_cents: 600_000,
        delivery_cents: 20_000, return_pickup_cents: 20_000)
    end

    it "still charges a vehicle's handover for each vehicle" do
      bike = create(:listing, :vehicle)
      bike.vehicle_rate.tap { _1.assign_delivery(delivers: true, picks_up: false, zones: [ { max_distance_m: 5000, fee_cents: 20_000 } ]) }.save!

      price = described_class.call(bike, starts_on: day, ends_on: day + 1, quantity: 2, guests: 2, delivery: true, delivery_distance_m: 1000)
      expect(price[:breakdown]).to include(kind: "vehicle", delivery_cents: 40_000)
    end
  end

  describe Bookings::PriceFor do
    def price(**params)
      described_class.call(camera.id, { starts_on: day.iso8601, ends_on: (day + 2).iso8601, quantity: "2", **params }.with_indifferent_access)
    end

    it "answers pickup times and the return, with one delivery line" do
      zone_up
      answer = price(pickup_time: "10:00", delivery: "true", delivery_lat: camera.location.y.to_s, delivery_lng: camera.location.x.to_s)

      expect(answer).to include(total_cents: 140_000, deposit_cents: 400_000, unavailable: nil)
      expect(answer[:pickup_times].first).to eq(time: "07:00", available: true)
      expect(answer[:returns_at].in_time_zone("Asia/Manila").strftime("%F %H:%M")).to eq("#{(day + 2).iso8601} 10:00")
      expect(answer[:lines]).to eq([ { label: "2 items × ₱300 × 2 days", amount_cents: 120_000 },
                                     { label: "Delivery", amount_cents: 20_000 } ])
    end

    it "calls the items what the category calls them" do
      camera.category.update!(unit_name: "camera", unit_name_plural: "cameras")

      expect(price[:lines].first[:label]).to eq("2 cameras × ₱300 × 2 days")
    end
  end

  describe Availability::Ledger do
    it "keeps a returned item out for its turnaround" do
      camera.units.where.not(position: 1).destroy_all
      camera.units.reset
      rate.update!(turnaround_minutes: 120)
      create(:booking, listing: camera, quantity: 1, starts_on: day, ends_on: day + 1)
      ledger = described_class.new([ camera.reload ], day + 1, day + 2)
      days = Booking.days_for(camera, day + 1, day + 2)

      expect(ledger.refusal(camera, days, 1, period: Booking.rental_period(day + 1, day + 2, "10:00"))).to be_present
      expect(ledger.refusal(camera, days, 1, period: Booking.rental_period(day + 1, day + 2, "11:00"))).to be_nil
    end
  end

  describe Trips::AddItem do
    let(:user) { create(:user) }
    let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 2) }

    def add(**params)
      described_class.call(user, { listing_id: camera.id, starts_on: day.iso8601, ends_on: (day + 1).iso8601, trip_id: trip.id, **params }.with_indifferent_access)
    end

    it "keeps a pickup time, and a different one makes a second line" do
      add(pickup_time: "09:00")
      add(pickup_time: "09:00")
      add(pickup_time: "14:00")

      expect(trip.items.reload.order(:id).map { [ _1.pickup_time, _1.quantity ] }).to eq([ [ "09:00", 2 ], [ "14:00", 1 ] ])
    end

    it "counts no pickup time as the shop's default" do
      add
      add(pickup_time: "09:00")

      expect(trip.items.reload.map(&:quantity)).to eq([ 2 ])
    end

    it "doesn't merge a delivered item with one collected at the shop" do
      zone_up
      add
      add(delivery: true, delivery_address: "Santa Fe port", delivery_location: { lat: camera.location.y, lng: camera.location.x })

      expect(trip.items.reload.size).to eq(2)
    end
  end

  describe Trips::AddItems do
    let(:user) { create(:user) }
    let(:snorkel) { create(:listing, :gear, partner: camera.partner, title: "Snorkel set") }
    let(:dates) { { starts_on: day.iso8601, ends_on: (day + 1).iso8601 } }

    def add(items, **params)
      described_class.call(user, { items:, **params }.with_indifferent_access)
    end

    it "takes a new trip's guests apart from the counts" do
      trip = add([ { listing_id: camera.id, quantity: 2, **dates }, { listing_id: snorkel.id, quantity: 3, **dates } ], guests: 2)

      expect(trip.guests).to eq(2)
    end

    it "counts into gear the trip already holds" do
      trip = add([ { listing_id: camera.id, quantity: 2, **dates } ], guests: 2)
      add([ { listing_id: camera.id, quantity: 1, **dates } ], trip_id: trip.id)

      expect(trip.items.reload.map(&:quantity)).to eq([ 3 ])
    end

    it "refuses more than is listed, adding nothing" do
      trip = add([ { listing_id: camera.id, quantity: 2, **dates } ], guests: 2)

      expect { add([ { listing_id: snorkel.id, quantity: 1, **dates }, { listing_id: camera.id, quantity: 2, **dates } ], trip_id: trip.id) }
        .to raise_error(ActiveRecord::RecordInvalid, /Only 3 of DJI Osmo Action 4 are listed/)
      expect(trip.items.reload.map(&:quantity)).to eq([ 2 ])
    end
  end
end
