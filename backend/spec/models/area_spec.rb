require "rails_helper"

RSpec.describe Area do
  it "refuses a slug that is a top-level web path" do
    area = build(:area, slug: "partner")

    expect(area).not_to be_valid
    expect(area.errors[:slug]).to include("is reserved")
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

    it "ignores listings that are not active" do
      create(:listing, :pending)

      expect(described_class.browsable).to be_empty
    end
  end
end
