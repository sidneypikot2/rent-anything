# Bookings (RAA-118, RAA-132): the lifecycle, checkout's part of it and the partner's offline ones.
module Bookings
  # Whether booking requests are accepted the moment they are made, as an instant booking is.
  # Off (BOOKINGS_AUTO_ACCEPT unset or anything but "true") since RAA-134: every request waits
  # for its partner's answer in the partner calendar. The requests go through requested and
  # accepted either way, so turning it on changes nothing else. A guest's change to a booking
  # (Bookings::Change) is never accepted automatically.
  def self.auto_accept?
    ENV.fetch("BOOKINGS_AUTO_ACCEPT", "false") == "true"
  end
end
