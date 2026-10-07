module Verifications
  # A partner declined PartnerVerification::MAX_DECLINES times must wait until retry_at
  # before starting another ID check. Rendered as 429.
  class CoolingDownError < StandardError
    attr_reader :retry_at

    def initialize(retry_at)
      @retry_at = retry_at
      super("Your ID check was declined #{PartnerVerification::MAX_DECLINES} times. You can try again in an hour.")
    end
  end
end
