module Businesses
  # Reading a business from a request (RAA-100), shared by adding one and changing one. The
  # name is required; the model checks its length and that it is unique among the partner's
  # businesses, ignoring case. The description is optional and kept when left out. The
  # address and the map pin, which a new listing can copy, are required on a new business;
  # on a change each is kept when left out, so a business made before them (the RAA-100
  # backfill) can be given them later.
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
      attributes
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
