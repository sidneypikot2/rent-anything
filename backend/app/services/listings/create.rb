module Listings
  # A partner adds a listing (RAA-41). It starts as a draft whatever the request says:
  # going live needs an admin's approval (M5). It takes the address as the partner writes
  # it and the map pin; the area is the city, town or island nearest the pin. Values of the
  # wrong type are refused, not coerced; the model checks lengths, that the category is
  # bookable and that attrs match the category's attribute_schema.
  class Create < ApplicationService
    include RequestValues

    AREA_KINDS = %w[city town island].freeze
    AREA_RADIUS_METERS = 50_000

    def initialize(partner, params)
      @partner = partner
      @params = params
      @errors = []
    end

    def call
      point = point_from_location
      listing = @partner.listings.build(
        title: required_string(@params, :title, "Title"),
        description: optional_text(:description, "Description"),
        category: find_category,
        area: point && nearest_area(point),
        location: point,
        attrs: attrs,
        status: "draft",
        **address_attributes(@params[:address])
      )

      if @errors.any?
        @errors.each { |message| listing.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, listing
      end

      listing.save!
      listing
    end

    private

    # Unlike optional_string, an empty description is kept as "", the column's default.
    def optional_text(key, label)
      value = @params[key]
      return "" if value.nil?
      return value.strip if value.is_a?(String)

      error("#{label} must be text")
    end

    def find_category
      id = @params[:category_id]
      return error("Category is required") unless id.is_a?(Integer)

      Category.find_by(id:) || error("Category is not one we know")
    end

    def point_from_location
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

    # The destination guests will find the listing under, by PostGIS distance on the
    # areas' GiST-indexed centers.
    def nearest_area(point)
      geography = "ST_GeogFromText(#{Area.connection.quote("SRID=4326;#{point}")})"
      Area.where(kind: AREA_KINDS)
        .where("ST_DWithin(center, #{geography}, #{AREA_RADIUS_METERS})")
        .order(Arel.sql("ST_Distance(center, #{geography})"))
        .first || error("No destination near this pin yet")
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
