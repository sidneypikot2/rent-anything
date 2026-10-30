require "rails_helper"

RSpec.describe VehicleRate do
  include ActiveSupport::Testing::TimeHelpers

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

  it "charges for a driver only when the guest can choose one, and keeps a motorcycle self-drive (RAA-150)" do
    car = create(:listing, :vehicle, category: create(:category, :car), with_rate: false)
    car_rate = ->(**attributes) { described_class.new(listing: car, daily_price_cents: 250_000, **attributes) }
    expect(car_rate.(driving: "either", driver_fee_cents: 150_000)).to be_valid
    expect(car_rate.(driving: "with_driver")).to be_valid
    expect(messages(car_rate.(driving: "either")))
      .to include("Driver fee is required when the guest can choose a driver")
    expect(messages(car_rate.(driving: "with_driver", driver_fee_cents: 150_000)))
      .to include("Driver fee is only for self-drive or with driver: leave it out")
    expect(messages(rate(driver_fee_cents: 150_000)))
      .to include("Driver fee is only for self-drive or with driver: leave it out")
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

  # Delivery zones (RAA-205): free within 1 km, ₱150 up to 3 km, nothing beyond.
  describe "delivery zones" do
    let(:zoned) do
      rate.tap do |record|
        record.assign_delivery(delivers: true, picks_up: false, zones: [ { max_distance_m: 3000, fee_cents: 15_000 },
                                                                         { max_distance_m: 1000, fee_cents: 0 } ])
        record.save!
      end
    end

    it "charges the fee of the zone a distance falls in, up to and including its edge" do
      expect([ 0, 1000, 1001, 3000 ].map { zoned.handover_fee_for(_1) }).to eq([ 0, 0, 15_000, 15_000 ])
      expect(zoned.handover_fee_for(3001)).to be_nil
      expect(zoned.max_delivery_m).to eq(3000)
    end

    it "keeps the nearest zone's fee as the delivery fee, and charges it without a distance" do
      expect(zoned.reload).to have_attributes(delivery_fee_cents: 0, return_pickup_fee_cents: nil)
      expect(zoned.handover_fee_for(nil)).to eq(0)
    end

    it "replaces the zones when assigned again" do
      zoned.assign_delivery(delivers: true, picks_up: true, zones: [ { max_distance_m: 2000, fee_cents: 5_000 } ])
      zoned.save!
      expect(zoned.reload.delivery_zones.map { [ _1.max_distance_m, _1.fee_cents ] }).to eq([ [ 2000, 5_000 ] ])
      expect(zoned).to have_attributes(delivery_fee_cents: 5_000, return_pickup_fee_cents: 5_000)
    end

    it "refuses two zones at the same distance and more than five" do
      same = rate.tap { _1.assign_delivery(delivers: true, picks_up: false, zones: [ { max_distance_m: 1000, fee_cents: 0 } ] * 2) }
      expect(messages(same)).to include("Delivery zones can't end at the same distance")
      many = (1..6).map { { max_distance_m: _1 * 1000, fee_cents: 0 } }
      expect(messages(rate.tap { _1.assign_delivery(delivers: true, picks_up: false, zones: many) }))
        .to include("Delivery zones can be at most 5")
    end
  end

  it "offers child helmets on a motorcycle only, 0 being included (RAA-205)" do
    expect(rate(child_helmet_fee_cents: 0)).to be_child_helmets
    expect(rate(child_helmet_fee_cents: nil)).not_to be_child_helmets
    expect(messages(rate(child_helmet_fee_cents: -1))).to include("Child helmet fee cents must be greater than or equal to 0")
    car = create(:listing, :vehicle, category: create(:category, :car), with_rate: false)
    expect(messages(described_class.new(listing: car, daily_price_cents: 250_000, child_helmet_fee_cents: 5_000)))
      .to include("Child helmets are only for a motorcycle")
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

  describe "pickup times on a day (RAA-195)" do
    # 10:10 AM in Manila.
    before { travel_to Time.utc(2026, 11, 2, 2, 10) }

    let(:today) { Date.new(2026, 11, 2) }

    it "keeps only the times still ahead today, all of them later, none on a day gone by" do
      expect(rate.pickup_times_on(today).first(2)).to eq(%w[10:30 11:00])
      expect(rate.pickup_times_on(today).last).to eq("19:00")
      expect(rate.pickup_times_on(today + 1).first).to eq("07:00")
      expect(rate.pickup_times_on(today - 1)).to eq([])
    end

    it "defaults to 9:00, or today to the next half hour once 9:00 has gone" do
      expect(rate.default_pickup_time(on: today + 1)).to eq("09:00")
      expect(rate.default_pickup_time(on: today)).to eq("10:30")
    end
  end
end
