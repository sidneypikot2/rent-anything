require "rails_helper"

RSpec.describe Verifications::Sync do
  let(:verification) { create(:partner_verification, status: "in_progress") }

  def sync_with(didit_status)
    allow(Didit).to receive(:decision).with(verification.didit_session_id).and_return("status" => didit_status)
    described_class.call(verification)
  end

  {
    "Not Started" => "not_started", "In Progress" => "in_progress", "Resubmitted" => "in_progress",
    "Awaiting User" => "in_progress", "In Review" => "in_review", "Approved" => "approved",
    "Declined" => "declined", "Expired" => "expired", "Abandoned" => "expired", "Kyc Expired" => "expired",
    "IN_REVIEW" => "in_review"
  }.each do |didit_status, status|
    it "maps Didit's #{didit_status.inspect} to #{status}" do
      expect(sync_with(didit_status).status).to eq(status)
    end
  end

  it "keeps the status when Didit sends one we don't know" do
    expect(sync_with("Something New").status).to eq("in_progress")
  end

  it "stamps verified_at on approval" do
    expect(sync_with("Approved").verified_at).to be_within(1.minute).of(Time.current)
  end

  it "never moves an approved partner back" do
    verification.update!(status: "approved", verified_at: 1.day.ago)

    expect(sync_with("Kyc Expired").status).to eq("approved")
  end

  it "counts each decline once" do
    sync_with("Declined")
    sync_with("Declined")

    expect(verification.reload.declined_count).to eq(1)
  end

  it "doesn't take a finished check back to pending on a stale read, so a decline counts once" do
    verification.update!(status: "declined", declined_count: 1, last_declined_at: 1.minute.ago)

    expect(sync_with("In Progress").status).to eq("declined")
    expect(sync_with("Declined").declined_count).to eq(1)
  end

  it "ignores the answer when the partner has moved on to a new session meanwhile" do
    allow(Didit).to receive(:decision) do
      PartnerVerification.where(id: verification.id).update_all(didit_session_id: "newer", status: "not_started")
      { "status" => "Declined" }
    end

    expect(described_class.call(verification)).to have_attributes(status: "not_started", declined_count: 0)
  end
end
