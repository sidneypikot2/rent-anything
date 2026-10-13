module Businesses
  # A partner renames one of their businesses or changes its description (RAA-100), by the
  # same rules as adding one (BusinessValues).
  class Update < ApplicationService
    include BusinessValues

    def initialize(business, params)
      @business = business
      @params = params
      @errors = []
    end

    def call
      save_business!(@business)
    end
  end
end
