require "rails_helper"

RSpec.describe Category do
  describe "#timed_rental? (RAA-254)" do
    it "is a vehicle or gear, and only a transfer is flat priced" do
      expect(create(:category, :motorcycle)).to have_attributes(timed_rental?: true, flat_priced?: false)
      expect(create(:category, :gear)).to have_attributes(timed_rental?: true, flat_priced?: false)
      expect(create(:category, :transfer)).to have_attributes(timed_rental?: false, flat_priced?: true)
      expect(create(:category, :accommodation)).to have_attributes(timed_rental?: false, flat_priced?: false)
    end
  end

  describe "#water_activity? (RAA-268)" do
    let(:water) { create(:category, :parent, slug: "water-activities", name: "Water activities") }

    it "is an activity under Water activities" do
      expect(create(:category, slug: "jet-ski", name: "Jet ski", booking_type: "activity", parent: water)).to be_water_activity
    end

    it "isn't a tour" do
      expect(create(:category, slug: "tour", name: "Tour", booking_type: "activity")).not_to be_water_activity
    end
  end

  describe "jet ski details (RAA-273)" do
    before do
      require Rails.root.join("db/migrate/20261107150000_add_jet_ski_details").to_s
      jet_ski
      2.times { AddJetSkiDetails.apply(ActiveRecord::Base.connection) }
    end

    let(:jet_ski) { create(:category, :water) }
    let(:attrs_errors) { ->(attrs) { build(:listing, category: jet_ski.reload, attrs:).tap(&:valid?).errors[:attrs] } }

    it "takes a brand, model, engine size, power and features, none of them required" do
      expect(attrs_errors.call({})).to be_empty
      expect(attrs_errors.call("brand" => "Yamaha", "model" => "VX Cruiser", "engine_cc" => 1049, "horsepower" => 110,
        "features" => %w[reverse_gear bluetooth_audio])).to be_empty
    end

    it "refuses an engine too small, an unknown feature and a blank brand" do
      expect(attrs_errors.call("engine_cc" => 20)).not_to be_empty
      expect(attrs_errors.call("features" => %w[jetpack])).not_to be_empty
      expect(attrs_errors.call("brand" => "")).not_to be_empty
    end

    it "isn't a vehicle rental" do
      expect(jet_ski.reload).not_to be_vehicle
    end

    it "is put back to an empty schema on rollback" do
      AddJetSkiDetails.unapply(ActiveRecord::Base.connection)
      expect(jet_ski.reload.attribute_schema).to eq({})
    end
  end

  describe "#guest_group" do
    let(:vehicles) { create(:category, :parent, slug: "vehicle-rentals", name: "Vehicle rental") }
    let(:gear) { create(:category, :parent, slug: "equipment-rentals", name: "Equipment rental") }

    it "is gear for a rental under Equipment rental, so it isn't a trip's Getting around" do
      expect(create(:category, slug: "snorkel-gear", name: "Snorkel gear", parent: gear).guest_group).to eq("gear")
    end

    it "is the booking type for anything else" do
      expect(create(:category, slug: "motorcycle", name: "Motorcycle", parent: vehicles).guest_group).to eq("rental")
      expect(create(:category, slug: "tour", name: "Tour", booking_type: "activity").guest_group).to eq("activity")
      expect(create(:category, :accommodation).guest_group).to eq("stay")
    end

    it "agrees with .in_guest_group, its SQL" do
      leaves = [
        create(:category, slug: "snorkel-gear", name: "Snorkel gear", parent: gear),
        create(:category, slug: "motorcycle", name: "Motorcycle", parent: vehicles),
        create(:category, slug: "tour", name: "Tour", booking_type: "activity"),
        create(:category, :accommodation),
        create(:category, :transfer)
      ]
      Category::GUEST_GROUPS.each do |group|
        expect(Category.in_guest_group(group)).to match_array(leaves.select { _1.guest_group == group })
      end
    end
  end
end
