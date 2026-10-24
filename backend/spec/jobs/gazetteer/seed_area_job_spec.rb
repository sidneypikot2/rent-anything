require "rails_helper"

RSpec.describe Gazetteer::SeedAreaJob do
  let(:area) { create(:area, seed_status: "queued") }

  it "seeds the area" do
    allow(Gazetteer::SeedArea).to receive(:call)

    described_class.perform_now(area)

    expect(Gazetteer::SeedArea).to have_received(:call).with(area)
  end

  it "marks the run failed on an unexpected error, so the console doesn't show it running forever" do
    allow(Gazetteer::SeedArea).to receive(:call).and_raise(NoMethodError)

    expect { described_class.perform_now(area) }.to raise_error(NoMethodError)
    expect(area.reload).to have_attributes(seed_status: "failed", seed_report: { "error" => "NoMethodError" })
  end
end
