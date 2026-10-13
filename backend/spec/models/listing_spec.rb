require "rails_helper"

RSpec.describe Listing do
  let(:schema) do
    { "type" => "object", "properties" => { "seats" => { "type" => "integer" } }, "required" => [ "seats" ] }
  end
  let(:van) { create(:category, slug: "van", name: "Van", booking_type: "transfer", attribute_schema: schema) }

  it "is valid with attrs that match its category's schema" do
    expect(build(:listing, category: van, attrs: { "seats" => 12 })).to be_valid
  end

  it "checks attrs against the category's schema" do
    listing = build(:listing, category: van, attrs: { "seats" => "twelve" })

    expect(listing).not_to be_valid
    expect(listing.errors[:attrs]).to be_present
  end

  it "belongs to a bookable (leaf) category only" do
    listing = build(:listing, category: create(:category, :parent))

    expect(listing).not_to be_valid
    expect(listing.errors[:category]).to include("must be a bookable category")
  end

  it "is owned by a partner" do
    listing = build(:listing, partner: create(:user))

    expect(listing).not_to be_valid
    expect(listing.errors[:partner]).to include("must be a partner")
  end

  it "can't be owned by a guest even bypassing validations" do
    listing = build(:listing, partner: create(:user), business: create(:business))

    expect { listing.save!(validate: false) }.to raise_error(ActiveRecord::InvalidForeignKey)
  end

  it "belongs to one of its partner's businesses, even bypassing validations" do
    partner = create(:user, :partner)
    listing = build(:listing, partner:, business: create(:business))

    expect(listing).not_to be_valid
    expect(listing.errors[:business]).to include("must be one of the partner's businesses")
    expect { listing.save!(validate: false) }.to raise_error(ActiveRecord::InvalidForeignKey)
  end

  it "only allows known statuses" do
    expect(build(:listing, status: "archived")).not_to be_valid
  end

  it "is free to cancel unless the partner chose otherwise" do
    expect(build(:listing).cancellation_policy).to eq("free_cancellation")
  end

  it "only allows the cancellation policies we offer" do
    listing = build(:listing, cancellation_policy: "thirty_days")

    expect(listing).not_to be_valid
    expect { listing.save!(validate: false) }.to raise_error(ActiveRecord::StatementInvalid, /cancellation_policy_check/)
  end

  describe "a stay's attrs (RAA-94)" do
    before(:all) { require Rails.root.join("db/migrate/20261012230000_add_stay_rooms").to_s }

    let(:hotel) do
      create(:category, slug: "hotel", name: "Hotel", booking_type: "stay", attribute_schema: AddStayRooms::STAY_SCHEMA.deep_stringify_keys)
    end
    let(:room) { { "beds" => [ { "type" => "double", "count" => 1 } ] } }
    let(:entire_place) { { "place_type" => "entire_place", "rooms" => [ room, room ], "guests" => 4, "bathrooms" => 1.5 } }
    let(:private_room) { { "place_type" => "private_room", "rooms" => [ room ], "guests" => 2, "bathroom" => "shared", "shared_with" => [ "host" ] } }
    let(:shared_room) do
      { "place_type" => "shared_room", "rooms" => [ { "beds" => [ { "type" => "bunk", "count" => 4 } ] } ], "guests" => 1,
        "bathroom" => "shared", "dorm_type" => "female_only", "shared_with" => [ "other_guests" ] }
    end

    def stay(attrs) = build(:listing, category: hotel, attrs:)

    it "accepts each place type's own fields" do
      expect([ entire_place, private_room, shared_room ].map { stay(_1) }).to all(be_valid)
      expect(stay(private_room.except("shared_with"))).to be_valid
    end

    it "gives an entire place bedrooms and a bathroom count" do
      expect(stay(entire_place.except("bathrooms"))).not_to be_valid
      expect(stay(entire_place.merge("rooms" => []))).not_to be_valid
      expect(stay(entire_place.merge("rooms" => [ room ] * 21))).not_to be_valid
    end

    it "keeps a private or shared room to one room" do
      expect(stay(private_room.merge("rooms" => [ room, room ]))).not_to be_valid
      expect(stay(shared_room.merge("rooms" => [ room, room ]))).not_to be_valid
    end

    it "needs a bed in every room" do
      expect(stay(entire_place.merge("rooms" => [ room, { "beds" => [] } ]))).not_to be_valid
    end

    it "asks a shared room for its dorm type and who guests share with" do
      expect(stay(shared_room.except("dorm_type"))).not_to be_valid
      expect(stay(shared_room.merge("shared_with" => []))).not_to be_valid
      expect(stay(private_room.except("bathroom"))).not_to be_valid
    end

    it "no longer takes beds outside a room" do
      expect(stay(entire_place.except("rooms").merge("beds" => room["beds"]))).not_to be_valid
    end
  end
end
