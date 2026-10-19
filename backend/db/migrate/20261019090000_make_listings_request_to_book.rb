# Request to book only (RAA-134): every listing's partner answers every booking, so listings
# that were instant book become request to book. Bookings keep the mode they were made under.
class MakeListingsRequestToBook < ActiveRecord::Migration[8.1]
  def up
    execute "UPDATE listings SET booking_mode = 'request' WHERE booking_mode <> 'request'"
  end

  # Which listings were instant book isn't kept, so there is nothing to put back.
  def down; end
end
