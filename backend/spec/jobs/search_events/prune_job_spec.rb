require "rails_helper"

RSpec.describe SearchEvents::PruneJob do
  it "deletes search events older than 90 days and keeps the rest" do
    old = create(:search_event, created_at: 91.days.ago)
    recent = create(:search_event, created_at: 89.days.ago)

    described_class.perform_now

    expect(SearchEvent.all).to contain_exactly(recent)
    expect(SearchEvent.exists?(old.id)).to be(false)
  end
end
