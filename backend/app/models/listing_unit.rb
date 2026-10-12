# One of a listing's identical items, rooms or vehicles (RAA-98), numbered from 1. The partner
# sets how many there are; M3's bookings and availability blocks will each hold one.
class ListingUnit < ApplicationRecord
  belongs_to :listing

  validates :position, numericality: { only_integer: true, greater_than_or_equal_to: 1 },
    uniqueness: { scope: :listing_id }
end
