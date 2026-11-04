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
