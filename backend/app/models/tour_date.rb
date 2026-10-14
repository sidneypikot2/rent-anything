# A day a tour runs besides its weekdays (RAA-110); a tour on specific dates only has no
# weekdays and runs on these alone. For a multi-day tour it is a start day.
class TourDate < ApplicationRecord
  belongs_to :listing, inverse_of: :tour_dates

  validates :date, presence: true, uniqueness: { scope: :listing_id }
end
