module Businesses
  # Reading a business from a request (RAA-100), shared by adding one and changing one. The
  # name is required; the model checks its length and that it is unique among the partner's
  # businesses, ignoring case. The description is optional and kept when left out. The
  # address and the map pin, which a new listing can copy, are required on a new business;
  # on a change each is kept when left out, so a business made before them (the RAA-100
  # backfill) can be given them later. The payout account (RAA-145) is optional, kept when left
  # out, and null clears it.
  module BusinessValues
    include RequestValues

    private

    def business_attributes(business)
      attributes = { name: required_string(@params, :name, "Name") }
      description = @params[:description]
      if description.is_a?(String)
        attributes[:description] = description.strip
      elsif !description.nil?
        @errors << "Description must be text"
      end
      if business.new_record? || @params.key?(:address)
        attributes.merge!(address_attributes(@params[:address]))
      end
      if business.new_record? || @params.key?(:location)
        attributes[:location] = point_from(@params[:location])
      end
      attributes[:payout_account] = payout_account_from(business, @params[:payout_account_id]) if @params.key?(:payout_account_id)
      attributes
    end

    # One of the partner's payout accounts (RAA-145), or null for none.
    def payout_account_from(business, id)
      return nil if id.nil?

      account = business.partner.payout_accounts.find_by(id:) if id.is_a?(Integer)
      @errors << "Payout account must be one of your payout accounts" unless account
      account
    end

    def save_business!(business)
      attributes = business_attributes(business)
      if @errors.any?
        @errors.each { |message| business.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, business
      end

      business.update!(attributes)
      business
    end
  end
end
