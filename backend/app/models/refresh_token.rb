# Long-lived token a client trades for a new access token. Only its SHA-256 digest is
# stored; each use revokes it and issues a new one (rotation).
class RefreshToken < ApplicationRecord
  LIFETIME = 30.days

  belongs_to :user

  scope :active, -> { where(revoked_at: nil).where(expires_at: Time.current..) }

  def self.digest(token)
    OpenSSL::Digest::SHA256.hexdigest(token)
  end

  # Returns the raw token; it is never stored.
  def self.issue(user)
    token = SecureRandom.urlsafe_base64(32)
    create!(user: user, token_digest: digest(token), expires_at: LIFETIME.from_now)
    token
  end

  def self.find_by_token(token)
    find_by(token_digest: digest(token)) if token.is_a?(String)
  end

  def active?
    revoked_at.nil? && expires_at.future?
  end

  def revoke!
    update!(revoked_at: Time.current) if revoked_at.nil?
  end
end
