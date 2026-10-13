module Businesses
  # A partner adds a business they run (RAA-100), read by BusinessValues.
  class Create < ApplicationService
    include BusinessValues

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      save_business!(@partner.businesses.build)
    end
  end
end
