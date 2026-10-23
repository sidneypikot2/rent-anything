# An extra charge on a listing (RAA-104), for any category: a cleaning fee, an environmental
# fee, an extra bed, a helmet, a late return. charged_per says what it is multiplied by in a quote; an
# optional one (required: false) is an add-on the guest picks.
class ListingFee < ApplicationRecord
  CHARGED_PER = {
    "booking" => "per booking",
    "night" => "per night",
    "guest" => "per guest",
    "guest_night" => "per guest per night",
    "unit" => "per unit",
    # A vehicle rental's (RAA-149): a passenger helmet per day, a late return per hour.
    "day" => "per day",
    "hour" => "per hour"
  }.freeze

  belongs_to :listing, inverse_of: :fees

  validates :name, presence: true, length: { maximum: 60 }, uniqueness: { scope: :listing_id, case_sensitive: false }
  validates :amount_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validates :charged_per, inclusion: { in: CHARGED_PER.keys }
  validates :required, inclusion: { in: [ true, false ] }
  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 }
end
