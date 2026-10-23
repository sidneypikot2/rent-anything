require "rails_helper"

RSpec.describe VehicleRate do
  let(:listing) { create(:listing, :vehicle, with_rate: false) }

  def rate(**attributes)
    described_class.new(listing:, daily_price_cents: 50_000, **attributes)
  end

  def messages(record)
    record.tap(&:validate).errors.full_messages
  end

  it "prices vehicles only" do
    expect(messages(described_class.new(listing: create(:listing), daily_price_cents: 1)))
      .to include("Only a vehicle rental has a vehicle rate")
  end

  it "keeps the weekly and monthly totals at most 7 and 30 days at the daily rate" do
    expect(rate(weekly_price_cents: 300_000, monthly_price_cents: 1_000_000)).to be_valid
    expect(messages(rate(weekly_price_cents: 350_001)))
      .to include("Weekly price can't be more than 7 days at the daily price")
    expect(messages(rate(monthly_price_cents: 1_500_001)))
      .to include("Monthly price can't be more than 30 days at the daily price")
  end

  it "keeps a half day cheaper than a day, and an hour cheaper than a half day" do
    expect(rate(half_day_price_cents: 30_000, hourly_price_cents: 10_000)).to be_valid
    expect(messages(rate(half_day_price_cents: 50_000))).to include("Half-day price must be less than the daily price")
    expect(messages(rate(half_day_price_cents: 30_000, hourly_price_cents: 30_000)))
      .to include("Hourly price must be less than the half-day price")
  end

  it "charges for a driver only with one, and keeps a motorcycle self-drive (RAA-150)" do
    car = create(:listing, :vehicle, category: create(:category, :car), with_rate: false)
    expect(described_class.new(listing: car, daily_price_cents: 250_000, driving: "either", driver_fee_cents: 150_000))
      .to be_valid
    expect(messages(described_class.new(listing: car, daily_price_cents: 250_000, driving: "with_driver")))
      .to include("Driver fee is required with a driver")
    expect(messages(rate(driver_fee_cents: 150_000)))
      .to include("Driver fee needs a driver: choose with driver, or leave it out")
    expect(messages(rate(driving: "with_driver", driver_fee_cents: 150_000)))
      .to include("Driving can only be self-drive for a motorcycle")
    expect(messages(rate(driving: "chauffeur"))).to include("Driving is not included in the list")
  end

  it "asks for the fee above the km limit only with a limit" do
    expect(rate(km_limit_per_day: 150, excess_km_fee_cents: 500)).to be_valid
    expect(messages(rate(excess_km_fee_cents: 500))).to include("Fee per km above the limit needs a daily km limit")
  end

  it "has no price yet at zero, and the database refuses a negative price or deposit" do
    expect(rate(daily_price_cents: 0)).not_to be_priced
    saved = rate.tap(&:save!)
    expect { saved.update_column(:daily_price_cents, -1) }.to raise_error(ActiveRecord::StatementInvalid)
    expect { saved.update_column(:security_deposit_cents, -1) }.to raise_error(ActiveRecord::StatementInvalid)
  end

  it "offers delivery and pick-up when they have a fee, 0 being free" do
    expect(rate).to have_attributes(delivers?: false, picks_up?: false)
    expect(rate(delivery_fee_cents: 0, return_pickup_fee_cents: 10_000)).to have_attributes(delivers?: true, picks_up?: true)
  end

  it "is back-filled at zero for vehicle listings without one, and for nothing else" do
    require Rails.root.join("db/migrate/20261023090000_create_vehicle_rates").to_s
    listing
    priced = create(:listing, :vehicle)
    create(:listing)

    expect { 2.times { CreateVehicleRates.backfill(ActiveRecord::Base.connection) } }.to change(described_class, :count).by(1)
    expect(listing.reload.vehicle_rate).to have_attributes(daily_price_cents: 0, half_day_hours: 4, min_rental_days: 1)
    expect(priced.vehicle_rate.reload.daily_price_cents).to eq(50_000)
  end

  it "goes with its listing" do
    rate.save!
    expect { listing.destroy! }.to change(described_class, :count).by(-1)
  end
end
