# What a guest pays for some of their bookings held for payment, from the cart (Payments::Pay,
# RAA-143). With PayMongo (Payments.paymongo?, test mode only for now) a payment starts pending
# on PayMongo's hosted checkout and covers the bookings in covered_booking_ids, which point at
# it once it is paid (Payments::Sync); it may cover several checkouts, so checkout is set only
# when it covers one. Without PayMongo the stub pays at once, per checkout (Payments::Stub).
# needs_refund: paid after its bookings were let go (expired, cancelled meanwhile).
class Payment < ApplicationRecord
  PROVIDERS = %w[stub paymongo].freeze
  STATUSES = %w[pending paid failed needs_refund].freeze
  # How long a guest has on PayMongo's page: a hold is kept at least this long once they start.
  CHECKOUT_WINDOW = 30.minutes
  # The least PayMongo's checkout takes, in centavos (₱20).
  MINIMUM_CENTS = 2_000

  belongs_to :user, optional: true, inverse_of: :payments
  belongs_to :checkout, optional: true, inverse_of: :payments
  has_many :bookings, inverse_of: :payment, dependent: :restrict_with_exception

  validates :provider, inclusion: { in: PROVIDERS }
  validates :status, inclusion: { in: STATUSES }
  validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }

  # PayMongo payments still open that cover any of the bookings.
  scope :open_checkouts, -> { where(provider: "paymongo", status: "pending") }
  scope :covering, ->(booking_ids) { where("covered_booking_ids && ARRAY[?]::bigint[]", booking_ids) }

  def pending?
    status == "pending"
  end
end
