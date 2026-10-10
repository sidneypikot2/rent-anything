module Listings
  # Reading a listing's fields from a request (RAA-41), shared by adding one and changing
  # one (RAA-46) so both take the same body by the same rules. Values of the wrong type are
  # refused, not coerced; the model checks lengths, that the category is bookable and that
  # attrs match the category's attribute_schema. The area is the published city, town or
  # island the pin is in (RAA-59), or else the nearest. Status is never read from the request.
  # An activity (a tour) also lists the published landmarks it visits (RAA-70): landmark_ids
  # replaces them when sent and keeps them when left out; a listing that isn't an activity
  # has none. The cancellation policy (RAA-88) is kept when left out, so a new listing is
  # free to cancel unless the partner chose otherwise.
  module ListingValues
    include RequestValues

    AREA_KINDS = %w[city town island].freeze
    AREA_RADIUS_METERS = 50_000
    MAX_LANDMARKS = 30

    private

    def listing_attributes
      point = point_from_location
      category = find_category
      @landmarks = landmarks_for(category)
      {
        title: required_string(@params, :title, "Title"),
        description: optional_text(:description, "Description"),
        category:,
        area: point && nearest_area(point),
        location: point,
        attrs: attrs,
        **address_attributes(@params[:address]),
        **cancellation_policy
      }
    end

    def save_listing!(listing)
      if @errors.any?
        @errors.each { |message| listing.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, listing
      end

      Listing.transaction do
        listing.save!
        save_landmarks!(listing)
      end
      listing
    end

    def save_landmarks!(listing)
      return if @landmarks.nil?

      listing.landmark_visits.delete_all(:delete_all)
      @landmarks.each { |landmark| listing.landmark_visits.create!(landmark:) }
    end

    # nil keeps the listing's landmarks as they are; an array replaces them.
    def landmarks_for(category)
      ids = @params[:landmark_ids]
      return (category&.activity? ? nil : []) if ids.nil?
      unless ids.is_a?(Array) && ids.all?(Integer)
        return error("Landmarks must be a list of landmark ids")
      end

      ids = ids.uniq
      return [] if ids.empty?
      return error("Only tours and activities visit landmarks") if category && !category.activity?
      return error("A listing can visit at most #{MAX_LANDMARKS} landmarks") if ids.size > MAX_LANDMARKS

      # A landmark unpublished since it was picked can stay, so it doesn't block every edit.
      kept = @listing&.persisted? ? @listing.landmark_visits.select(:landmark_id) : []
      landmarks = Landmark.where(id: ids).merge(Landmark.published.or(Landmark.where(id: kept))).to_a
      landmarks.size == ids.size ? landmarks : error("Landmarks must be published landmarks")
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

    # The destination guests will find the listing under: the smallest published area whose
    # boundary covers the pin, or, where none has a boundary there yet, the one whose center
    # is nearest. Both use the areas' GiST indexes.
    def nearest_area(point)
      geography = "ST_GeogFromText(#{Area.connection.quote("SRID=4326;#{point}")})"
      areas = Area.published.where(kind: AREA_KINDS)
      areas.where("ST_Covers(boundary, #{geography})").order(Arel.sql("ST_Area(boundary)")).first ||
        areas.where("ST_DWithin(center, #{geography}, #{AREA_RADIUS_METERS})")
          .order(Arel.sql("ST_Distance(center, #{geography})")).first ||
        error("No destination near this pin yet")
    end

    def cancellation_policy
      value = @params[:cancellation_policy]
      return {} if value.nil?
      return { cancellation_policy: value } if Listing::CANCELLATION_POLICIES.key?(value)

      error("Cancellation policy must be one of #{Listing::CANCELLATION_POLICIES.keys.join(', ')}")
      {}
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
