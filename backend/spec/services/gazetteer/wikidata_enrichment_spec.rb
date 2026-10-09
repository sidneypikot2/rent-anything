require "rails_helper"

RSpec.describe Gazetteer::WikidataEnrichment do
  let!(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province", psgc_code: "0702200000") }
  let!(:moalboal) do
    create(:area, slug: "moalboal", name: "Moalboal", parent: cebu, psgc_code: "0702237000", aliases: [ "Panagsama" ])
  end
  let!(:kawasan) do
    create(:landmark, slug: "kawasan-falls", name: "Kawasan Falls", area: moalboal, location: "POINT(123.38 9.80)",
      aliases: [ "Kawasan" ])
  end

  let(:entities) do
    {
      "Q1" => { terms: [ "Cebu", "Sugbo", "Lalawigan ng Cebu" ], sitelinks: 90, enwiki: "Cebu" },
      "Q2" => { terms: [ "Moalboal", "moalboal", "Munisipyo sa Moalboal", "Moalboal, Sugbo", "Moalboal (lungsod)",
                         "PANAGSAMA", "6032" ], sitelinks: 20, enwiki: "Moalboal" },
      "Q3" => { terms: [ "Kawasan Falls", "Busay sa Kawasan", "Kawasan" ], sitelinks: 4, enwiki: nil }
    }
  end

  before do
    allow(Wikidata).to receive(:find_by_psgc).and_return([])
    allow(Wikidata).to receive(:find_by_psgc).with("072200000").and_return([ "Q1" ])
    allow(Wikidata).to receive(:find_by_psgc).with("072237000").and_return([ "Q2" ])
    allow(Wikidata).to receive(:find_near).and_return([])
    allow(Wikidata).to receive(:find_near).with(hash_including(name: "Kawasan Falls", radius_km: 2)).and_return([ "Q3" ])
    allow(Wikidata).to receive(:entities) { |ids| entities.slice(*ids) }
    allow(Wikidata).to receive(:monthly_pageviews).with("Cebu").and_return(4095)
    allow(Wikidata).to receive(:monthly_pageviews).with("Moalboal").and_return(511)
  end

  it "matches areas by their old 9-digit PSGC code and landmarks by name nearby, and stores the item" do
    summary = described_class.call

    expect([ cebu, moalboal, kawasan ].map { |record| record.reload.wikidata_id }).to eq(%w[Q1 Q2 Q3])
    expect(Wikidata).to have_received(:find_near)
      .with(name: "Kawasan Falls", lat: be_within(0.001).of(9.80), lng: be_within(0.001).of(123.38), radius_km: 2)
    expect(summary).to include(resolved: 3, enriched: 3, skipped: [])
  end

  it "stores Wikidata's terms beside the curated aliases, without repeats of the name, an alias or a bot-made label" do
    described_class.call

    expect(moalboal.reload).to have_attributes(aliases: [ "Panagsama" ], wikidata_aliases: [ "Munisipyo sa Moalboal" ])
    expect(kawasan.reload).to have_attributes(aliases: [ "Kawasan" ], wikidata_aliases: [ "Busay sa Kawasan" ])
  end

  it "scores sitelinks plus log2 of the average monthly English Wikipedia pageviews" do
    described_class.call

    expect(cebu.reload.wikidata_popularity).to eq(90 + 12)
    expect(moalboal.reload.wikidata_popularity).to eq(20 + 9)
    expect(kawasan.reload.wikidata_popularity).to eq(4)
  end

  it "replaces only Wikidata's terms on a re-run, and keeps an item already set by hand" do
    moalboal.update_columns(wikidata_id: "Q9", wikidata_aliases: [ "Old Wikidata Name" ])
    entities["Q9"] = { terms: [ "Moalboal", "Bayan ng Moalboal" ], sitelinks: 21, enwiki: nil }
    moalboal.update!(aliases: [ "Panagsama", "Moal" ])

    described_class.call

    expect(moalboal.reload).to have_attributes(wikidata_id: "Q9", aliases: [ "Panagsama", "Moal" ],
      wikidata_aliases: [ "Bayan ng Moalboal" ], wikidata_popularity: 21)
    expect(Wikidata).not_to have_received(:find_by_psgc).with("072237000")
  end

  it "skips drafts" do
    badian = create(:area, :draft, slug: "badian", name: "Badian", psgc_code: "0702208000")
    draft_landmark = create(:landmark, :draft, area: moalboal, name: "Pescador Island")

    described_class.call

    expect(badian.reload.wikidata_id).to be_nil
    expect(draft_landmark.reload.wikidata_id).to be_nil
    expect(Wikidata).not_to have_received(:find_by_psgc).with("072208000")
  end

  it "falls back to the name near an area's center, and reports a place with no single match" do
    island = create(:area, slug: "bantayan-island", name: "Bantayan Island", kind: "island", parent: cebu)
    allow(Wikidata).to receive(:find_near).with(hash_including(name: "Bantayan Island", radius_km: 10)).and_return(%w[Q7 Q8])

    summary = described_class.call

    expect(island.reload.wikidata_id).to be_nil
    expect(summary[:skipped]).to contain_exactly("Area bantayan-island: 2 Wikidata items match")
  end

  it "reports an item another place already has instead of storing it twice" do
    create(:landmark, slug: "moalboal-town", name: "Moalboal Town", area: moalboal, wikidata_id: "Q2")

    summary = described_class.call

    expect(moalboal.reload.wikidata_id).to be_nil
    expect(summary[:skipped]).to include("Area moalboal: Q2 is already Landmark moalboal-town")
  end

  it "reports a place Wikidata failed on and carries on with the rest" do
    allow(Wikidata).to receive(:find_by_psgc).with("072237000").and_raise(Wikidata::Error, "Wikidata answered 503")

    summary = described_class.call

    expect(summary[:skipped]).to eq([ "Area moalboal: Wikidata answered 503" ])
    expect(cebu.reload.wikidata_id).to eq("Q1")
  end
end
