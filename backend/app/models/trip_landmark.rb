# A place to see a guest saved to one of their trips: "want to go", with no dates or price.
# Never booked or sent to a partner, and it doesn't name the trip or add to its places
# (those come from its items). Saving or removing one counts as an edit of the trip.
class TripLandmark < ApplicationRecord
  belongs_to :trip, touch: true
  belongs_to :landmark

  validates :landmark_id, uniqueness: { scope: :trip_id }
end
