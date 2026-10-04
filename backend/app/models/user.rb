# One table for every account. The role is fixed by where the account was made: a sign-up
# from / is a guest, one from /partner a partner; admins are never self-made.
class User < ApplicationRecord
  ROLES = %w[guest partner admin].freeze
  SELF_SERVE_ROLES = %w[guest partner].freeze

  has_secure_password validations: false

  has_many :oauth_identities, dependent: :destroy
  has_many :refresh_tokens, dependent: :delete_all

  enum :role, ROLES.index_with(&:itself), validate: true

  normalizes :email, with: ->(email) { email.strip.downcase }

  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP }
  validates :name, presence: true
  # Accounts made by Google or Facebook have no password; email sign-ups must set one.
  validates :password, presence: true, on: :password_signup
  validates :password, length: { minimum: 8, maximum: 72 }, allow_nil: true
end
