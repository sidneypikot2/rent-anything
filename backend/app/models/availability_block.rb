# Days a listing takes no bookings (RAA-110): one day or a range, both ends included, with an
# optional reason ("Fiesta", "Boat repairs"). Tours use them first; the partner calendar and
# bookings (M3) use the same rows. A listing's blocks never overlap (an EXCLUDE constraint).
class AvailabilityBlock < ApplicationRecord
  REASON_LENGTH = 120

  belongs_to :listing, inverse_of: :availability_blocks

  validates :starts_on, :ends_on, presence: true
  validates :reason, length: { maximum: REASON_LENGTH }
  validate :ends_on_from_starts_on

  def covers?(date)
    date.between?(starts_on, ends_on)
  end

  private

  def ends_on_from_starts_on
    errors.add(:ends_on, "can't be before the start") if starts_on && ends_on && ends_on < starts_on
  end
end
