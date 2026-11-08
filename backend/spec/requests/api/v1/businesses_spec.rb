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

      response "200", "its shop page: what the partner tells guests, its photos, pin and ID check (RAA-281)" do
        schema "$ref" => "#/components/schemas/business_detail"
        let(:id) { business.id }

        before do
          business.update!(opens_at: "07:00", closes_at: "21:00", languages: %w[en ceb], host_name: "Marisol",
            faqs: [ { "question" => "Parking?", "answer" => "Yes." } ])
          create_photo(business)
          create_photo(business, uploaded: false)
          create(:partner_verification, user: business.partner, status: "approved")
        end

        run_test! do |response|
          shop = response.parsed_body["business"]
          expect(shop).to include("verified" => true, "street" => business.street, "languages" => %w[en ceb],
            "hours" => { "opens_at" => "07:00", "closes_at" => "21:00", "closed_days" => [] },
            "host" => { "name" => "Marisol", "intro" => nil }, "stay_rules" => nil, "logo" => nil,
            "faqs" => [ { "question" => "Parking?", "answer" => "Yes." } ])
          expect(shop["location"]).to be_present
          expect(shop["cover_photos"].size).to eq(1)
        end
      end

      response "200", "a business that only offers stays keeps its street and pin until a booking (RAA-281)" do
        schema "$ref" => "#/components/schemas/business_detail"
        let(:id) { business.id }

        before { business.listings.where.not(category: stay.category).destroy_all }

        run_test! do |response|
          expect(response.parsed_body["business"]).to include("street" => nil, "location" => nil, "verified" => false)
        end
      end

      response "200", "a tour names its published stops, in the order it makes them" do
        schema "$ref" => "#/components/schemas/business_detail"
        let(:tour) { create(:listing, area: town, partner: stay.partner, title: "Island hopping") }
        let(:id) { business.id }

        before do
          [ create(:landmark, area: town, slug: "virgin-island", name: "Virgin Island"),
            create(:landmark, area: town, slug: "kota-beach", name: "Kota Beach"),
            create(:landmark, :draft, area: town, slug: "draft-cove", name: "Draft Cove") ].each.with_index(1) do |landmark, position|
            ListingLandmark.create!(listing: tour, landmark:, relation: "visits", position:)
          end
        end

        run_test! do |response|
          listings = response.parsed_body["listings"].index_by { _1["title"] }
          expect(listings["Island hopping"]["goes_to"]).to eq([ { "slug" => "virgin-island", "name" => "Virgin Island" },
            { "slug" => "kota-beach", "name" => "Kota Beach" } ])
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
