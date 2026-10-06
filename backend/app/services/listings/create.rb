module Listings
  # A partner adds a listing (RAA-41). It starts as a draft whatever the request says:
  # going live needs an admin's approval (M5). Values of the wrong type are refused, not
  # coerced; the model checks lengths, that the category is bookable and that attrs match
  # the category's attribute_schema.
  class Create < ApplicationService
    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      listing = @partner.listings.build(
        title: required_string(:title, "Title"),
        description: optional_string(:description, "Description") || "",
        category: find_category,
        area: find_area,
        location: point,
        attrs: attrs,
        status: "draft"
      )

      if @errors.any?
        @errors.each { |message| listing.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, listing
      end

      listing.save!
      listing
    end

    private

    def required_string(key, label)
      value = @params[key]
      return value.strip if value.is_a?(String) && value.present?

      @errors << "#{label} is required"
      nil
    end

    def optional_string(key, label)
      value = @params[key]
      return nil if value.nil?
      return value.strip if value.is_a?(String)

      @errors << "#{label} must be text"
      nil
    end

    def find_category
      id = @params[:category_id]
      return error("Category is required") unless id.is_a?(Integer)

      Category.find_by(id:) || error("Category is not one we know")
    end

    def find_area
      slug = @params[:area_slug]
      return error("Area is required") unless slug.is_a?(String) && slug.present?

      Area.find_by(slug:) || error("Area is not one we know")
    end

    def point
      location = @params[:location]
      return error("Location is required") unless location.respond_to?(:key?)

      lat = coordinate(location[:lat], 90, "Latitude")
      lng = coordinate(location[:lng], 180, "Longitude")
      "POINT(#{lng} #{lat})" if lat && lng
    end

    def coordinate(value, limit, label)
      return value if value.is_a?(Numeric) && value.between?(-limit, limit)

      error("#{label} must be a number between -#{limit} and #{limit}")
    end

    def attrs
      value = @params[:attrs]
      return {} if value.nil?
      return value.to_unsafe_h if value.is_a?(ActionController::Parameters)
      return value if value.is_a?(Hash)

      error("Details must be an object")
    end

    def error(message)
      @errors << message
      nil
    end
  end
end
