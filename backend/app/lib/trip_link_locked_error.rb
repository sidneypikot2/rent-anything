# A trip link locked after TripAccess::MAX_ATTEMPTS wrong PINs (RAA-175). Rendered as 423.
class TripLinkLockedError < StandardError
  def initialize(msg = "This trip link is locked after too many wrong PINs. Get a code by email to open your trip.")
    super
  end
end
