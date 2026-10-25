# A one-time code emailed to a guest (RAA-175): to recover a lost trip link, a forgotten PIN
# or a locked link, and to prove an email another guest already has at checkout. It lasts
# LIFETIME and allows MAX_ATTEMPTS tries; a new one replaces any the guest had. Stored as an
# HMAC keyed with the app's secret, so a leaked table doesn't give away live codes.
class SignInCode < ApplicationRecord
  LIFETIME = 10.minutes
  MAX_ATTEMPTS = 5
  LENGTH = 6

  belongs_to :user

  scope :usable, -> { where(consumed_at: nil, expires_at: Time.current..).where(attempts: ...MAX_ATTEMPTS) }

  # Returns the raw code.
  def self.issue!(user)
    code = SecureRandom.random_number(10**LENGTH).to_s.rjust(LENGTH, "0")
    transaction do
      user.sign_in_codes.where(consumed_at: nil).update_all(consumed_at: Time.current)
      user.sign_in_codes.create!(code_digest: digest(user, code), expires_at: LIFETIME.from_now)
    end
    code
  end

  def self.digest(user, code)
    OpenSSL::HMAC.hexdigest("SHA256", Rails.application.secret_key_base, "#{user.id}:#{code}")
  end

  def matches?(code)
    code.is_a?(String) && ActiveSupport::SecurityUtils.secure_compare(code_digest, SignInCode.digest(user, code))
  end
end
