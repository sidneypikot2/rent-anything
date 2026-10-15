# A partner's change to one day of a listing (RAA-118): its price, how many of its units are
# on sale, and a stay's minimum nights from that check-in. A null keeps the listing's own,
# and a row with nothing left to change is deleted (Availability::SetDays).
class ListingDay < ApplicationRecord
  belongs_to :listing, inverse_of: :days
end
