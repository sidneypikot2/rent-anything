# A long-lived token that renews a user's 15-minute access token. The client holds the raw
# token; only its SHA-256 digest is stored, so a database leak doesn't hand out sessions.
# Each use rotates it (Auth::Refresh).
class RefreshToken < ApplicationRecord
  LIFETIME = 30.days

  belongs_to :user

  scope :active, -> { where(revoked_at: nil).where(expires_at: Time.current..) }

  def self.digest(token)
    Digest::SHA256.hexdigest(token)
  end

  def self.find_by_token(token)
    find_by(token_digest: digest(token)) if token.is_a?(String)
  end

  # Creates a token for the user and returns the raw value, the only time it exists.
  def self.issue!(user)
    token = SecureRandom.urlsafe_base64(32)
    user.refresh_tokens.create!(token_digest: digest(token), expires_at: LIFETIME.from_now)
    token
  end

  def active?
    revoked_at.nil? && expires_at.future?
  end

  def revoke!
    update!(revoked_at: Time.current) if revoked_at.nil?
  end
end
