require "rails_helper"

RSpec.describe Trips::CleanupJob do
  it "runs the trip cleanup" do
    allow(Trips::Cleanup).to receive(:call)

    described_class.perform_now

    expect(Trips::Cleanup).to have_received(:call)
  end
end
