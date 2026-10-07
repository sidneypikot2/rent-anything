module Verifications
  # The partner's ID check as it stands (RAA-44), or nil if they never started one. While
  # it is pending, Didit is asked first; if Didit can't answer, the last known status is
  # returned rather than failing the page.
  class Current < ApplicationService
    def initialize(partner)
      @partner = partner
    end

    def call
      verification = @partner.partner_verification
      return verification unless verification&.pending?

      Sync.call(verification)
    rescue Didit::Error => e
      Rails.logger.warn("Didit sync failed for partner verification #{verification.id}: #{e.message}")
      verification
    end
  end
end
