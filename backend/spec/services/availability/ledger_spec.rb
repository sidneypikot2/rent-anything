require "rails_helper"

RSpec.describe Availability::Ledger do
  describe "vehicle rentals by the 24 hours from their pickup (RAA-195)" do
    let(:monday) { 10.days.from_now.to_date }
    let(:tuesday) { monday + 1 }
    let(:bike) { create(:listing, :vehicle) }

    def rent(pickup, on: monday, days: 1, quantity: 1)
      period = Booking.rental_period(on, on + days, pickup)
      create(:booking, listing: bike, starts_on: on, ends_on: on + days, quantity:, starts_at: period.begin, ends_at: period.end)
    end

    def refusal(pickup, on: tuesday, days: 1, quantity: 1, listing: bike.reload)
      ledger = described_class.new([ listing ], on, on + days)
      ledger.refusal(listing, Booking.days_for(listing, on, on + days), quantity, period: Booking.rental_period(on, on + days, pickup))
    end

    it "counts a rental on the day it starts only, so the bike shows free on its return day" do
      rent("08:00")
      ledger = described_class.new([ bike.reload ], monday, tuesday)

      expect(ledger.day(bike, monday)).to include(booked: 1, units_left: 0)
      expect(ledger.day(bike, tuesday)).to include(booked: 0, units_left: 1)
    end

    it "takes a rental back to back with one returned at its pickup time" do
      rent("08:00")

      expect(refusal("08:00")).to be_nil
      expect(refusal("14:00")).to be_nil
    end

    it "refuses a pickup before the bike is back, saying when it is" do
      rent("08:00")

      expect(refusal("07:00")).to eq("Available from 8:00 AM on #{tuesday.strftime('%b %-d')}")
    end

    it "keeps the turnaround free after each return" do
      rent("08:00")
      bike.vehicle_rate.update!(turnaround_minutes: 60)

      expect(refusal("08:30")).to start_with("Available from 9:00 AM")
      expect(refusal("09:00")).to be_nil
    end

    it "refuses a rental that runs into a later pickup, saying from when" do
      rent("14:00", on: tuesday + 1)

      expect(refusal("16:00")).to eq("Booked from 2:00 PM on #{(tuesday + 1).strftime('%b %-d')}")
      expect(refusal("14:00")).to be_nil
    end

    it "lets several identical bikes overlap up to how many there are" do
      bike.units.create!(position: 2)
      rent("08:00")
      rent("10:00", on: tuesday + 1)

      expect(refusal("07:00")).to be_nil
      expect(refusal("07:00", quantity: 2)).to start_with("Available from 8:00 AM")
      expect(refusal("08:00", quantity: 2)).to be_nil
    end

    it "names the day fully booked when no bike is back that day" do
      rent("08:00", days: 3)

      expect(refusal("20:00")).to eq("#{tuesday.strftime('%b %-d')} is fully booked")
    end

    it "frees a cancelled rental's period" do
      rent("08:00").update_column(:status, "cancelled")

      expect(refusal("07:00", on: monday)).to be_nil
    end
  end
end
