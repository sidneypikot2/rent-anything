require "rails_helper"

# The refresh token as an HttpOnly cookie (RAA-306, RefreshCookie): opt-in with X-Refresh-Cookie.
RSpec.describe "Refresh token cookie", type: :request do
  let(:origin) { Rails.configuration.x.frontend_origins.first }
  let(:cookie_headers) { { "X-Refresh-Cookie" => "1", "Origin" => origin } }
  let(:user) { create(:user, password: "secret-password") }

  def set_cookie_header
    Array(response.headers["Set-Cookie"]).join("\n")
  end

  def sign_in(headers: cookie_headers)
    post "/api/v1/session", params: { email: user.email, password: "secret-password", role: user.role },
      headers:, as: :json
  end

  describe "issuing" do
    it "sets the cookie and leaves the refresh token out of the body" do
      sign_in

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).not_to have_key("refresh_token")
      expect(response.parsed_body["access_token"]).to be_present
      expect(set_cookie_header).to match(/raa_refresh=[^;]+; path=\/api\/v1; expires=[^;]+; httponly; samesite=strict/i)
      expect(RefreshToken.find_by_token(cookies[:raa_refresh])).to be_active
    end

    it "gives the cookie the refresh token's expiry" do
      sign_in

      expires = set_cookie_header[/expires=([^;]+)/i, 1]
      expect(Time.httpdate(expires)).to be_within(5.seconds).of(RefreshToken.last.expires_at)
    end

    it "works for a guest session too" do
      post "/api/v1/guest_sessions", headers: cookie_headers, as: :json

      expect(response).to have_http_status(:created)
      expect(response.parsed_body).not_to have_key("refresh_token")
      expect(cookies[:raa_refresh]).to be_present
    end

    it "leaves the body token alone without the header" do
      sign_in(headers: {})

      expect(response.parsed_body["refresh_token"]).to be_present
      expect(response.headers["Set-Cookie"]).to be_blank
    end

    it "refuses another origin" do
      sign_in(headers: cookie_headers.merge("Origin" => "https://evil.example"))

      expect(response).to have_http_status(:forbidden)
      expect(response.headers["Set-Cookie"]).to be_blank
    end
  end

  describe "refreshing" do
    it "rotates the cookie's token into a new cookie" do
      sign_in
      old_token = cookies[:raa_refresh]

      post "/api/v1/tokens/refresh", headers: cookie_headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).not_to have_key("refresh_token")
      expect(cookies[:raa_refresh]).to be_present.and(satisfy { _1 != old_token })
      expect(RefreshToken.find_by_token(old_token)).not_to be_active
    end

    it "moves a body token (a session from before the cookie) into the cookie" do
      body_token = Auth::IssueTokens.call(user)[:refresh_token]

      post "/api/v1/tokens/refresh", params: { refresh_token: body_token }, headers: cookie_headers, as: :json

      expect(response).to have_http_status(:ok)
      expect(response.parsed_body).not_to have_key("refresh_token")
      expect(RefreshToken.find_by_token(cookies[:raa_refresh])).to be_active
    end

    it "is a 422 with neither cookie nor body token" do
      post "/api/v1/tokens/refresh", headers: cookie_headers, as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end

    it "refuses another origin" do
      sign_in

      post "/api/v1/tokens/refresh", headers: cookie_headers.merge("Origin" => "https://evil.example"), as: :json

      expect(response).to have_http_status(:forbidden)
    end

    it "ignores the cookie without the header" do
      sign_in

      post "/api/v1/tokens/refresh", as: :json

      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  describe "signing out" do
    it "revokes the cookie's token and deletes the cookie" do
      sign_in
      token = cookies[:raa_refresh]

      delete "/api/v1/session", headers: cookie_headers, as: :json

      expect(response).to have_http_status(:no_content)
      expect(RefreshToken.find_by_token(token)).not_to be_active
      expect(set_cookie_header).to match(/raa_refresh=; path=\/api\/v1; max-age=0/i)
    end

    it "keeps the cookie when a body-token session (a trip link's tab) signs out" do
      sign_in
      token = cookies[:raa_refresh]
      tab_token = Auth::IssueTokens.call(user)[:refresh_token]

      delete "/api/v1/session", params: { refresh_token: tab_token }, as: :json

      expect(response).to have_http_status(:no_content)
      expect(RefreshToken.find_by_token(tab_token)).not_to be_active
      expect(RefreshToken.find_by_token(token)).to be_active
      expect(response.headers["Set-Cookie"]).to be_blank
    end
  end

  describe "deleting the account" do
    it "deletes the cookie" do
      guest = create(:user, role: "guest")
      post "/api/v1/guest_sessions", headers: cookie_headers, as: :json
      access_token = Auth::IssueTokens.call(guest)[:access_token]

      delete "/api/v1/me", headers: cookie_headers.merge("Authorization" => "Bearer #{access_token}"), as: :json

      expect(response).to have_http_status(:no_content)
      expect(set_cookie_header).to match(/raa_refresh=; path=\/api\/v1; max-age=0/i)
    end
  end
end
