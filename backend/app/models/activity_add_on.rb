# An extra a guest may add to a water activity (RAA-271), from a fixed list so every listing
# names it the same: a drone shot, a photo package. Priced per booking, per unit or per person.
# One of each kind on a listing at a time; a removed one is archived, never deleted, so a booking
# made with it keeps it. Listing#add_ons are the current ones.
class ActivityAddOn < ApplicationRecord
  KINDS = {
    "drone_shot" => "Drone shot",
    "action_cam_video" => "Action cam video",
    "photo_package" => "Photo package",
    "towel" => "Towel"
  }.freeze
  CHARGED_PER = {
    "booking" => "per booking",
    "unit" => "per unit",
    "person" => "per person"
  }.freeze

  belongs_to :listing, inverse_of: :activity_add_ons

  scope :current, -> { where(archived_at: nil) }

  validates :kind, inclusion: { in: KINDS.keys }
  validates :price_cents, numericality: { only_integer: true, greater_than: 0 }
  validates :charged_per, inclusion: { in: CHARGED_PER.keys }
  validates :position, numericality: { only_integer: true }
end
