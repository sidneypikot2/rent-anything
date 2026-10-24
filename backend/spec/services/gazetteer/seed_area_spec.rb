require "rails_helper"

RSpec.describe Gazetteer::SeedArea do
  # A square island around Santa Fe; Hilantagaan sits about 3 km off it, inside the margin.
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

  it "adds the Wikidata landmarks on or just off the island as drafts, skipping the area itself and names it has" do
    described_class.call(bantayan)

    added = bantayan.landmarks.where.not(id: kota.id).order(:slug)
    expect(added.map { [ _1.slug, _1.name, _1.status, _1.wikidata_id ] }).to eq([
      [ "bantayan-church", "Bantayan Church", "draft", "Q56063677" ],
      [ "bantayan-lighthouse", "Bantayan Lighthouse", "draft", "Q47482456" ],
      [ "hilantagaan-island", "Hilantagaan Island", "draft", "Q6192651" ]
    ])
    expect(Wikidata).to have_received(:landmarks_near)
      .with(lat: be_within(0.001).of(11.2), lng: be_within(0.001).of(123.75), radius_km: be_between(10, 40))
  end

  it "takes a name with or without Island or Islet as one the area already has" do
    create(:landmark, slug: "virgin-island", name: "Virgin Island", area: bantayan, location: "POINT(123.847 11.15)",
      aliases: [ "Silion Island" ])
    near << { id: "Q7515087", name: "Silion", lng: 123.847, lat: 11.15, sitelinks: 2 }
    near << { id: "Q95", name: "Virgin Islet", lng: 123.847, lat: 11.15, sitelinks: 1 }

    described_class.call(bantayan)

    expect(Landmark.where(wikidata_id: %w[Q7515087 Q95])).to be_empty
  end

  it "takes what a town under the island covers, however far off: its outlying islands" do
    create(:area, :draft, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan,
      center: "POINT(123.8 11.17)",
      boundary: "MULTIPOLYGON(((123.78 11.15, 123.82 11.15, 123.82 11.19, 123.78 11.19, 123.78 11.15)), " \
        "((123.95 11.35, 124.0 11.35, 124.0 11.4, 123.95 11.4, 123.95 11.35)))")
    near << { id: "Q5616615", name: "Guintacan", lng: 123.97, lat: 11.37, sitelinks: 3 }

    described_class.call(bantayan)

    expect(Landmark.find_by(wikidata_id: "Q5616615")).to have_attributes(area: bantayan, status: "draft")
    expect(Wikidata).to have_received(:landmarks_near).with(hash_including(radius_km: be > 30))
  end

  it "leaves out what is further off an island than the margin" do
    near << { id: "Q91", name: "Far Islet", lng: 123.93, lat: 11.2, sitelinks: 1 }

    described_class.call(bantayan)

    expect(Landmark.exists?(wikidata_id: "Q91")).to be(false)
  end

  it "leaves out what is within the margin but inside another area" do
    create(:area, slug: "hagnaya", name: "Hagnaya", kind: "town", parent: cebu, center: "POINT(123.88 11.13)",
      boundary: "MULTIPOLYGON(((123.86 11.12, 123.9 11.12, 123.9 11.14, 123.86 11.14, 123.86 11.12)))")
    near << { id: "Q92", name: "Hagnaya Port", lng: 123.87, lat: 11.13, sitelinks: 1 }

    described_class.call(bantayan)

    expect(Landmark.exists?(wikidata_id: "Q92")).to be(false)
  end

  it "gives a town no margin: its neighbours' outlines touch it" do
    santa_fe = create(:area, :draft, slug: "santa-fe", name: "Santa Fe", kind: "town", parent: bantayan,
      center: "POINT(123.8 11.17)",
      boundary: "MULTIPOLYGON(((123.78 11.15, 123.82 11.15, 123.82 11.19, 123.78 11.19, 123.78 11.15)))")
    near.replace([ { id: "Q93", name: "Inside", lng: 123.8, lat: 11.17, sitelinks: 1 },
      { id: "Q94", name: "Just Outside", lng: 123.825, lat: 11.17, sitelinks: 1 } ])

    described_class.call(santa_fe)

    expect(santa_fe.landmarks.pluck(:wikidata_id)).to eq([ "Q93" ])
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
    expect(bantayan.seed_report).to include("landmarks_added" => 3, "enriched" => 4)
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
