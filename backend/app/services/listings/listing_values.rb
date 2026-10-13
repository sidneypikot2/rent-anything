module Listings
  # Reading a listing's fields from a request (RAA-41), shared by adding one and changing
  # one (RAA-46) so both take the same body by the same rules. Values of the wrong type are
  # refused, not coerced; the model checks lengths, that the category is bookable and that
  # attrs match the category's attribute_schema. The area is the published city, town or
  # island the pin is in (RAA-59), or else the nearest. Status is never read from the request.
  # An activity (a tour) also lists the published landmarks it visits (RAA-70): landmark_ids
  # replaces them when sent and keeps them when left out; a listing that isn't an activity
  # has none. The cancellation policy (RAA-88) is kept when left out, so a new listing is
  # free to cancel unless the partner chose otherwise. units_count is how many identical
  # items, rooms or vehicles it has (RAA-98), one listing_units row each: a new listing has
  # one unless told otherwise, and a change keeps the count when it is left out. business_id
  # is one of the partner's businesses (RAA-100): left out, a new listing goes under the
  # partner's only business (several make it required) and a change keeps the listing's.
  module ListingValues
    include RequestValues

    AREA_KINDS = %w[city town island].freeze
    AREA_RADIUS_METERS = 50_000
    MAX_LANDMARKS = 30
    MAX_UNITS = 100

    private

    def listing_attributes
      point = point_from(@params[:location])
      category = find_category
      @landmarks = landmarks_for(category)
      @units_count = units_count
      {
        title: required_string(@params, :title, "Title"),
        description: optional_text(:description, "Description"),
        category:,
        area: point && nearest_area(point),
        location: point,
        attrs: attrs,
        **address_attributes(@params[:address]),
        **cancellation_policy,
        **business_attribute
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
        save_units!(listing)
      end
      listing
    end

    def save_landmarks!(listing)
      return if @landmarks.nil?

      listing.landmark_visits.delete_all(:delete_all)
      @landmarks.each { |landmark| listing.landmark_visits.create!(landmark:) }
    end

    # Adds or removes units from the end to reach the count. From M3, removing a unit that
    # has active bookings must be refused.
    def save_units!(listing)
      count = @units_count || (listing.units.none? ? 1 : nil)
      return if count.nil?

      listing.units.where("position > ?", count).delete_all
      (listing.units.maximum(:position).to_i + 1..count).each { |position| listing.units.create!(position:) }
      listing.units.reset
    end

    # Each service says whose listing it is: Create's partner, Update's listing's.
    def listing_partner
      raise NotImplementedError
    end

    def business_attribute
      id = @params[:business_id]
      if id.nil?
        return {} if @listing&.persisted?

        only = listing_partner.businesses.limit(2).to_a
        return only.one? ? { business: only.first } : (error("Business is required") || {})
      end

      found = listing_partner.businesses.find_by(id:) if id.is_a?(Integer)
      found ? { business: found } : (error("Business must be one of your businesses") || {})
    end

    def units_count
      value = @params[:units_count]
      return nil if value.nil?
      return value if value.is_a?(Integer) && value.between?(1, MAX_UNITS)

      error("Units must be a whole number from 1 to #{MAX_UNITS}")
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
