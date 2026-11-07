# One of a water activity's drop-off zones (RAA-271): taking the unit (a jet ski) to the guest's
# beach or chosen spot up to max_distance_m from the listing's pin, in a straight line, costs
# fee_cents (0 free). ActivityDetail holds them in order (DeliveryZoned).
class ActivityDeliveryZone < ApplicationRecord
  belongs_to :activity_detail, inverse_of: :delivery_zones

  validates :max_distance_m,
    numericality: { only_integer: true, in: DeliveryZoned::MIN_DISTANCE_M..DeliveryZoned::MAX_DISTANCE_M }
  validates :fee_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
end
