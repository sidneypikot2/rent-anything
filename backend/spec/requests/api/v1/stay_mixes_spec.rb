require "swagger_helper"

RSpec.describe "Stay mixes", type: :request do
  include_context "a business with three room types"

  path "/api/v1/stay_mixes" do
    get "Mixes of a business's room types for a party" do
      tags "Discovery"
      produces "application/json"
      description "Public. Up to 3 ways to sleep the party in a mix of one business's room types (RAA-187), each a " \
        "stay listing: `cheapest`; `private`, the cheapest without a shared room; `one_type`, the cheapest of one " \
        "room type. A label whose mix is already shown is skipped and the rest are filled cheapest first as " \
        "`other`. Rooms are filled as a stay's quote fills them (an adult in each, the others spread evenly, " \
        "infants in private rooms) and priced by it; the pets go to a room type that allows them. Rooms fully " \
        "booked on any night are left out. Each item can be added to a trip as it is (`POST /trip_items` with " \
        "`items`). Money is in centavos."
      parameter name: "listing_ids[]", in: :query, required: true, description: "2 to 10 active stays of one business",
        schema: { type: :array, items: { type: :integer } }, style: :form, explode: true
      parameter name: :starts_on, in: :query, type: :string, format: :date, required: true, description: "Check-in"
      parameter name: :ends_on, in: :query, type: :string, format: :date, required: true, description: "Check-out"
      parameter name: :adults, in: :query, type: :integer, required: true
      parameter name: :children, in: :query, type: :integer, required: false, description: "Default 0"
      parameter name: :infants, in: :query, type: :integer, required: false, description: "Default 0"
      parameter name: :pets, in: :query, type: :integer, required: false, description: "Default 0"

      let(:"listing_ids[]") { room_types.map(&:id) }
      let(:starts_on) { 20.days.from_now.to_date.iso8601 }
      let(:ends_on) { (20.days.from_now.to_date + 2).iso8601 }
      let(:adults) { 5 }
      let(:children) { 1 }
      let(:infants) { 1 }
      let(:pets) { 1 }

      response "200", "the mixes, cheapest first" do
        schema type: :object, properties: {
          mixes: { type: :array, items: { "$ref" => "#/components/schemas/stay_mix" } }
        }, required: %w[mixes]

        run_test! do |response|
          mixes = response.parsed_body["mixes"]
          expect(mixes.map { [ _1["label"], _1["total_cents"] ] }).to eq([
            [ "cheapest", 880_000 ], [ "private", 1_180_000 ], [ "one_type", 1_180_000 ]
          ])
          expect(mixes.first["items"].first).to include(
            "listing_id" => family_room.id, "rooms" => 1, "quantity" => 6, "pets" => 1,
            "room_guests" => [ { "adults" => 4, "children" => 1, "infants" => 1 } ]
          )
        end
      end

      response "422", "too few listings, listings of two businesses, bad dates or a bad party" do
        schema "$ref" => "#/components/schemas/validation_errors"

        context "with one listing" do
          let(:"listing_ids[]") { [ family_room.id ] }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Pick 2 to 10 room types" ]) }
        end

        context "with another business's stay" do
          let(:"listing_ids[]") { [ family_room.id, create(:listing, :stay).id ] }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to eq([ "The room types must be active stays of one business" ])
          end
        end

        context "with a listing that isn't a stay" do
          let(:"listing_ids[]") { [ family_room.id, create(:listing, partner: family_room.partner).id ] }

          run_test! do |response|
            expect(response.parsed_body["errors"]).to eq([ "The room types must be active stays of one business" ])
          end
        end

        context "with check-out before check-in" do
          let(:ends_on) { starts_on }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Check-out must be after check-in" ]) }
        end

        context "with no adults" do
          let(:adults) { 0 }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "A stay needs an adult" ]) }
        end

        context "with a count that isn't a number" do
          let(:children) { "one" }

          run_test! { |response| expect(response.parsed_body["errors"]).to eq([ "Children must be a whole number" ]) }
        end
      end
    end
  end
end
