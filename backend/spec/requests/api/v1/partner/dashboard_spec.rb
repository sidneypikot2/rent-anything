require "swagger_helper"

RSpec.describe "Partner dashboard", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  # 04:00 on 1 December in Manila, still 30 November in UTC.
  let(:today) { Date.new(2026, 12, 1) }

  before { travel_to Time.utc(2026, 11, 30, 20, 0) }

  path "/api/v1/partner/dashboard" do
    get "The partner's dashboard" do
      tags "Partner"
      produces "application/json"
      description "Partner-only (RAA-266). What needs the partner now, with \"today\" and \"this month\" in Manila " \
        "time: the tile counts, up to 5 open requests (soonest to expire first), the next 5 confirmed bookings, " \
        "listings needing attention, setup steps and the latest activity. `estimated_earnings_cents` is an " \
        "estimate of what the month's bookings pay out, as `GET partner/earnings` lists; nothing has been paid."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "everything on the partner's dashboard" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        let(:listing) { create(:listing, :stay, partner: user, title: "Garden room") }
        let(:other) { create(:listing, :stay, title: "Someone else's room") }

        before do
          create(:booking, :checkout, listing:, status: "requested", guest_name: "Later", expires_at: 5.hours.from_now)
          create(:booking, :checkout, listing:, status: "requested", guest_name: "Sooner", expires_at: 1.hour.from_now)
          create(:booking, :checkout, listing:, status: "requested", guest_name: "Too late", expires_at: 1.minute.ago)
          create(:booking, :checkout, listing:, guest_name: "Arriving", starts_on: today, ends_on: today + 2, commission_cents: 40_000)
          create(:booking, :checkout, listing:, guest_name: "Yesterday by Manila", starts_on: today - 1, ends_on: today + 1)
          create(:booking, :checkout, listing:, guest_name: "Next week", starts_on: today + 7, ends_on: today + 8)
          create(:booking, listing:, guest_name: "Offline", starts_on: today + 3, ends_on: today + 4)
          create(:booking, :checkout, listing:, guest_name: "Cancelled", status: "cancelled", starts_on: today, ends_on: today + 1)
          create(:booking, :checkout, listing: other, guest_name: "Theirs", starts_on: today, ends_on: today + 1)
          create(:booking, :checkout, listing: other, guest_name: "Theirs asking", status: "requested", expires_at: 1.hour.from_now)
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body["tiles"]).to include("requests_waiting" => 2, "arriving_today" => 1, "listings_live" => 1)
          expect(body["requests"].pluck("guest_name")).to eq([ "Sooner", "Later" ])
          expect(body["requests"].first["expires_at"]).to be_present
          expect(body["upcoming"].pluck("guest_name")).to eq([ "Arriving", "Offline", "Next week" ])
          expect(body["upcoming"].first.keys).not_to include("total_cents", "commission_cents")
        end
      end

      response "200", "at most five requests and five upcoming bookings" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        let(:listing) { create(:listing, :stay, partner: user) }

        before do
          6.times { create(:booking, :checkout, listing:, status: "requested", expires_at: 1.hour.from_now) }
          6.times { |n| create(:booking, :checkout, listing:, starts_on: today + n, ends_on: today + n + 1) }
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body["tiles"]["requests_waiting"]).to eq(6)
          expect(body["requests"].size).to eq(5)
          expect(body["upcoming"].size).to eq(5)
        end
      end

      response "200", "the month's estimate, in Manila's month" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        let(:listing) { create(:listing, :stay, partner: user) }

        before do
          create(:booking, :checkout, listing:, starts_on: today, ends_on: today + 1, commission_cents: 40_000)
          create(:booking, :checkout, listing:, starts_on: today - 1, ends_on: today, commission_cents: 40_000)
        end

        run_test! { |response| expect(response.parsed_body["tiles"]["estimated_earnings_cents"]).to eq(360_000) }
      end

      response "200", "listings needing attention" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        before do
          create(:listing, :stay, partner: user, title: "A draft room", status: "draft")
          create(:listing, :stay, :paused, partner: user, title: "B paused room")
          create(:listing, :stay, partner: user, title: "A delisted room", status: "delisted")
          create(:listing, :stay, title: "Someone else's room", status: "draft")
          ready = create(:listing, :stay, partner: user, title: "A ready room", description: "A" * Listing::LIVE_DESCRIPTION_MIN)
          create_photo(ready)
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body["listings_needing_attention"].pluck("title")).to eq([ "A draft room", "B paused room" ])
          expect(body["listings_needing_attention"].first).to include("status" => "draft")
          expect(body["listings_needing_attention"].first["live_blockers"]).to include("photo")
          expect(body["tiles"]["listings_live"]).to eq(1)
        end
      end

      response "200", "setup steps not done" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        run_test! do |response|
          expect(response.parsed_body["setup"]).to eq("id_check_status" => "not_started", "id_check" => false,
            "profile" => false, "business" => false, "payout_account" => false)
        end
      end

      response "200", "setup steps done, from the stored ID check" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        before do
          user.update!(phone: "+639171234567")
          create(:partner_profile, user:)
          create(:partner_verification, :approved, user:)
          create(:business, partner: user)
          create(:payout_account, partner: user)
          expect(Verifications::Current).not_to receive(:call)
        end

        run_test! do |response|
          expect(response.parsed_body["setup"]).to eq("id_check_status" => "approved", "id_check" => true,
            "profile" => true, "business" => true, "payout_account" => true)
        end
      end

      response "200", "recent activity, the team's answers marked by their actor" do
        schema "$ref" => "#/components/schemas/partner_dashboard"

        let(:listing) { create(:listing, :stay, partner: user, title: "Garden room") }

        before do
          booking = create(:booking, :checkout, listing:, status: "requested", guest_name: "Ana", expires_at: 1.hour.from_now)
          Bookings::Respond.call(booking, "declined", actor: "admin", reason: "Team note")
          theirs = create(:booking, :checkout, status: "requested", expires_at: 1.hour.from_now)
          Bookings::Respond.call(theirs, "declined", actor: "admin")
        end

        run_test! do |response|
          activity = response.parsed_body["activity"]
          expect(activity.size).to eq(1)
          expect(activity.first).to include("actor" => "admin", "from_status" => "requested", "to_status" => "declined",
            "guest_name" => "Ana", "listing_title" => "Garden room")
          expect(activity.first.keys).not_to include("reason", "metadata")
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
