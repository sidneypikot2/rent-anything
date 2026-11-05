require "swagger_helper"

RSpec.describe "Businesses", type: :request do
  let(:island) { create(:area, name: "Bantayan Island", kind: "island") }
  let(:town) { create(:area, name: "Santa Fe", parent: island) }
  let(:stay) { create(:listing, :stay, area: town, title: "Sea view room") }
  let(:business) { stay.business }

  before do
    business.update!(description: "A family guest house by the beach.")
    create(:listing, :stay, area: town, partner: stay.partner, title: "Garden room")
    create(:listing, :vehicle, area: island, partner: stay.partner, title: "Honda Click 125i")
    create(:listing, :stay, :paused, area: town, partner: stay.partner, title: "Closed room")
  end

  path "/api/v1/businesses/{id}" do
    get "A business's page: about it and everything it offers" do
      tags "Discovery"
      produces "application/json"
      description "Public. One business as a guest sees it: its name, description and town, and its active " \
        "listings in published places as an area page lists them, by title. `area` is the place most of them " \
        "are in. A business with nothing to book is not found."
      parameter name: :id, in: :path, schema: { type: :integer }

      response "200", "the business with its listings" do
        schema "$ref" => "#/components/schemas/business_detail"
        let(:id) { business.id }

        run_test! do |response|
          body = response.parsed_body
          expect(body["business"]).to include("id" => business.id, "name" => business.name,
            "description" => "A family guest house by the beach.", "city" => "Moalboal")
          expect(body["listings"].pluck("title")).to eq([ "Garden room", "Honda Click 125i", "Sea view room" ])
          expect(body["area"]).to include("slug" => town.slug, "parent_slug" => island.slug)
          expect(body["listings"].first).to include("booking_type" => "stay", "business" => { "id" => business.id, "name" => business.name })
        end
      end

      response "200", "a tour names its published stops, by name" do
        schema "$ref" => "#/components/schemas/business_detail"
        let(:tour) { create(:listing, area: town, partner: stay.partner, title: "Island hopping") }
        let(:id) { business.id }

        before do
          [ create(:landmark, area: town, slug: "virgin-island", name: "Virgin Island"),
            create(:landmark, area: town, slug: "kota-beach", name: "Kota Beach"),
            create(:landmark, :draft, area: town, slug: "draft-cove", name: "Draft Cove") ].each do |landmark|
            ListingLandmark.create!(listing: tour, landmark:, relation: "visits")
          end
        end

        run_test! do |response|
          listings = response.parsed_body["listings"].index_by { _1["title"] }
          expect(listings["Island hopping"]["goes_to"]).to eq([ { "slug" => "kota-beach", "name" => "Kota Beach" },
            { "slug" => "virgin-island", "name" => "Virgin Island" } ])
          expect(listings["Sea view room"]["goes_to"]).to eq([])
        end
      end

      response "404", "a business with nothing to book" do
        let(:id) { create(:business).id }

        run_test!
      end

      response "404", "no such business" do
        let(:id) { 0 }

        run_test!
      end
    end
  end
end
