# A place to see a guest saved to one of their trips: "want to go", with no dates or price.
# Never booked or sent to a partner, and it doesn't name the trip or add to its places
# (those come from its items). Saving or removing one counts as an edit of the trip.
# `plan` is how the guest means to see it (Trips::PlanLandmark, RAA-262).
class TripLandmark < ApplicationRecord
  PLANS = %w[own skip].freeze

  belongs_to :trip, touch: true
  belongs_to :landmark

  validates :plan, inclusion: { in: PLANS }, allow_nil: true
  validates :landmark_id, uniqueness: { scope: :trip_id }
end
