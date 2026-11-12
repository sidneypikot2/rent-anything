require "rails_helper"

RSpec.describe Auth::SignIn do
  let!(:user) { create(:user, email: "ana@example.com", password: "password123") }

  def sign_in(email, password = "password123")
    described_class.call(email:, password:, role: "guest")
  end

  it "signs in with the right password" do
    expect(sign_in("ana@example.com")).to include(:access_token, :refresh_token)
  end

  # RAA-220: every failure runs bcrypt, so its timing doesn't tell which emails have accounts.
  describe "a failed sign-in" do
    before { allow(BCrypt::Engine).to receive(:hash_secret).and_call_original }

    it "runs bcrypt for an unknown email" do
      expect { sign_in("nobody@example.com") }.to raise_error(NotAuthenticatedError, "Wrong email or password")
      expect(BCrypt::Engine).to have_received(:hash_secret).with("password123", described_class::DUMMY_DIGEST.salt)
    end

    it "runs bcrypt for an account with no password" do
      create(:user, :oauth_only, email: "oauth@example.com")

      expect { sign_in("oauth@example.com") }.to raise_error(NotAuthenticatedError, "Wrong email or password")
      expect(BCrypt::Engine).to have_received(:hash_secret).once
    end

    it "runs bcrypt for a wrong password, with the same error" do
      expect { sign_in("ana@example.com", "wrong-password") }
        .to raise_error(NotAuthenticatedError, "Wrong email or password")
      expect(BCrypt::Engine).to have_received(:hash_secret).once
    end
  end

  it "makes the dummy digest at the cost real passwords use" do
    expect(described_class::DUMMY_DIGEST.cost).to eq(BCrypt::Password.new(user.password_digest).cost)
  end
end
