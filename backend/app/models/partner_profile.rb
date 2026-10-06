# A partner's legal name and business address (RAA-40), one per partner user. The phone
# is the user's own. Complete once saved and the user has a phone; the web app shows a
# banner until then.
class PartnerProfile < ApplicationRecord
  belongs_to :user

  validates :legal_first_name, :legal_last_name, :street, :city, :region, :postal_code, presence: true
  validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
  validates :user_id, uniqueness: true
  validate :user_is_a_partner

  private

  def user_is_a_partner
    errors.add(:user, "must be a partner") if user && !user.partner?
  end
end
