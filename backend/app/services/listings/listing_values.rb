module Listings
  # Reading a listing's fields from a request (RAA-41), shared by adding one and changing
  # one (RAA-46) so both take the same body by the same rules. Values of the wrong type are
  # refused, not coerced; the model checks lengths, that the category is bookable and that
  # attrs match the category's attribute_schema. The area is the city, town or island
  # nearest the pin. Status is never read from the request.
  module ListingValues
    include RequestValues

    AREA_KINDS = %w[city town island].freeze
    AREA_RADIUS_METERS = 50_000

    private

    def listing_attributes
      point = point_from_location
      {
        title: required_string(@params, :title, "Title"),
        description: optional_text(:description, "Description"),
        category: find_category,
        area: point && nearest_area(point),
        location: point,
        attrs: attrs,
        **address_attributes(@params[:address])
      }
    end

    def save_listing!(listing)
      if @errors.any?
        @errors.each { |message| listing.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, listing
      end

      listing.save!
      listing
    end

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
