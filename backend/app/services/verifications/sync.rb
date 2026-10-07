module Verifications
  # Brings a partner's ID check up to date from Didit's decision (RAA-44). Called by the
  # webhook and when the partner looks at their status, so the two may race: the row is
  # locked, a decline is counted only on the change into declined, an answer about a
  # session the partner has since replaced is dropped, and approval is final.
  class Sync < ApplicationService
    def initialize(verification)
      @verification = verification
    end

    def call
      session_id = @verification.didit_session_id
      return @verification if session_id.nil?

      status = PartnerVerification.from_didit(Didit.decision(session_id)["status"])
      @verification.with_lock do
        next if status.nil? || status == @verification.status
        next if @verification.didit_session_id != session_id || @verification.approved?
        # Only forward: a finished check doesn't go back to pending on a stale read (from a
        # sync that fetched before the webhook committed), so a decline is counted once.
        finished = @verification.declined? || @verification.expired?
        next if finished && status != "approved"

        now = Time.current
        @verification.assign_attributes(declined_count: @verification.declined_count + 1, last_declined_at: now) if status == "declined"
        @verification.verified_at = now if status == "approved"
        @verification.update!(status:)
      end
      @verification
    end
  end
end
