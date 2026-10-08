require "rails_helper"

RSpec.describe Area do
  it "refuses a slug that is a top-level web path" do
    area = build(:area, slug: "partner")

    expect(area).not_to be_valid
    expect(area.errors[:slug]).to include("is reserved")
  end

  it "refuses the signed-in guest pages' paths as slugs" do
    expect(build(:area, slug: "profile")).not_to be_valid
    expect(build(:area, slug: "settings")).not_to be_valid
  end

  it "keeps slugs URL-safe" do
    expect(build(:area, slug: "Bantayan Island")).not_to be_valid
  end

  it "only allows known kinds" do
    expect(build(:area, kind: "country")).not_to be_valid
  end

  describe ".browsable" do
    it "is the areas with an active listing and every area above them" do
      region = create(:area, kind: "region")
      province = create(:area, kind: "province", parent: region)
      city = create(:area, kind: "city", parent: province)
      create(:area, kind: "town", parent: province)
      create(:listing, area: city)

      expect(described_class.browsable).to contain_exactly(region, province, city)
    end

    it "leaves out draft areas, and the areas above only them" do
      province = create(:area, kind: "province", status: "draft")
      town = create(:area, kind: "town", parent: province)
      draft_town = create(:area, :draft, kind: "town", parent: create(:area, kind: "province"))
      create(:listing, area: town)
      create(:listing, area: draft_town)

      expect(described_class.browsable).to contain_exactly(town)
    end

    it "ignores listings that are not active" do
      create(:listing, :pending)

      expect(described_class.browsable).to be_empty
    end
  end

  describe "#publish!" do
    it "publishes the area and every area above it" do
      region = create(:area, :draft, kind: "region")
      province = create(:area, :draft, kind: "province", parent: region)
      town = create(:area, :draft, kind: "town", parent: province)
      other = create(:area, :draft, kind: "town", parent: province)

      town.publish!

      expect([ region, province, town ].map { |area| area.reload.status }).to all(eq("published"))
      expect(other.reload).to be_draft
    end
  end
end
