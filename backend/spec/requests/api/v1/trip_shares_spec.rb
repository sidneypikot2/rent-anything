require "swagger_helper"

RSpec.describe "Trip share links", type: :request do
  let(:user) { create(:user) }
  let(:Authorization) { bearer_for(user) }
  let(:day) { 20.days.from_now.to_date }
  let(:trip) { create(:trip, user:, name: "Bantayan with friends", starts_on: day, ends_on: day + 2, guests: 3) }
  let(:trip_id) { trip.id }

  path "/api/v1/trips/{trip_id}/share" do
    parameter name: :trip_id, in: :path, schema: { type: :integer }

    get "The trip's share link" do
      tags "Trips"
      produces "application/json"
      description "Guest-only. The trip's view-only share link, for copying again; both null while it isn't shared."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "the share link" do
        schema "$ref" => "#/components/schemas/trip_share"
        before { trip.share! }

        run_test! do |response|
          token = trip.reload.share_token
          expect(response.parsed_body).to eq("token" => token, "path" => "/trips/shared/#{token}")
        end
      end

      response "200", "a trip that isn't shared" do
        schema "$ref" => "#/components/schemas/trip_share"

        run_test! { |response| expect(response.parsed_body).to eq("token" => nil, "path" => nil) }
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test!
      end
    end

    post "Share the trip, or make a new share link" do
      tags "Trips"
      produces "application/json"
      description "Guest-only. Anyone with the link can see the trip, without signing in: its name, dates, guests " \
        "and items, never prices, contact details or booking references, and nothing they can change. A new " \
        "link ends the old one."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "201", "the new share link; the old one no longer opens" do
        schema "$ref" => "#/components/schemas/trip_share"
        let!(:old) { trip.share! }

        run_test! do |created|
          token = created.parsed_body["token"]
          expect(token).to eq(trip.reload.share_token).and(be_present).and(satisfy { _1 != old })
          get "/api/v1/shared_trips/#{old}"
          expect(response).to have_http_status(:not_found)
        end
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user, :partner)) }

        run_test!
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip) }

        run_test! { expect(trip.reload.share_token).to be_nil }
      end
    end

    delete "Stop sharing the trip" do
      tags "Trips"
      description "Guest-only. The share link no longer opens."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "204", "no longer shared" do
        let!(:token) { trip.share! }

        run_test! do
          expect(trip.reload.share_token).to be_nil
          get "/api/v1/shared_trips/#{token}"
          expect(response).to have_http_status(:not_found)
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"
        let(:trip) { create(:trip).tap(&:share!) }

        run_test! { expect(trip.reload.share_token).to be_present }
      end
    end
  end

  path "/api/v1/shared_trips/{token}" do
    parameter name: :token, in: :path, schema: { type: :string }

    get "A trip as its share link shows it" do
      tags "Trips"
      produces "application/json"
      description "Public: no sign-in, and no way into the guest's cart. Sent with `X-Robots-Tag: noindex`. An " \
        "unknown token, or one replaced or revoked, is a 404."

      response "200", "the trip, view-only" do
        schema "$ref" => "#/components/schemas/shared_trip"
        let(:token) { trip.share! }

        before do
          bantayan = create(:area, kind: "island", name: "Bantayan Island", slug: "bantayan-island")
          tour = create(:listing, area: create(:area, kind: "town", name: "Santa Fe", slug: "santa-fe", parent: bantayan),
            title: "Island hopping")
          booked = create(:trip_item, trip:, listing: tour, starts_on: day, ends_on: day)
          create(:booking, :checkout, listing: tour, user:, trip_item: booked, status: "accepted", starts_on: day, ends_on: day)
          create(:trip_item, trip:, listing: tour, starts_on: day + 1, ends_on: day + 1)
        end

        run_test! do |response|
          expect(response.headers["X-Robots-Tag"]).to eq("noindex")
          body = response.parsed_body
          expect(body.keys).to eq(%w[name starts_on ends_on guests destinations items])
          expect(body).to include("name" => "Bantayan with friends", "guests" => 3, "destinations" => [ "Bantayan Island" ])
          expect(body["items"].map(&:keys).uniq).to eq([ %w[starts_on ends_on booking_type area listing booking_status] ])
          expect(body["items"].first["listing"].keys).to eq(%w[id title cover_photo_url])
          expect(body["items"].pluck("booking_status")).to eq([ "accepted", nil ])
          expect(response.body).not_to include(user.email, "total_cents", "reference")
        end
      end

      response "404", "an unknown token" do
        schema "$ref" => "#/components/schemas/error"
        let(:token) { "not-a-token" }

        run_test! { |response| expect(response.headers["X-Robots-Tag"]).to eq("noindex") }
      end
    end
  end
end
