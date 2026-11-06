require "swagger_helper"

RSpec.describe "Partner earnings", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let(:month) { "2026-11" }
  let(:listing) { create(:listing, :stay, partner: user) }

  path "/api/v1/partner/earnings" do
    get "An estimate of the partner's earnings in a month" do
      tags "Partner"
      produces "application/json"
      description "Partner-only (RAA-266). The bookings starting in `month` (YYYY-MM) with what each pays out: an " \
        "estimate, as nothing has been paid yet. Cancelled, declined and expired bookings are left out, and so are " \
        "those priced with the guest (`to_be_agreed`), which have no amount to count. Bookings taken offline are " \
        "listed apart, the guest having paid the partner directly."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :month, in: :query, schema: { type: :string, pattern: '^\d{4}-(0[1-9]|1[0-2])$' }, required: true

      response "200", "the month's bookings and estimate" do
        schema "$ref" => "#/components/schemas/partner_earnings"

        before do
          on = ->(day) { { starts_on: Date.new(2026, 11, day), ends_on: Date.new(2026, 11, day + 1) } }
          create(:booking, :checkout, listing:, guest_name: "Late", commission_cents: 40_000, **on[20])
          create(:booking, :checkout, listing:, guest_name: "Early", commission_cents: 40_000, **on[2])
          create(:booking, :checkout, listing:, guest_name: "Asking", status: "requested", total_cents: 100_000, **on[3])
          create(:booking, listing:, guest_name: "Walk-in", total_cents: 150_000, **on[4])
          %w[cancelled declined expired].each { create(:booking, :checkout, listing:, status: _1, guest_name: _1, **on[5]) }
          create(:booking, :checkout, listing:, guest_name: "Agreed", total_cents: 0,
            price_breakdown: { to_be_agreed: true }, **on[6])
          create(:booking, :checkout, listing:, guest_name: "October", starts_on: Date.new(2026, 10, 31), ends_on: Date.new(2026, 11, 2))
          create(:booking, :checkout, listing:, guest_name: "December", starts_on: Date.new(2026, 12, 1), ends_on: Date.new(2026, 12, 2))
          create(:booking, :checkout, guest_name: "Someone else's", **on[7])
        end

        run_test! do |response|
          body = response.parsed_body
          expect(body).to include("month" => "2026-11", "estimate_cents" => 820_000, "offline_cents" => 150_000)
          expect(body["bookings"].pluck("guest_name")).to eq(%w[Early Asking Late])
          expect(body["bookings"].first).to include("payout_cents" => 360_000)
          expect(body["bookings"].first.keys).not_to include("total_cents", "commission_cents")
          expect(body["offline_bookings"].pluck("guest_name")).to eq(%w[Walk-in])
        end
      end

      response "422", "a month missing or badly written" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:month) { "2026-13" }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([ "Month must be a month like 2026-11" ])
          [ [ {}, "Month is required" ], [ { month: "soon" }, "Month must be a month like 2026-11" ],
            [ { month: { year: "2026" } }, "Month must be a month like 2026-11" ] ].each do |query, message|
            get "/api/v1/partner/earnings", params: query, headers: { "Authorization" => Authorization() }
            expect(response.parsed_body["errors"]).to eq([ message ])
          end
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { nil }

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
