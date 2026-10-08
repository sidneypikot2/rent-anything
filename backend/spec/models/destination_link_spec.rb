require "rails_helper"

RSpec.describe DestinationLink do
  let(:moalboal) { create(:area, name: "Moalboal") }
  let(:badian) { create(:area, name: "Badian") }
  let(:kawasan) { create(:landmark, name: "Kawasan Falls", area: badian) }

  it "links an area and a landmark either way round, stored once" do
    link = described_class.create!(source: kawasan, target: moalboal, kind: "bundled")

    expect(link.other(moalboal)).to eq(kawasan)
    expect(link.other(kawasan)).to eq(moalboal)
    expect(described_class.new(source: moalboal, target: kawasan, kind: "adjacent")).not_to be_valid
  end

  it "refuses the same pair twice in the database, in either order" do
    described_class.create!(source: moalboal, target: badian, kind: "bundled")
    duplicate = described_class.new(source: badian, target: moalboal, kind: "adjacent")

    expect { duplicate.save!(validate: false) }.to raise_error(ActiveRecord::RecordNotUnique)
  end

  it "refuses a link to itself" do
    expect(described_class.new(source: moalboal, target: moalboal, kind: "bundled")).not_to be_valid
  end

  it "only links areas and landmarks" do
    link = described_class.new(source: moalboal, target: create(:tag), kind: "bundled")

    expect(link).not_to be_valid
  end

  it "keeps the weight between 1 and 3 and the kind to known values" do
    expect(described_class.new(source: moalboal, target: badian, kind: "bundled", weight: 4)).not_to be_valid
    expect(described_class.new(source: moalboal, target: badian, kind: "nearby")).not_to be_valid
  end

  describe ".for" do
    it "returns the links touching a record from either end" do
      to_badian = described_class.create!(source: moalboal, target: badian, kind: "bundled")
      to_kawasan = described_class.create!(source: kawasan, target: moalboal, kind: "bundled")
      described_class.create!(source: badian, target: kawasan, kind: "bundled")

      expect(described_class.for(moalboal)).to contain_exactly(to_badian, to_kawasan)
    end
  end

  it "goes when either end is deleted" do
    described_class.create!(source: moalboal, target: badian, kind: "bundled")

    expect { badian.destroy! }.to change(described_class, :count).by(-1)
  end
end
