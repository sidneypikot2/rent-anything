# A guest's checkout of some of a trip's items (RAA-132, Checkouts::Create): one booking per
# item and the payments made for them. The idempotency key, unique per guest, lets the web app
# send the same checkout again (a retry, a double tap) and get the first one back.
class Checkout < ApplicationRecord
  belongs_to :user
  belongs_to :trip, optional: true
  has_many :bookings, -> { order(:starts_on, :id) }, inverse_of: :checkout, dependent: :restrict_with_exception
  has_many :payments, inverse_of: :checkout, dependent: :restrict_with_exception
end
