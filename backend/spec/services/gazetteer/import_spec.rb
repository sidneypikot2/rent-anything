require "rails_helper"

RSpec.describe Gazetteer::Import do
  let(:fixtures) { Rails.root.join("spec/fixtures/gazetteer") }

  # The hand-made areas a database has before its first import.
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.85 10.45)") }
  let!(:cebu_city) do
    create(:area, slug: "cebu-city", name: "Cebu City", kind: "city", parent: cebu, center: "POINT(123.8854 10.3157)",
      aliases: [ "Queen City of the South" ])
  end
  let!(:bantayan) { create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu) }
  let!(:santa_fe) { create(:area, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan, center: "POINT(123.80 11.16)") }

  def import
    described_class.call(areas: fixtures.join("areas.geojson"), landmasses: fixtures.join("landmasses.geojson"),
      curated: fixtures.join("curated.yml"))
  end

  def area(slug) = Area.find_by!(slug:)

  def covers?(area, lng, lat)
    Area.where(id: area.id).where("ST_Covers(boundary, ST_GeogFromText(?))", "SRID=4326;POINT(#{lng} #{lat})").exists?
  end

  it "adds every place as a draft under its parent, with its code, boundary and a center inside it" do
    import

    talisay = area("talisay-city")
    expect(talisay).to have_attributes(name: "Talisay City", kind: "city", status: "draft", psgc_code: "0702250000",
      parent: cebu, aliases: [ "City of Talisay" ])
    expect(covers?(talisay, 123.82, 10.22)).to be(true)
    expect(covers?(talisay, talisay.center.x, talisay.center.y)).to be(true)
    expect(area("central-visayas")).to have_attributes(kind: "region", name: "Central Visayas", status: "draft")
    expect(cebu.reload.parent).to eq(area("central-visayas"))
  end

  it "keeps a hand-made area's slug, name, center, aliases and status, and gives it its code and boundary" do
    import

    expect(cebu_city.reload).to have_attributes(slug: "cebu-city", name: "Cebu City", status: "published",
      psgc_code: "0730600000", aliases: [ "Queen City of the South" ], parent: cebu)
    expect([ cebu_city.center.x, cebu_city.center.y ]).to eq([ 123.8854, 10.3157 ])
    expect(covers?(cebu_city, 123.85, 10.30)).to be(true)
  end

  it "gives a name already taken the province's name too" do
    import

    expect(area("santa-fe-nueva-vizcaya")).to have_attributes(name: "Santa Fe", psgc_code: "0205012000")
  end

  it "builds an island from its landmass and moves the towns on it under it" do
    import

    expect(covers?(bantayan.reload, 123.71, 11.29)).to be(true)
    expect(covers?(bantayan, 123.90, 11.20)).to be(false)
    expect(bantayan).to have_attributes(parent: cebu, status: "published")
    expect([ santa_fe.reload.parent, area("bantayan").parent, area("madridejos").parent ]).to all(eq(bantayan))
  end

  it "puts an island that is part of one town under that town, as a draft" do
    import

    malapascua = area("malapascua")
    expect(malapascua).to have_attributes(kind: "island", status: "draft", parent: area("daanbantayan"),
      aliases: [ "Malapascua Island" ])
    expect(covers?(malapascua, 124.12, 11.34)).to be(true)
    expect(area("daanbantayan").parent).to eq(cebu)
  end

  it "keeps a place without a boundary, centered on its parent" do
    import

    pilar = area("pilar")
    expect(pilar.boundary).to be_nil
    expect([ pilar.center.x, pilar.center.y ]).to eq([ cebu.center.x, cebu.center.y ])
  end

  it "updates in place when run again" do
    import
    Area.find_by!(psgc_code: "0702250000").update!(name: "Old name")

    expect { import }.not_to change(Area, :count)
    expect(Area.find_by!(psgc_code: "0702250000").name).to eq("Talisay City")
    expect(santa_fe.reload.parent).to eq(bantayan)
    expect(area("malapascua").parent).to eq(area("daanbantayan"))
  end

  it "reports what it did" do
    expect(import).to eq(created: 9, updated: 3, islands: 2)
  end
end
