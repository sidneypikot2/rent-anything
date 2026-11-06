require "swagger_helper"

RSpec.describe "Saved places", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:bantayan) { create(:area, kind: "island", name: "Bantayan Island", slug: "bantayan-island") }
  let(:santa_fe) { create(:area, kind: "town", name: "Santa Fe", slug: "santa-fe", parent: bantayan) }
  let(:kota) { create(:landmark, area: santa_fe, slug: "kota-beach", name: "Kota Beach") }
  let(:trip) { create(:trip, user:, name: "Bantayan with friends") }

  path "/api/v1/trip_landmarks" do
    post "Save a place to see to a trip" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. Saves a published place to see to `trip_id` (\"want to go\"), or, without one, to a " \
        "new undated trip named after the place's destination, or `trip_name` if the guest typed one, for " \
        "`guests` (default 1). A saved place has no dates or price, is never booked, and doesn't name the " \
        "trip or count among its destinations. Saving one the trip already has changes nothing. Answers with " \
        "the trip."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          landmark_slug: { type: :string },
          trip_id: { type: :integer, nullable: true, description: "Omit or null for a new trip" },
          trip_name: { type: :string, nullable: true, description: "A new trip's name; ignored with trip_id" },
          guests: { type: :integer, description: "A new trip's guests, 1 to 50; ignored with trip_id" }
        },
        required: %w[landmark_slug]
      }

      response "201", "saved to the trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { landmark_slug: kota.slug, trip_id: trip.id } }

        run_test! do |response|
          saved = trip.saved_landmarks.sole
          expect(response.parsed_body["saved_landmarks"]).to eq(
            [ { "id" => saved.id, "slug" => "kota-beach", "name" => "Kota Beach", "area_slug" => "santa-fe",
                "plan" => nil, "visit_on" => nil } ]
          )
          expect(response.parsed_body["destinations"]).to eq([])
          expect(trip.reload.name).to eq("Bantayan with friends")
        end
      end

      response "201", "with no trip, it starts one named after the place's destination" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { landmark_slug: kota.slug, guests: 3 } }

        run_test! do |response|
          expect(response.parsed_body).to include("name" => "Bantayan Island", "guests" => 3, "starts_on" => nil)
          expect(user.trips.sole.saved_landmarks.sole.landmark).to eq(kota)
        end
      end

      response "201", "saving it again changes nothing" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { landmark_slug: kota.slug, trip_id: trip.id } }
        before { trip.saved_landmarks.create!(landmark: kota) }

        run_test! { expect(trip.saved_landmarks.count).to eq(1) }
      end

      response "404", "a draft place" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { landmark_slug: create(:landmark, :draft).slug, trip_id: trip.id } }

        run_test! { expect(TripLandmark.count).to eq(0) }
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:body) { { landmark_slug: kota.slug, trip_id: create(:trip).id } }

        run_test! { expect(TripLandmark.count).to eq(0) }
      end

      response "422", "no place" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { trip_id: trip.id } }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { { landmark_slug: kota.slug } }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user, :partner)) }
        let(:body) { { landmark_slug: kota.slug } }

        run_test!
      end
    end
  end

  path "/api/v1/trip_landmarks/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    let(:saved) { trip.saved_landmarks.create!(landmark: kota) }
    let(:id) { saved.id }

    patch "Say how the guest means to see a saved place" do
      tags "Trips"
      consumes "application/json"
      produces "application/json"
      description "Guest-only. `plan` is `own` with `visit_on`, a day of the trip; `skip`; or null to leave it " \
        "undecided. A rental never sets this, and a tour needs none: a tour in the trip covers a place by " \
        "stopping there. Answers with the trip."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: {
        type: :object,
        properties: {
          plan: { type: :string, nullable: true, enum: [ "own", "skip", nil ] },
          visit_on: { type: :string, format: :date, nullable: true, description: "Required for `own`" }
        },
        required: %w[plan]
      }
      let(:trip) { create(:trip, user:, starts_on: Date.new(2027, 2, 10), ends_on: Date.new(2027, 2, 12)) }

      response "200", "going on their own, on a day of the trip" do
        schema "$ref" => "#/components/schemas/trip"
        let(:body) { { plan: "own", visit_on: "2027-02-11" } }

        run_test! do |response|
          expect(response.parsed_body["saved_landmarks"].sole).to include("plan" => "own", "visit_on" => "2027-02-11")
        end
      end

      response "200", "skipping it clears the day" do
        schema "$ref" => "#/components/schemas/trip"
        let(:saved) { trip.saved_landmarks.create!(landmark: kota, plan: "own", visit_on: Date.new(2027, 2, 11)) }
        let(:body) { { plan: "skip", visit_on: "2027-02-11" } }

        run_test! { expect(saved.reload).to have_attributes(plan: "skip", visit_on: nil) }
      end

      response "200", "null goes back to undecided" do
        schema "$ref" => "#/components/schemas/trip"
        let(:saved) { trip.saved_landmarks.create!(landmark: kota, plan: "skip") }
        let(:body) { { plan: nil } }

        run_test! { expect(saved.reload.plan).to be_nil }
      end

      response "422", "a day outside the trip" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { plan: "own", visit_on: "2027-02-13" } }

        run_test! { expect(saved.reload.plan).to be_nil }
      end

      response "422", "going on their own with no day" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { plan: "own" } }

        run_test!
      end

      response "422", "an undated trip has no day to go on" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:trip) { create(:trip, user:) }
        let(:body) { { plan: "own", visit_on: "2027-02-11" } }

        run_test!
      end

      response "422", "a plan that isn't one" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { plan: "ride" } }

        run_test!
      end

      response "422", "no plan sent" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { visit_on: "2027-02-11" } }

        run_test!
      end

      response "404", "another guest's saved place" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { create(:trip).saved_landmarks.create!(landmark: kota).id }
        let(:body) { { plan: "skip" } }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }
        let(:body) { { plan: "skip" } }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user, :partner)) }
        let(:body) { { plan: "skip" } }

        run_test!
      end
    end

    delete "Remove a saved place from its trip" do
      tags "Trips"
      produces "application/json"
      description "Guest-only. Answers with the trip."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "removed" do
        schema "$ref" => "#/components/schemas/trip"

        run_test! do |response|
          expect(response.parsed_body["saved_landmarks"]).to eq([])
          expect(TripLandmark.count).to eq(0)
        end
      end

      response "404", "another guest's saved place" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test! { expect(TripLandmark.count).to eq(1) }
      end
    end
  end

  describe "with other trip changes" do
    let(:headers) { { "Authorization" => bearer_for(user) } }
    let(:other) { create(:trip, user:, name: "Cebu") }

    it "moves saved places along when trips merge, keeping one of each" do
      paradise = create(:landmark, area: santa_fe, slug: "paradise-beach")
      trip.saved_landmarks.create!(landmark: kota)
      trip.saved_landmarks.create!(landmark: paradise)
      other.saved_landmarks.create!(landmark: kota)

      post "/api/v1/trips/#{trip.id}/merge", params: { into_trip_id: other.id }, headers:, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body["saved_landmarks"].pluck("slug")).to contain_exactly("kota-beach", "paradise-beach")
    end

    it "copies saved places when a trip is planned again" do
      trip.saved_landmarks.create!(landmark: kota)

      post "/api/v1/trips/#{trip.id}/copy", params: { starts_on: 40.days.from_now.to_date.iso8601 }, headers:, as: :json

      expect(response).to have_http_status(:created)
      expect(response.parsed_body.dig("trip", "saved_landmarks").pluck("slug")).to eq([ "kota-beach" ])
    end

    it "leaves out a place that went back to draft" do
      trip.saved_landmarks.create!(landmark: kota)
      kota.update!(status: "draft")

      get("/api/v1/trips/#{trip.id}", headers:)

      expect(response.parsed_body["saved_landmarks"]).to eq([])
    end
  end
end
