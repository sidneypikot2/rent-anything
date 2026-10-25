module Auth
  # Opens a guest's trip link with its PIN (POST /trip_access/unlock, RAA-175). Every open of
  # the link asks again: the session it returns lasts SESSION_LIFETIME at most, refreshes
  # included, and the web app keeps it only in that tab. An unknown link and a wrong PIN get
  # the same 401; TripAccess::MAX_ATTEMPTS wrong PINs in a row lock the link (423) until the
  # guest resets it from an emailed code.
  class UnlockTripLink < Base
    SESSION_LIFETIME = 12.hours

    def initialize(token, pin)
      @token = token
      @pin = pin
    end

    def call
      require_string!(@token, "Trip link")
      require_string!(@pin, "PIN")

      # Returns a symbol instead of raising inside the transaction, so a wrong PIN's count
      # isn't rolled back with it.
      result = TripAccess.transaction do
        access = TripAccess.lock.find_by_token(@token)
        if access.nil?
          :wrong
        elsif access.locked?
          :locked
        elsif access.authenticate_pin(@pin)
          access.update!(failed_attempts: 0)
          IssueTokens.call(access.user, session_ends_at: SESSION_LIFETIME.from_now)
        else
          failed = access.failed_attempts + 1
          access.update!(failed_attempts: failed, locked_at: (Time.current if failed >= TripAccess::MAX_ATTEMPTS))
          access.locked? ? :locked : :wrong
        end
      end

      raise TripLinkLockedError if result == :locked
      raise NotAuthenticatedError, "That trip link or PIN is wrong" if result == :wrong

      result
    end
  end
end
