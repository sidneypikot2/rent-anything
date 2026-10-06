# A guest's legal name and address (RAA-40), one per guest user. Separate from
# PartnerProfile because guests will need different fields as bookings arrive. Complete
# once saved and the user has a phone; the web app shows a banner until then.
class GuestProfile < ApplicationRecord
  include ProfileAddress

  validate :user_is_a_guest

  private

  def user_is_a_guest
    errors.add(:user, "must be a guest") if user && !user.guest?
  end
end
