require "swagger_helper"

RSpec.describe "Checkouts", type: :request do
  let(:user) { create(:user, name: "Ana Reyes") }
  let(:Authorization) { bearer_for(user) }
  let(:day) { 20.days.from_now.to_date }
  let(:trip) { create(:trip, user:, starts_on: day, ends_on: day + 3, guests: 2) }
  # ₱2,000 a night for 2 guests, booked at once.
  let(:stay) { create(:listing, :stay, booking_mode: "instant", cancellation_policy: "seven_days") }
  # ₱1,500 a joiner, on request.
  let(:tour) { create(:listing, :tour, booking_mode: "request") }
  let!(:stay_item) { create(:trip_item, trip:, listing: stay, starts_on: day, ends_on: day + 2, quantity: 2) }
  let!(:tour_item) { create(:trip_item, trip:, listing: tour, starts_on: day + 1, ends_on: day + 1, quantity: 2) }
  let(:item_ids) { [ stay_item.id, tour_item.id ] }
  let(:body) { { trip_id: trip.id, item_ids:, idempotency_key: "checkout-0001" } }

  def check_out(values = {})
    post "/api/v1/checkouts", as: :json, params: body.merge(values), headers: { "Authorization" => Authorization() }
  end

  path "/api/v1/checkouts" do
    post "Book a trip's items" do
      tags "Bookings"
      consumes "application/json"
      produces "application/json"
      description "Guest-only (RAA-132). Books `item_ids` of one of the guest's trips: each item is re-priced and " \
        "checked against the calendar as it is now, all or nothing. An instant-book listing's booking is held for " \
        "payment; a request-to-book one's is a request its partner answers within 24 hours. Both hold their days " \
        "at once. Requests wait for their partner's answer (RAA-134). Nothing is paid here: the guest pays for " \
        "bookings held for payment afterwards (POST /bookings/pay, RAA-143). Sending the same `idempotency_key` again returns the same checkout."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/checkout_body" }

      response "201", "both booked while auto-accept is on: the instant one and the accepted request held for payment" do
        schema "$ref" => "#/components/schemas/checkout"

        before { allow(Bookings).to receive(:auto_accept?).and_return(true) }

        run_test! do |response|
          checkout = response.parsed_body
          expect(checkout["total_cents"]).to eq(400_000 + 300_000)
          expect(checkout["bookings"].pluck("listing").pluck("id", "instant_book")).to eq([ [ stay.id, true ], [ tour.id, false ] ])
          expect(checkout["bookings"].pluck("status")).to eq(%w[awaiting_payment awaiting_payment])
          expect(checkout["bookings"].first).to include("guests" => 2, "cancellation_policy" => "seven_days",
            "booking_mode" => "instant", "trip_id" => trip.id)

          stay_booking, tour_booking = Booking.order(:starts_on).to_a
          expect(stay_booking.events.pluck(:from_status, :to_status, :actor)).to eq([ [ nil, "awaiting_payment", "guest" ] ])
          expect(tour_booking.events.pluck(:to_status)).to eq(%w[requested accepted awaiting_payment])
          expect(stay_booking.expires_at).to be_within(1.minute).of(Booking::PAYMENT_TTL.from_now)
          expect(tour_booking.expires_at).to be_within(1.minute).of(Booking::ACCEPTED_PAYMENT_TTL.from_now)
          expect(stay_booking).to have_attributes(guest_name: "Ana Reyes", source: "checkout", commission_bps: 1000,
            commission_cents: 40_000, trip_item: stay_item)
          expect(Payment.count).to eq(0)
          expect(stay_item.reload).to be_booked
        end
      end

      response "201", "a request waits for its partner (auto-accept is off), its days held" do
        schema "$ref" => "#/components/schemas/checkout"

        run_test! do |response|
          expect(response.parsed_body["bookings"].pluck("status")).to eq(%w[awaiting_payment requested])
          request = Booking.requested.sole
          expect(request.expires_at).to be_within(1.minute).of(24.hours.from_now)
          ledger = Availability::Ledger.new([ tour ], day + 1, day + 1)
          expect(ledger.day(tour, day + 1)[:booked]).to eq(2)
        end
      end

      response "201", "sent again with its key: the same checkout" do
        schema "$ref" => "#/components/schemas/checkout"

        before { check_out }

        run_test! do |response|
          expect(response.parsed_body["id"]).to eq(Checkout.sole.id)
          expect(Booking.count).to eq(2)
        end
      end

      response "201", "a rental isn't priced yet: booked at ₱0, to be agreed, one unit for the guests" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:rental) { create(:listing, booking_mode: "instant") }
        let!(:rental_item) { create(:trip_item, trip:, listing: rental, starts_on: day, ends_on: day + 1, quantity: 3) }
        let(:item_ids) { [ rental_item.id ] }

        run_test! do |response|
          expect(response.parsed_body["bookings"].sole).to include("total_cents" => 0, "to_be_agreed" => true,
            "status" => "awaiting_payment", "quantity" => 1, "guests" => 3)
        end
      end

      response "201", "gear is booked by the count: two cameras are one booking for two units, with no guests" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:camera) { create(:listing, :gear, booking_mode: "instant") }
        let!(:camera_item) { create(:trip_item, trip:, listing: camera, starts_on: day, ends_on: day + 1, quantity: 2) }
        let(:item_ids) { [ camera_item.id ] }

        run_test! do |response|
          expect(response.parsed_body["bookings"].sole).to include("to_be_agreed" => true, "quantity" => 2, "guests" => nil)
        end
      end

      response "201", "10 people on 2-seat motorbikes book 5 of them, or the 6 they chose (RAA-191)" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:click) { create(:listing, :vehicle, booking_mode: "instant") }
        let!(:derived) { create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day + 1, quantity: 10) }
        let!(:chosen) { create(:trip_item, trip:, listing: click, starts_on: day + 2, ends_on: day + 2, quantity: 10, units: 6) }
        let(:item_ids) { [ derived.id, chosen.id ] }

        before { click.units.create!((2..6).map { |position| { position: } }) }

        run_test! do |response|
          # Priced for each motorbike and day: ₱500 × 5 × 1 day, and ₱500 × 6 × 1 day.
          expect(response.parsed_body["bookings"].map { _1.slice("quantity", "guests", "total_cents", "to_be_agreed") })
            .to eq([ { "quantity" => 5, "guests" => 10, "total_cents" => 250_000, "to_be_agreed" => false },
              { "quantity" => 6, "guests" => 10, "total_cents" => 300_000, "to_be_agreed" => false } ])
          # A rental counts on the days it starts (RAA-195): the first is back on day + 1.
          ledger = Availability::Ledger.new([ click.reload ], day, day + 2)
          expect([ day, day + 1, day + 2 ].map { ledger.day(click, _1)[:booked] }).to eq([ 5, 0, 6 ])
        end
      end

      response "201", "back-to-back rentals of one motorbike, each 24 hours from its pickup time (RAA-195)" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:click) { create(:listing, :vehicle, booking_mode: "instant") }
        let!(:first) { create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day + 1, quantity: 1, pickup_time: "08:00") }
        let!(:second) { create(:trip_item, trip:, listing: click, starts_on: day + 1, ends_on: day + 2, quantity: 1, pickup_time: "08:00") }
        let(:item_ids) { [ first.id, second.id ] }

        run_test! do |response|
          periods = response.parsed_body["bookings"].map { [ Time.zone.parse(_1["starts_at"]), Time.zone.parse(_1["ends_at"]) ] }
          expected = [ day, day + 1 ].map { |on| Booking.rental_period(on, on + 1, "08:00") }.map { [ _1.begin, _1.end ] }
          expect(periods).to eq(expected)
        end
      end

      # Delivery and pick-up (RAA-195): the fees for each of the 2 motorbikes, and the booking
      # keeps the choice and the address for the partner.
      response "201", "a rental delivered and collected, its fees in the total" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:click) { create(:listing, :vehicle, booking_mode: "instant").tap { _1.units.create!(position: 2) } }
        let!(:item) do
          create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day + 1, quantity: 2, units: 2,
            delivery: true, return_pickup: true, delivery_address: "Kota Beach Resort")
        end
        let(:item_ids) { [ item.id ] }

        before { click.vehicle_rate.update!(delivery_fee_cents: 15_000, return_pickup_fee_cents: 10_000) }

        run_test! do |response|
          booking = response.parsed_body["bookings"].sole
          daily = click.vehicle_rate.daily_price_cents
          expect(booking["total_cents"]).to eq((daily * 2) + 30_000 + 20_000)
          expect(booking.slice("delivery", "return_pickup", "delivery_address"))
            .to eq("delivery" => true, "return_pickup" => true, "delivery_address" => "Kota Beach Resort")
          expect(Booking.find(booking["id"]).price_breakdown).to include("delivery_cents" => 30_000, "return_pickup_cents" => 20_000)
        end
      end

      response "422", "a pickup before the motorbike is back" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:click) { create(:listing, :vehicle, booking_mode: "instant", title: "Honda Click") }
        let!(:first) { create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day + 1, quantity: 1, pickup_time: "08:00") }
        let!(:second) { create(:trip_item, trip:, listing: click, starts_on: day + 1, ends_on: day + 2, quantity: 1, pickup_time: "07:00") }
        let(:item_ids) { [ first.id, second.id ] }

        run_test! { |response| expect(response.parsed_body["errors"].join).to include("Honda Click: Available from 8:00 AM") }
      end

      response "422", "more motorbikes than are free" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:click) { create(:listing, :vehicle, booking_mode: "instant", title: "Honda Click") }
        let!(:item) { create(:trip_item, trip:, listing: click, starts_on: day, ends_on: day, quantity: 10, units: 5) }
        let(:item_ids) { [ item.id ] }

        before { click.units.create!((2..4).map { |position| { position: } }) }

        run_test! { |response| expect(response.parsed_body["errors"].join).to include("Honda Click: Only 4 left on") }
      end

      response "201", "priced gear and a transfer: by the item and day, and by the trip (RAA-191)" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:camera) { create(:listing, :gear, booking_mode: "instant").tap { create(:flat_rate, listing: _1, price_cents: 30_000) } }
        let(:van) { create(:listing, :transfer, booking_mode: "instant") }
        let!(:camera_item) { create(:trip_item, trip:, listing: camera, starts_on: day, ends_on: day + 2, quantity: 2) }
        let!(:van_item) { create(:trip_item, trip:, listing: van, starts_on: day, ends_on: day, quantity: 4) }
        let(:item_ids) { [ camera_item.id, van_item.id ] }

        run_test! do |response|
          expect(response.parsed_body["bookings"].map { _1.slice("quantity", "total_cents", "to_be_agreed") })
            .to contain_exactly({ "quantity" => 2, "total_cents" => 120_000, "to_be_agreed" => false },
              { "quantity" => 1, "total_cents" => 150_000, "to_be_agreed" => false })
        end
      end

      response "201", "a stay for more guests than a unit sleeps takes two units" do
        schema "$ref" => "#/components/schemas/checkout"

        let(:item_ids) { [ stay_item.id ] }

        before do
          stay.units.create!(position: 2)
          stay_item.update!(quantity: 6)
        end

        run_test! do |response|
          booking = response.parsed_body["bookings"].sole
          expect(booking).to include("quantity" => 2, "guests" => 6)
          expect(Booking.sole.price_breakdown["quantity"]).to eq(2)
        end
      end

      response "201", "a guest without an account gives their contact details; partners see them, and the trip link comes once" do
        schema "$ref" => "#/components/schemas/checkout"
        let(:user) { User.create!(role: "guest") }
        let(:body) { super().merge(contact: { name: "Ana Reyes", email: "Ana@Example.com ", phone: "+639171234567", terms_accepted: true }) }

        run_test! do |first|
          link = first.parsed_body["trip_link"]
          expect(link["pin"]).to match(/\A\d{6}\z/)
          expect(user.reload).to have_attributes(email: "ana@example.com", name: "Ana Reyes", registration_complete: true,
            terms_version: User::TERMS_VERSION)
          expect(Booking.pluck(:guest_name, :guest_email, :guest_phone).uniq)
            .to eq([ [ "Ana Reyes", "ana@example.com", "+639171234567" ] ])
          expect(TripAccess.find_by_token(link["token"]).authenticate_pin(link["pin"])).to be_truthy
          expect(ActionMailer::MailDeliveryJob).to have_been_enqueued
            .with("GuestMailer", "trip_link", "deliver_now", a_hash_including(args: array_including(user, trip)))

          # The next checkout doesn't show them again.
          post "/api/v1/checkouts", as: :json, headers: { "Authorization" => Authorization() },
            params: { trip_id: trip.id, item_ids: [ create(:trip_item, trip:, listing: tour, starts_on: day + 2,
              ends_on: day + 2).id ], idempotency_key: "checkout-0003" }
          expect(response.parsed_body["trip_link"]).to be_nil
        end
      end

      response "409", "the email belongs to another guest: a code is emailed to it, and nothing is booked" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { User.create!(role: "guest") }
        let!(:owner) { create(:user, email: "ana@example.com") }
        let(:body) { super().merge(contact: { name: "Ana Reyes", email: "ana@example.com", phone: "+639171234567", terms_accepted: true }) }

        run_test! do
          expect(owner.sign_in_codes.usable.count).to eq(1)
          expect(ActionMailer::MailDeliveryJob).to have_been_enqueued.with("GuestMailer", "sign_in_code", "deliver_now",
            a_hash_including(args: array_including(owner)))
          expect(user.reload.email).to be_nil
          expect(Booking.count).to eq(0)
        end
      end

      response "422", "a guest without an account must agree to the terms" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:user) { User.create!(role: "guest") }
        let(:body) { super().merge(contact: { name: "Ana Reyes", email: "ana@example.com", phone: "+639171234567" }) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(a_string_matching(/Terms/))
          expect(user.reload.email).to be_nil
          expect(Booking.count).to eq(0)
        end
      end

      response "422", "a guest without an account must give name, email and phone" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:user) { User.create!(role: "guest") }
        let(:body) { super().merge(contact: { name: "Ana Reyes", email: "ana@example.com", phone: 9_171_234_567, terms_accepted: true }) }

        run_test! do |first|
          expect(first.parsed_body["errors"]).to include("Phone is required")
          check_out(contact: nil)
          expect(response.parsed_body["errors"]).to include(a_string_matching(/Contact details/))
          expect(Booking.count).to eq(0)
        end
      end

      response "422", "the stay's dates were taken meanwhile: nothing is booked" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:booking, listing: stay, starts_on: day + 1, ends_on: day + 3) }

        run_test! do |response|
          expect(response.parsed_body["errors"].sole).to start_with("Kota Beach house: Those dates aren't available")
          expect(Booking.count).to eq(1)
          expect(Checkout.count).to eq(0)
        end
      end

      response "422", "a request still waiting holds its seats against another guest" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:item_ids) { [ tour_item.id ] }

        before do
          tour.tour_detail.update!(max_guests: 3, min_guests: 1)
          create(:booking, :checkout, listing: tour, status: "requested", starts_on: day + 1, ends_on: day + 1, quantity: 2)
        end

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Virgin Island hopping: Only 1 left on #{(day + 1).strftime('%b %-d')}" ])
        end
      end

      response "422", "an undated item, one booked already and an unknown key" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let!(:undated) { create(:trip_item, trip:, listing: create(:listing, title: "Sea kayak rental"), starts_on: nil, ends_on: nil) }
        let(:item_ids) { [ undated.id, tour_item.id ] }

        before { create(:booking, :checkout, listing: tour, trip_item: tour_item, status: "confirmed") }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to contain_exactly("Sea kayak rental: pick dates before booking it",
            "Virgin Island hopping is already booked")
        end
      end

      response "422", "items and key of the wrong shape" do
        schema "$ref" => "#/components/schemas/validation_errors"

        let(:body) { { trip_id: trip.id, item_ids: "1,2", idempotency_key: "short" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq([ "Items must be a list of the trip's item ids",
            "Idempotency key must be text of 8 to 80 characters" ])
        end
      end

      response "404", "another guest's trip" do
        schema "$ref" => "#/components/schemas/error"

        let(:trip) { create(:trip, starts_on: day, ends_on: day + 3) }

        run_test! { expect(Booking.count).to eq(0) }
      end

      response "403", "a partner" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { bearer_for(create(:user, :partner)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"

        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  describe "a stay split into rooms (RAA-182)" do
    let(:stay) do
      create(:listing, :stay, booking_mode: "instant", attrs: { "place_type" => "entire_place", "guests" => 5,
        "pets_allowed" => true })
    end
    let(:headers) { { "Authorization" => Authorization() } }

    before { (2..3).each { stay.units.create!(position: _1) } }

    it "keeps the guest's split from the cart to the booking, and prices each room" do
      create(:listing_fee, listing: stay, name: "Pet fee", amount_cents: 30_000, charged_per: "pet", position: 1)
      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, headers:,
        params: { room_guests: [ { adults: 1 }, { adults: 4, children: 1 } ], pets: 1 }
      expect(response).to have_http_status(:ok)
      item = response.parsed_body["items"].find { _1["id"] == stay_item.id }
      expect(item).to include("quantity" => 6, "pets" => 1,
        "room_guests" => [ { "adults" => 1, "children" => 0, "infants" => 0 }, { "adults" => 4, "children" => 1, "infants" => 0 } ])

      check_out(item_ids: [ stay_item.id ])
      expect(response).to have_http_status(:created)
      booking = stay_item.reload.booking
      expect(booking).to have_attributes(quantity: 2, guests: 6, pets: 1, room_guests: item["room_guests"])
      # Two nights at P2,000 a room (no extra-guest fee set), and the pet fee once.
      expect(booking.total_cents).to eq(2 * 2 * 200_000 + 30_000)
      expect(booking.price_breakdown["rooms"].pluck("adults", "children")).to eq([ [ 1, 0 ], [ 4, 1 ] ])
    end

    it "refuses a split that doesn't fit the stay" do
      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, headers:, params: { room_guests: [ { children: 2 } ] }
      expect(response.parsed_body["errors"]).to eq([ "Each room needs an adult" ])

      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, headers:, params: { room_guests: [ { adults: 6 } ] }
      expect(response.parsed_body["errors"]).to eq([ "A room here sleeps at most 5 guests" ])

      patch "/api/v1/trip_items/#{tour_item.id}", as: :json, headers:, params: { room_guests: [ { adults: 2 } ] }
      expect(response.parsed_body["errors"]).to eq([ "Only a stay can be split into rooms or take pets" ])
    end

    it "takes 10 guests in two rooms without a split" do
      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, headers:, params: { quantity: 10 }
      check_out(item_ids: [ stay_item.id ])

      expect(stay_item.reload.booking).to have_attributes(quantity: 2, guests: 10, room_guests: nil)
    end
  end

  describe "a booked item" do
    before { check_out }

    it "can't be changed, removed, or deleted with its trip" do
      headers = { "Authorization" => Authorization() }
      patch "/api/v1/trip_items/#{stay_item.id}", as: :json, params: { quantity: 2 }, headers: headers
      expect(response.parsed_body["errors"]).to eq([ "A booked item can't be changed: cancel its booking first" ])

      delete "/api/v1/trip_items/#{stay_item.id}", headers: headers
      expect(response.parsed_body["errors"]).to eq([ "A booked item can't be removed: cancel its booking first" ])

      delete "/api/v1/trips/#{trip.id}", headers: headers
      expect(response).to have_http_status(:unprocessable_content)
      expect(trip.reload.items.count).to eq(2)
    end

    it "shows its booking in the cart, and can be booked again once that is cancelled" do
      get "/api/v1/trips/#{trip.id}", headers: { "Authorization" => Authorization() }
      expect(response.parsed_body["items"].pluck("booking").pluck("status")).to eq(%w[awaiting_payment requested])

      Bookings::Cancel.call(stay_item.booking, by: "guest", user:)
      check_out(item_ids: [ stay_item.id ], idempotency_key: "checkout-0002")
      expect(response).to have_http_status(:created)
    end
  end
end
