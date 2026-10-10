require "swagger_helper"

RSpec.describe "Activities", type: :request do
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island") }
  let!(:cebu_city) { create(:area, slug: "cebu-city", name: "Cebu City") }
  let!(:empty_area) { create(:area, slug: "oslob", name: "Oslob") }

  let!(:swimming) { create(:tag, slug: "swimming", name: "Swimming") }
  let!(:sightseeing) { create(:tag, slug: "sightseeing", name: "Sightseeing") }
  let!(:whale_watching) { create(:tag, slug: "whale-watching", name: "Whale watching") }
  let!(:history) { create(:tag, slug: "history", name: "History", kind: "theme") }

  before do
    create(:landmark, area: bantayan, name: "Kota Beach", tags: [ swimming ])
    create(:landmark, area: bantayan, name: "Paradise Beach", tags: [ swimming ])
    create(:landmark, area: cebu_city, name: "Fort San Pedro", tags: [ sightseeing, history ])
    create(:landmark, area: cebu_city, name: "Tops", tags: [ swimming ])
    create(:landmark, :draft, area: cebu_city, name: "Draft pool", tags: [ swimming ])
    # Nothing to book in Oslob, so its whale watching doesn't count.
    create(:landmark, area: empty_area, name: "Tan-awan", tags: [ whale_watching ])
    # Listings count for an activity through their category's tags: two tours and a camera
    # for sightseeing, one camera for swimming. A pending listing, or one in Oslob (not
    # bookable: nothing active there), doesn't count.
    tour = create(:category, name: "Tour", tags: [ sightseeing ])
    camera = create(:category, name: "Action camera", tags: [ sightseeing, swimming ])
    create(:listing, area: bantayan, category: tour)
    create(:listing, area: cebu_city, category: tour)
    create(:listing, area: cebu_city, category: camera)
    create(:listing, :pending, area: bantayan, category: camera)
    create(:listing, :pending, area: empty_area, category: camera)
  end

  path "/api/v1/activities" do
    get "Activities guests can do in bookable areas" do
      tags "Discovery"
      produces "application/json"
      description "Activity tags with the number of bookable areas and published landmarks that have them, " \
        "and of active listings in bookable areas whose category carries the tag; most listings first. " \
        "Activities with no published landmark in a bookable area are left out."

      response "200", "activities with counts" do
        schema type: :array, items: { "$ref" => "#/components/schemas/activity" }

        run_test! do |response|
          expect(response.parsed_body).to eq([
            { "slug" => "sightseeing", "name" => "Sightseeing", "area_count" => 1, "landmark_count" => 1,
              "listing_count" => 3 },
            { "slug" => "swimming", "name" => "Swimming", "area_count" => 2, "landmark_count" => 3,
              "listing_count" => 1 }
          ])
        end
      end
    end
  end
end
