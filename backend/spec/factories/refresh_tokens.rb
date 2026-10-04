FactoryBot.define do
  # The raw token is what a client holds; only its digest is stored. Pass `token:` to know it.
  factory :refresh_token do
    user
    transient do
      token { SecureRandom.urlsafe_base64(32) }
    end
    token_digest { RefreshToken.digest(token) }
    expires_at { RefreshToken::LIFETIME.from_now }
  end
end
