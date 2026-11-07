# What a guest picks on a water activity (RAA-270): a name, a length and a price, "30 minutes,
# ₱1,500". The price is for one unit when the activity is sold per unit, for one guest when per
# person (ActivityDetail#sold_by). A removed offer is archived, never deleted, so a booking made
# with it keeps it; only the unarchived ones are offered (Listing#offers).
class ActivityOffer < ApplicationRecord
  NAME_LENGTH = 1..60
  DURATIONS = 5..720
  MAX_PER_LISTING = 10

  belongs_to :listing, inverse_of: :activity_offers

  scope :current, -> { where(archived_at: nil) }

  validates :name, length: { in: NAME_LENGTH }
  validates :duration_minutes, numericality: { only_integer: true, in: DURATIONS }
  validate :duration_in_fives
  validates :price_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :position, numericality: { only_integer: true }
  # Riders who may share or take turns on one unit for this offer (RAA-271); nil: seats_per_unit.
  validates :max_guests, numericality: { only_integer: true, in: 1..ActivityDetail::MAX_SEATS }, allow_nil: true

  def archived?
    archived_at.present?
  end

  private

  def duration_in_fives
    errors.add(:duration_minutes, "must be in steps of 5 minutes") if duration_minutes.is_a?(Integer) && duration_minutes % 5 != 0
  end
end
