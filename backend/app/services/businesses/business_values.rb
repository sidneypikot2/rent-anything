module Businesses
  # Reading a business from a request (RAA-100), shared by adding one and changing one. The
  # name is required; the model checks its length and that it is unique among the partner's
  # businesses, ignoring case. The description is optional and kept when left out.
  module BusinessValues
    include RequestValues

    private

    def business_attributes
      attributes = { name: required_string(@params, :name, "Name") }
      description = @params[:description]
      if description.is_a?(String)
        attributes[:description] = description.strip
      elsif !description.nil?
        @errors << "Description must be text"
      end
      attributes
    end

    def save_business!(business)
      attributes = business_attributes
      if @errors.any?
        @errors.each { |message| business.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, business
      end

      business.update!(attributes)
      business
    end
  end
end
