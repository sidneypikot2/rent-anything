# A partner's legal name and business address (RAA-40), one per partner user, plus the
# display name travellers see. Complete once saved and the user has a phone; the web app
# shows a banner until then.
class PartnerProfile < ApplicationRecord
  include ProfileAddress

  validate :user_is_a_partner

  private

  def user_is_a_partner
    errors.add(:user, "must be a partner") if user && !user.partner?
  end
end
