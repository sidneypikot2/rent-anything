require "swagger_helper"

RSpec.describe "Admin overview", type: :request do
  let(:user) { create(:user, :admin) }
  let(:Authorization) { bearer_for(user) }
  let(:zone) { ActiveSupport::TimeZone["Asia/Manila"] }
  let(:today) { zone.today }

  # A Manila day at a Manila hour.
  def at(day, hour, min = 0)
    day.in_time_zone(zone).change(hour:, min:)
  end

  def booking(status:, created_at:, confirmed_at: nil, source: "checkout", total_cents: 400_000, commission_cents: 40_000, starts_in: 30)
    attrs = { status:, created_at:, confirmed_at:, total_cents:, commission_cents:,
      starts_on: today + starts_in, ends_on: today + starts_in + 1 }
    source == "checkout" ? create(:booking, :checkout, **attrs) : create(:booking, source:, **attrs)
  end

  path "/api/v1/admin/overview" do
    parameter name: :Authorization, in: :header, schema: { type: :string }

    get "How the app is doing, day by day" do
      tags "Admin"
      produces "application/json"
      description "Admin-only (RAA-290). Per Manila day over the last `days` (7, 30 or 90, default 30; today " \
        "included, every day present): visitors (browsers counted by POST /visits), online bookings made, and the " \
        "total and our commission of online bookings paid that day that still stand (confirmed, in progress or " \
        "completed). Offline bookings, a partner's own records, are left out."
      security [ { bearer: [] } ]
      parameter name: :days, in: :query, required: false, schema: { type: :string, enum: %w[7 30 90] }

      let(:days) { nil }

      response "200", "the last 30 days" do
        schema "$ref" => "#/components/schemas/admin_overview"

        before do
          2.times { Visits::Record.call(SecureRandom.uuid) }
          SiteVisit.create!(visited_on: today - 1, visitor_digest: "yesterday", created_at: Time.current)
          SiteVisit.create!(visited_on: today - 40, visitor_digest: "too-old", created_at: Time.current)

          booking(status: "requested", created_at: at(today, 9), starts_in: 30)
          booking(status: "declined", created_at: at(today, 10), starts_in: 34)
          # Made two days ago and paid yesterday, at 7:30 in Manila: still the 23rd-hour UTC of the day before.
          booking(status: "confirmed", created_at: at(today - 2, 12), confirmed_at: at(today - 1, 7, 30), starts_in: 38,
            total_cents: 500_000, commission_cents: 50_000)
          booking(status: "completed", created_at: at(today - 3, 12), confirmed_at: at(today - 1, 20), starts_in: 42,
            total_cents: 100_000, commission_cents: 10_000)
          # Paid, then cancelled: no longer counted as paid.
          booking(status: "cancelled", created_at: at(today - 2, 13), confirmed_at: at(today - 1, 9), starts_in: 46)
          # A partner's own record.
          booking(status: "confirmed", source: "offline", created_at: at(today - 1, 9), confirmed_at: at(today - 1, 9),
            starts_in: 50)
          # Before the window.
          booking(status: "confirmed", created_at: at(today - 40, 9), confirmed_at: at(today - 40, 10), starts_in: 54)
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body).to include("days" => 30, "from" => (today - 29).iso8601, "to" => today.iso8601)
          expect(body["series"].size).to eq(30)
          expect(body["series"].first["date"]).to eq((today - 29).iso8601)

          by_day = body["series"].index_by { _1["date"] }
          expect(by_day[today.iso8601]).to include("visitors" => 2, "bookings" => 2, "booking_amount_cents" => 0)
          expect(by_day[(today - 1).iso8601]).to include("visitors" => 1, "bookings" => 0,
            "booking_amount_cents" => 600_000, "revenue_cents" => 60_000)
          expect(by_day[(today - 2).iso8601]).to include("bookings" => 2, "booking_amount_cents" => 0)
          expect(by_day[(today - 10).iso8601]).to include("visitors" => 0, "bookings" => 0, "revenue_cents" => 0)
          expect(body["totals"]).to eq("visitors" => 3, "bookings" => 5, "booking_amount_cents" => 600_000,
            "revenue_cents" => 60_000)
        end
      end

      response "200", "the last 7 days" do
        schema "$ref" => "#/components/schemas/admin_overview"
        let(:days) { "7" }

        run_test! do |response|
          expect(response.parsed_body["series"].size).to eq(7)
          expect(response.parsed_body["from"]).to eq((today - 6).iso8601)
        end
      end

      response "422", "days other than 7, 30 or 90" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:days) { "14" }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Days must be one of 7, 30, 90" ])
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user, :partner) }

        run_test!
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end
    end
  end
end
