require "rails_helper"

RSpec.describe Gazetteer::SeedArea do
  # A square island around Santa Fe; Hilantagaan sits just off it, outside the boundary.
  let!(:cebu) { create(:area, :draft, slug: "cebu", name: "Cebu", kind: "province", center: "POINT(123.8 10.3)") }
  let!(:bantayan) do
    create(:area, :draft, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu,
      center: "POINT(123.75 11.2)",
      boundary: "MULTIPOLYGON(((123.65 11.1, 123.85 11.1, 123.85 11.3, 123.65 11.3, 123.65 11.1)))")
  end
  let!(:kota) do
    create(:landmark, slug: "kota-beach", name: "Kota Beach", area: bantayan, location: "POINT(123.799 11.173)",
      aliases: [ "Santa Fe beach" ])
  end

  let(:near) do
    [
      { id: "Q806973", name: "Bantayan", lng: 123.75, lat: 11.2, sitelinks: 19 },
      { id: "Q56063677", name: "Bantayan Church", lng: 123.72, lat: 11.17, sitelinks: 2 },
      { id: "Q90", name: "Santa Fe Beach", lng: 123.8, lat: 11.17, sitelinks: 2 },
      { id: "Q6192651", name: "Hilantagaan Island", lng: 123.877, lat: 11.206, sitelinks: 4 },
      { id: "Q47482456", name: "Bantayan Lighthouse", lng: 123.7, lat: 11.27, sitelinks: 0 }
    ]
  end

  before do
    allow(Wikidata).to receive(:find_by_psgc).and_return([])
    allow(Wikidata).to receive(:find_near).and_return([])
    allow(Wikidata).to receive(:find_near).with(hash_including(name: "Bantayan Island")).and_return([ "Q806973" ])
    allow(Wikidata).to receive(:landmarks_near).and_return(near)
    allow(Wikidata).to receive(:entities) do |ids|
      ids.index_with { |id| { terms: [ "#{id} term" ], sitelinks: 1, enwiki: nil } }
    end
    allow(Wikidata).to receive(:monthly_pageviews).and_return(0)
  end

  it "publishes the area and every area above it" do
    described_class.call(bantayan)

    expect([ cebu, bantayan ].map { _1.reload.status }).to eq(%w[published published])
  end

  it "adds the Wikidata landmarks inside the boundary as drafts, skipping the area itself and names it already has" do
    described_class.call(bantayan)

    added = bantayan.landmarks.where.not(id: kota.id).order(:slug)
    expect(added.map { [ _1.slug, _1.name, _1.status, _1.wikidata_id ] }).to eq([
      [ "bantayan-church", "Bantayan Church", "draft", "Q56063677" ],
      [ "bantayan-lighthouse", "Bantayan Lighthouse", "draft", "Q47482456" ]
    ])
    expect(Wikidata).to have_received(:landmarks_near)
      .with(lat: be_within(0.001).of(11.2), lng: be_within(0.001).of(123.75), radius_km: be_between(10, 40))
  end

  it "gives a new landmark a slug no other landmark has" do
    create(:landmark, slug: "bantayan-church", name: "Bantayan Church", area: create(:area, slug: "elsewhere"),
      location: "POINT(120 15)")

    described_class.call(bantayan)

    expect(Landmark.find_by(wikidata_id: "Q56063677").slug).to eq("bantayan-church-bantayan-island")
  end

  it "enriches the area, the areas above it and all its landmarks, drafts too" do
    described_class.call(bantayan)

    expect(bantayan.reload).to have_attributes(wikidata_id: "Q806973", wikidata_aliases: [ "Q806973 term" ])
    expect(Landmark.find_by(wikidata_id: "Q47482456").wikidata_aliases).to eq([ "Q47482456 term" ])
  end

  it "records the run on the area" do
    described_class.call(bantayan)

    expect(bantayan.reload).to have_attributes(seed_status: "done", seeded_at: be_within(1.minute).of(Time.current))
    expect(bantayan.seed_report).to include("landmarks_added" => 2, "enriched" => 3)
    expect(bantayan.seed_report["skipped"]).to include("Landmark kota-beach: no Wikidata item matches")
  end

  it "doesn't add a landmark another place already holds, on a second run either" do
    described_class.call(bantayan)
    expect { described_class.call(bantayan) }.not_to change(Landmark, :count)
  end

  it "marks the run failed with Wikidata's error and keeps what it published" do
    allow(Wikidata).to receive(:landmarks_near).and_raise(Wikidata::Error, "query.wikidata.org answered 500")

    described_class.call(bantayan)

    expect(bantayan.reload).to have_attributes(status: "published", seed_status: "failed")
    expect(bantayan.seed_report).to eq("error" => "query.wikidata.org answered 500")
  end
end
