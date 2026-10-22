# What a guest pays for some bookings of one checkout (RAA-132): those held for payment, which
# they pay for from the cart (Payments::Pay, RAA-143). The provider is a stub that pays at once
# (Payments::Stub) until Xendit's split payments replace it (SPEC.md, Payments).
class Payment < ApplicationRecord
  PROVIDERS = %w[stub].freeze
  STATUSES = %w[pending paid failed].freeze

  belongs_to :checkout, inverse_of: :payments
  has_many :bookings, inverse_of: :payment, dependent: :restrict_with_exception

  validates :provider, inclusion: { in: PROVIDERS }
  validates :status, inclusion: { in: STATUSES }
  validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
