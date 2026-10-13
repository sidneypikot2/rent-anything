# A business a partner runs (RAA-100): "Basilia Guest House", "Basilia Motor Rentals". One
# partner can run several; each listing belongs to one of them, and guests see its name.
# ID checks and payouts stay with the partner. Names are unique per partner, ignoring case.
class Business < ApplicationRecord
  NAME_LENGTH = 80

  belongs_to :partner, class_name: "User"
  has_many :listings, dependent: :restrict_with_error

  validates :name, presence: true, length: { maximum: NAME_LENGTH },
    uniqueness: { scope: :partner_id, case_sensitive: false }
  validates :description, length: { maximum: 2000 }
  validate :partner_is_a_partner

  private

  def partner_is_a_partner
    errors.add(:partner, "must be a partner") if partner && !partner.partner?
  end
end
