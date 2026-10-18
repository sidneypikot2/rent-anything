# Bookings (RAA-118, RAA-132): the lifecycle, checkout's part of it and the partner's offline ones.
module Bookings
  # Whether booking requests are accepted the moment they are made, as an instant booking is.
  # On (BOOKINGS_AUTO_ACCEPT unset or anything but "false") until partners have an inbox to
  # answer them in; the requests still go through requested and accepted, so turning it off
  # changes nothing else.
  def self.auto_accept?
    ENV.fetch("BOOKINGS_AUTO_ACCEPT", "true") != "false"
  end
end
