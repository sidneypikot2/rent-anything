require "rails_helper"

RSpec.describe Verifications::Current do
  let(:partner) { create(:user, :partner) }

  def in_env(name)
    allow(Rails).to receive(:env).and_return(ActiveSupport::EnvironmentInquirer.new(name))
  end

  around do |example|
    previous = ENV["SKIP_ID_CHECK"]
    ENV["SKIP_ID_CHECK"] = "true"
    example.run
  ensure
    ENV["SKIP_ID_CHECK"] = previous
  end

  context "with SKIP_ID_CHECK in development" do
    before { in_env("development") }

    it "approves a partner who never started a check" do
      expect(described_class.call(partner)).to have_attributes(status: "approved", verified_at: be_present)
      expect(partner.reload).to be_id_verified
    end

    it "approves a declined check without asking Didit" do
      create(:partner_verification, user: partner, status: "declined", declined_count: 1)
      expect(Verifications::Sync).not_to receive(:call)

      expect(described_class.call(partner)).to have_attributes(status: "approved")
    end
  end

  %w[test production].each do |env|
    it "ignores SKIP_ID_CHECK in #{env}" do
      in_env(env)

      expect(described_class.call(partner)).to be_nil
      expect(partner.reload).not_to be_id_verified
    end
  end

  it "ignores SKIP_ID_CHECK unless it is exactly true" do
    in_env("development")
    ENV["SKIP_ID_CHECK"] = "1"

    expect(described_class.call(partner)).to be_nil
  end
end
