# One table for every account. The role is fixed by where the account was made: a sign-up
# from / is a guest, one from /partner a partner; admins are never self-made. Email is unique
# per role, so one person can have a guest and a partner account with the same address.
#
# A guest can start with no email at all (RAA-175): POST /guest_sessions makes one so a trip
# has an owner, and they give name, email and phone at their first checkout. A guest with no
# password and no Google or Facebook sign-in is unregistered: they come back through their
# trip link and PIN, and Guests::Purge deletes their trips 60 days after each ends.
class User < ApplicationRecord
  ROLES = %w[guest partner admin].freeze
  SELF_SERVE_ROLES = %w[guest partner].freeze

  has_secure_password validations: false

  has_many :oauth_identities, dependent: :destroy
  has_many :refresh_tokens, dependent: :delete_all
  has_one :trip_access, dependent: :delete
  has_many :sign_in_codes, dependent: :delete_all
  has_one :partner_profile, dependent: :destroy
  has_one :guest_profile, dependent: :destroy
  has_one :partner_verification, dependent: :destroy
  has_many :listings, foreign_key: :partner_id, inverse_of: :partner, dependent: :restrict_with_error
  # The businesses a partner runs (RAA-100); each listing belongs to one of them.
  has_many :businesses, foreign_key: :partner_id, inverse_of: :partner, dependent: :restrict_with_error
  # Where their money goes (RAA-145); each business picks one.
  has_many :payout_accounts, foreign_key: :partner_id, inverse_of: :partner, dependent: :restrict_with_error
  has_many :trips, dependent: :destroy
  # A guest's checkouts, bookings and payments (RAA-132); kept, never deleted with the account. Only
  # Guests::Purge deletes a user who has them, and the foreign keys then nullify user_id.
  has_many :checkouts, dependent: :restrict_with_error
  has_many :bookings, dependent: :restrict_with_error
  has_many :payments, dependent: :restrict_with_error

  enum :role, ROLES.index_with(&:itself), validate: true

  normalizes :email, with: ->(email) { email.strip.downcase }

  # Guests without a password or an OAuth identity: those Guests::Purge deletes.
  scope :unregistered, -> {
    guest.where(password_digest: nil).where.not(OauthIdentity.where("oauth_identities.user_id = users.id").arel.exists)
  }

  validates :email, uniqueness: { scope: :role }, format: { with: URI::MailTo::EMAIL_REGEXP }, allow_nil: true
  validate :only_guests_are_anonymous
  # Sign-up takes only email and password; name and phone are required from the
  # complete-profile step on (RAA-32), and a CHECK constraint holds the same rule.
  validates :name, :phone, presence: true, if: :registration_complete?
  validate :phone_is_a_phone_number
  # Accounts made by Google or Facebook have no password; email sign-ups must set one.
  validates :password, presence: true, on: :password_signup
  validates :password, length: { minimum: 8, maximum: 72 }, allow_nil: true

  # Written as people write them: a leading +, digits, spaces, dashes and brackets, with
  # 7 to 15 digits (E.164's most). Checked on every save, so sign-up, complete-profile
  # and PATCH /me all hold to it.
  PHONE_FORMAT = /\A\+?[0-9 ()-]+\z/
  PHONE_DIGITS = 7..15

  # Passed the Didit ID check (RAA-44); partners need it to add listings.
  def id_verified?
    partner_verification&.approved? || false
  end

  # A guest who hasn't checked out yet: no email.
  def anonymous?
    email.nil?
  end

  # Has a password or a Google or Facebook sign-in: never purged.
  def registered?
    password_digest.present? || oauth_identities.exists?
  end

  private

  def only_guests_are_anonymous
    errors.add(:email, "can't be blank") if anonymous? && (!guest? || registration_complete?)
  end

  def phone_is_a_phone_number
    return if phone.nil?
    return if phone.match?(PHONE_FORMAT) && PHONE_DIGITS.cover?(phone.count("0-9"))

    errors.add(:phone, "must be a phone number")
  end
end
