require "rails_helper"
require Rails.root.join("db/migrate/20261105020000_move_gear_to_vehicle_rates").to_s

# The move of gear to vehicle rates (RAA-254), on rows as they were before it.
RSpec.describe MoveGearToVehicleRates do
  let(:day) { 20.days.from_now.to_date }
  let(:camera) { create(:listing, :gear, with_rate: false) }
  let(:unpriced) { create(:listing, :gear, with_rate: false) }
  let(:van) { create(:listing, :transfer) }
  let(:connection) { ActiveRecord::Base.connection }

  def flat_rate(listing, price_cents)
    FlatRate.insert({ listing_id: listing.id, price_cents: })
  end

  before do
    flat_rate(camera, 30_000)
    unpriced
  end

  it "moves each gear listing's price to a daily price, and leaves a transfer's alone" do
    van
    described_class.backfill(connection)

    expect(VehicleRate.find_by(listing: camera)).to have_attributes(daily_price_cents: 30_000, security_deposit_cents: 0, delivery_fee_cents: nil)
    expect(VehicleRate.find_by(listing: unpriced)).to have_attributes(daily_price_cents: 0)
    expect(FlatRate.where(listing: [ camera, unpriced ])).to be_empty
    expect(FlatRate.find_by(listing: van)).to have_attributes(price_cents: 150_000)
  end

  it "gives a gear booking the period a vehicle booking keeps, so it still holds its days" do
    booking = create(:booking, listing: camera, quantity: 3, starts_on: day, ends_on: day + 2)
    booking.update_columns(starts_at: nil, ends_at: nil)
    described_class.backfill(connection)

    expect(booking.reload).to have_attributes(pickup_time: "09:00", starts_at: Booking.rental_period(day, day + 2, "09:00").begin,
      ends_at: Booking.rental_period(day, day + 2, "09:00").end)
    listing = Listing.find(camera.id)
    days = Booking.days_for(listing, day, day + 1)
    expect(Availability::Ledger.new([ listing ], day, day + 1).refusal(listing, days, 1, period: Booking.rental_period(day, day + 1, "09:00")))
      .to be_present
  end

  it "keeps a price already moved, run again" do
    2.times { described_class.backfill(connection) }

    expect(VehicleRate.where(listing: camera).pluck(:daily_price_cents)).to eq([ 30_000 ])
  end
end
