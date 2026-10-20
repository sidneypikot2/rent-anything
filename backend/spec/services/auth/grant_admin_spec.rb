require "rails_helper"

RSpec.describe Auth::GrantAdmin do
  it "makes an admin of a guest's email, with the guest's name and password, leaving the guest as it is" do
    guest = create(:user, email: "ana@example.com", name: "Ana Reyes", password: "guest-password")

    admin = described_class.call(email: " Ana@Example.com ")

    expect(admin).to have_attributes(role: "admin", email: "ana@example.com", name: "Ana Reyes")
    expect(admin.authenticate("guest-password")).to be_truthy
    expect(guest.reload.role).to eq("guest")
  end

  it "makes an admin with the password given, when no account has the email" do
    admin = described_class.call(email: "new@example.com", password: "a-long-password")

    expect(admin).to have_attributes(role: "admin", name: "new@example.com")
    expect(admin.authenticate("a-long-password")).to be_truthy
  end

  it "returns the admin there is, setting a new password when one is given" do
    existing = create(:user, :admin, email: "ana@example.com", password: "old-password")

    expect(described_class.call(email: "ana@example.com")).to eq(existing)
    described_class.call(email: "ana@example.com", password: "new-password")
    expect(existing.reload.authenticate("new-password")).to be_truthy
  end

  it "refuses an email with no account and no password, and a short password" do
    expect { described_class.call(email: "nobody@example.com") }
      .to raise_error(ActiveRecord::RecordInvalid, /PASSWORD is needed/)
    expect { described_class.call(email: "nobody@example.com", password: "short") }
      .to raise_error(ActiveRecord::RecordInvalid, /too short/)
    expect(User.where(role: "admin")).to be_empty
  end
end
