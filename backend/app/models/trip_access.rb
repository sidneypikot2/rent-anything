# A guest's trip link and PIN (RAA-175): one per guest, opening their whole cart, made at
# their first checkout. Both are stored only as digests, the link token like a RefreshToken,
# the PIN with BCrypt. Each open of the link asks for the PIN (Auth::UnlockTripLink);
# MAX_ATTEMPTS wrong ones in a row lock it until the guest resets it from an emailed code.
class TripAccess < ApplicationRecord
  MAX_ATTEMPTS = 5
  PIN_LENGTH = 6

  belongs_to :user

  has_secure_password :pin, validations: false

  # Makes the guest's link and PIN, or replaces them (which unlocks a locked link). Returns
  # the raw token and PIN, the only time they exist in plain text.
  def self.issue!(user)
    token = SecureRandom.urlsafe_base64(32)
    pin = SecureRandom.random_number(10**PIN_LENGTH).to_s.rjust(PIN_LENGTH, "0")
    access = find_or_initialize_by(user:)
    access.update!(token_digest: RefreshToken.digest(token), pin:, failed_attempts: 0, locked_at: nil,
      rotated_at: access.persisted? ? Time.current : nil)
    { token:, pin: }
  end

  def self.find_by_token(token)
    find_by(token_digest: RefreshToken.digest(token)) if token.is_a?(String)
  end

  def locked?
    locked_at.present?
  end
end
