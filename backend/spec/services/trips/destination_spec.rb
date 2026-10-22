require "rails_helper"

RSpec.describe Trips::Destination do
  let(:cebu) { create(:area, kind: "province", name: "Cebu") }
  let(:bantayan) { create(:area, kind: "island", name: "Bantayan Island", parent: cebu) }
  let(:santa_fe) { create(:area, kind: "town", name: "Santa Fe", parent: bantayan) }
  let(:cebu_city) { create(:area, kind: "city", name: "Cebu City", parent: cebu) }

  describe ".for" do
    it "is the island a town is on" do
      expect(described_class.for(santa_fe)).to eq(bantayan)
    end

    it "is the town or city itself when it isn't on a smaller island" do
      expect(described_class.for(cebu_city)).to eq(cebu_city)
    end

    it "never goes up to a province" do
      expect(described_class.for(cebu)).to be_nil
    end

    it "skips an island that isn't published" do
      bantayan.update!(status: "draft")
      expect(described_class.for(santa_fe)).to eq(santa_fe)
    end
  end

  describe ".trip_name" do
    it "names a trip after the destination and its dates" do
      name = described_class.trip_name(santa_fe, Date.new(2026, 11, 12), Date.new(2026, 11, 15))
      expect(name).to eq("Bantayan Island · Nov 12–15")
    end

    it "spells out both months when they differ" do
      name = described_class.trip_name(cebu_city, Date.new(2026, 11, 30), Date.new(2026, 12, 2))
      expect(name).to eq("Cebu City · Nov 30 – Dec 2")
    end

    it "adds the years when they differ" do
      name = described_class.trip_name(cebu_city, Date.new(2026, 12, 30), Date.new(2027, 1, 2))
      expect(name).to eq("Cebu City · Dec 30, 2026 – Jan 2, 2027")
    end

    it "shows one day once" do
      expect(described_class.trip_name(cebu_city, Date.new(2026, 11, 12), Date.new(2026, 11, 12)))
        .to eq("Cebu City · Nov 12")
    end

    it "shortens a long place name to fit 80 characters" do
      long = create(:area, kind: "town", name: "Very Long Barangay Name " * 5)
      name = described_class.trip_name(long, Date.new(2026, 12, 30), Date.new(2027, 1, 2))
      expect(name.length).to eq(80)
      expect(name).to end_with("... · Dec 30, 2026 – Jan 2, 2027")
    end

    it "is the destination alone without dates" do
      expect(described_class.trip_name(santa_fe, nil, nil)).to eq("Bantayan Island")
    end
  end

  describe ".for_places" do
    let(:from) { Date.new(2026, 10, 22) }
    let(:to) { Date.new(2026, 10, 27) }

    before { [ santa_fe, cebu_city ] }

    it "names every place a dated trip is in, before its dates" do
      expect(described_class.for_places("Bantayan Island · Oct 22–27", [ "Bantayan Island", "Cebu City" ], from, to))
        .to eq("Bantayan Island · Cebu City · Oct 22–27")
    end

    it "drops a place the trip no longer has" do
      expect(described_class.for_places("Bantayan Island · Cebu City · Oct 22–27", [ "Cebu City" ], from, to))
        .to eq("Cebu City · Oct 22–27")
    end

    it "renames an undated trip" do
      expect(described_class.for_places("Bantayan Island", [ "Bantayan Island", "Cebu City" ], nil, nil))
        .to eq("Bantayan Island · Cebu City")
    end

    it "leaves a name the guest typed" do
      expect(described_class.for_places("Summer with Ana · Oct 22–27", [ "Bantayan Island", "Cebu City" ], from, to))
        .to be_nil
    end

    it "is nil when the places haven't changed or the trip is empty" do
      expect(described_class.for_places("Bantayan Island · Oct 22–27", [ "Bantayan Island" ], from, to)).to be_nil
      expect(described_class.for_places("Bantayan Island · Oct 22–27", [], from, to)).to be_nil
    end
  end
end
