# A person with an account. The role decides which section they use: guests book, partners
# list, admins run the platform. Sign-up only ever makes a guest or a partner.
class User < ApplicationRecord
  ROLES = %w[guest partner admin].freeze
  SELF_SERVE_ROLES = %w[guest partner].freeze

  has_secure_password
  has_many :refresh_tokens, dependent: :delete_all

  enum :role, ROLES.index_by(&:itself), validate: true

  normalizes :email, with: ->(email) { email.strip.downcase }
  normalizes :phone, with: ->(phone) { phone.gsub(/[\s-]/, "").presence }

  validates :name, presence: true, length: { maximum: 100 }
  validates :email, presence: true, uniqueness: true, format: { with: URI::MailTo::EMAIL_REGEXP, allow_blank: true }
  validates :phone, format: { with: /\A\+?\d{7,15}\z/ }, allow_nil: true
  # has_secure_password already rejects more than 72 bytes (bcrypt's limit).
  validates :password, length: { minimum: 8 }, allow_nil: true

  def as_json(*)
    { id:, name:, email:, phone:, role:, created_at: }
  end
end
