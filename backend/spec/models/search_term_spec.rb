require "rails_helper"

RSpec.describe SearchTerm do
  include ActiveJob::TestHelper

  let(:cebu) { create(:area, slug: "cebu", name: "Cebu", kind: "province") }
  let(:moalboal) { create(:area, slug: "moalboal", name: "Moalboal", parent: cebu, aliases: [ "Panagsama", "panagsama" ]) }

  def terms_for(record)
    described_class.where(target_type: record.class.name, target_id: record.id).order(:kind, :term_normalized)
  end

  it "holds one row per name and per alias, normalized, with case-only duplicates collapsed" do
    moalboal
    described_class.refresh

    expect(terms_for(moalboal).pluck(:kind, :term_normalized, :weight)).to eq([
      [ "alias", "panagsama", 1 ], [ "name", "moalboal", 2 ]
    ])
  end

  it "ignores accents and case in the normalized term" do
    landmark = create(:landmark, area: moalboal, name: "Basilica del Santo Niño")
    described_class.refresh

    expect(terms_for(landmark).pluck(:term_normalized)).to eq([ "basilica del santo nino" ])
  end

  it "leaves out draft areas and draft landmarks" do
    draft_area = create(:area, :draft, name: "Badian")
    draft_landmark = create(:landmark, :draft, area: moalboal, name: "Kawasan Falls")
    described_class.refresh

    expect(terms_for(draft_area)).to be_empty
    expect(terms_for(draft_landmark)).to be_empty
  end

  it "counts listings and landmarks under an area, and picks in the last 90 days, as popularity" do
    create_list(:listing, 2, area: moalboal)
    create(:listing, :pending, area: moalboal)
    create(:landmark, area: moalboal)
    create(:search_event, target: moalboal)
    create(:search_event, target: moalboal, created_at: 91.days.ago)
    described_class.refresh

    expect(terms_for(moalboal).pick(:popularity)).to eq(2 + 1 + 1)
    expect(terms_for(cebu).pick(:popularity)).to eq(2 + 1)
  end

  it "refreshes concurrently once populated" do
    moalboal
    described_class.refresh
    moalboal.update_columns(name: "Moalboal Town")

    expect { described_class.refresh(concurrently: true) }
      .to change { terms_for(moalboal).where(kind: "name").pick(:term) }.from("Moalboal").to("Moalboal Town")
  end

  describe "refresh after a change" do
    it "is queued when a name, alias or status changes" do
      area = moalboal
      clear_enqueued_jobs

      expect { area.update!(aliases: [ "Panagsama Beach" ]) }.to have_enqueued_job(SearchTerms::RefreshJob)
      expect { create(:tag, name: "Canyoneering") }.to have_enqueued_job(SearchTerms::RefreshJob)
      expect { create(:landmark, area:).update!(status: "draft") }.to have_enqueued_job(SearchTerms::RefreshJob).twice
    end

    it "is not queued for other changes" do
      area = moalboal
      clear_enqueued_jobs

      expect { area.update!(center: "POINT(123.4 9.9)") }.not_to have_enqueued_job(SearchTerms::RefreshJob)
    end
  end
end
