# Days a listing takes no bookings (RAA-118): one day or a range, both ends included, with an
# optional reason ("Fiesta", "Boat repairs"). The partner sets them on the calendar
# (Availability::SaveBlock); bookings already on those days stay. A listing's blocks never
# overlap (an EXCLUDE constraint).
class AvailabilityBlock < ApplicationRecord
  REASON_LENGTH = 120

  belongs_to :listing, inverse_of: :availability_blocks

  scope :overlapping, ->(from, to) { where(starts_on: ..to, ends_on: from..) }

  def covers?(date)
    date.between?(starts_on, ends_on)
  end
end
