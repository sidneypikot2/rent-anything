require "swagger_helper"

RSpec.describe "Partner calendar days", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }
  let(:today) { Date.current }
  let(:listing) { create(:listing, :stay, partner: user) }
  let(:listing_id) { listing.id }
  let(:body) { { starts_on: (today + 1).iso8601, ends_on: (today + 3).iso8601, price_cents: 250_000 } }

  before do
    listing.units.create!(position: 2)
    listing.units.create!(position: 3)
  end

  def change(values)
    patch "/api/v1/partner/listings/#{listing_id}/calendar_days", as: :json,
      params: { starts_on: (today + 1).iso8601, ends_on: (today + 3).iso8601, **values },
      headers: { "Authorization" => Authorization() }
  end

  path "/api/v1/partner/listings/{listing_id}/calendar_days" do
    patch "Change a run of a listing's days" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only (RAA-118). Sets the price, units on sale or a stay's minimum nights on each day from " \
        "`starts_on` to `ends_on`; null puts back the listing's own. Answers with the listing's calendar for those " \
        "days. Another partner's listing is a 404."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :listing_id, in: :path, schema: { type: :integer }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/calendar_days_body" }

      response "200", "a price, units and minimum nights set, then put back" do
        schema "$ref" => "#/components/schemas/calendar_listing"

        run_test! do |first|
          expect(first.parsed_body["days"].pluck("price_cents")).to eq([ 250_000 ] * 3)
          expect(listing.days.count).to eq(3)

          change(units_available: 1, min_nights: 2)
          expect(response.parsed_body["days"].first).to include("price_cents" => 250_000, "units_available" => 1,
            "units_set" => true, "min_nights" => 2)

          change(price_cents: nil, units_available: nil)
          expect(response.parsed_body["days"].first).to include("price_cents" => 200_000, "price_set" => false,
            "units_available" => 3, "min_nights" => 2)
          change(min_nights: nil)
          expect(response).to have_http_status(:ok)
          expect(listing.days.count).to eq(0)
        end
      end

      response "422", "fewer units on sale than are booked" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { starts_on: (today + 1).iso8601, ends_on: (today + 3).iso8601, units_available: 1 } }

        before { create(:booking, listing:, starts_on: today + 2, ends_on: today + 4, quantity: 2) }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq(
            [ "2 units are already booked on #{(today + 2).strftime('%b %-d')}: keep at least 2 on sale" ]
          )
          expect(listing.days.count).to eq(0)
        end
      end

      response "422", "values out of range, past days, nothing to change" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { starts_on: (today - 1).iso8601, ends_on: today.iso8601, price_cents: 0, units_available: 4 } }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to eq([
            "Past days can't be changed",
            "Price must be a whole number of centavos from 1 to 1000000000",
            "Units on sale must be a whole number from 0 to 3"
          ])
          change({})
          expect(response.parsed_body["errors"]).to eq([ "Send a price, units on sale or a minimum stay to change" ])
          change(price_cents: "2500")
          expect(response.parsed_body["errors"]).to eq([ "Price must be a whole number of centavos from 1 to 1000000000" ])
          patch "/api/v1/partner/listings/#{listing_id}/calendar_days", as: :json,
            params: { starts_on: (today + 1).iso8601, ends_on: (today + 367).iso8601, price_cents: 1 },
            headers: { "Authorization" => Authorization() }
          expect(response.parsed_body["errors"]).to eq([ "Change at most 366 days at a time" ])
        end
      end

      response "422", "a minimum stay on something that isn't a stay" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:listing) { create(:listing, partner: user) }
        let(:body) { { starts_on: (today + 1).iso8601, ends_on: (today + 1).iso8601, min_nights: 2 } }

        run_test! { |first| expect(first.parsed_body["errors"]).to eq([ "Only stays have a minimum stay" ]) }
      end

      response "404", "another partner's listing" do
        schema "$ref" => "#/components/schemas/error"

        let(:listing) { create(:listing, :stay) }

        run_test! { expect(listing.days.count).to eq(0) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"

        let(:user) { create(:user) }
        let(:listing) { create(:listing, :stay) }

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
