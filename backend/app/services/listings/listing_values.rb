module Listings
  # Reading a listing's fields from a request (RAA-41), shared by adding one and changing
  # one (RAA-46) so both take the same body by the same rules. Values of the wrong type are
  # refused, not coerced; the model checks lengths, that the category is bookable and that
  # attrs match the category's attribute_schema. The area is the published city, town or
  # island the pin is in (RAA-59), or else the nearest. Status is never read from the request
  # (Listings::ChangeStatus sets it, RAA-115).
  # An activity (a tour) also lists the published landmarks it visits (RAA-70): landmark_ids
  # replaces them when sent and keeps them when left out; a listing that isn't an activity
  # has none. The cancellation policy (RAA-88) is kept when left out, so a new listing is
  # free to cancel unless the partner chose otherwise. units_count is how many identical
  # items, rooms or vehicles it has (RAA-98), one listing_units row each: a new listing has
  # one unless told otherwise, and a change keeps the count when it is left out. business_id
  # is one of the partner's businesses (RAA-100): left out, a new listing goes under the
  # partner's only business (several make it required) and a change keeps the listing's.
  # An accommodation listing has a stay_rate (RAA-104): required on a new one, replaced when
  # sent and kept when left out, and dropped when the listing stops being accommodation; the
  # rate is checked again on every save, as the guests the place sleeps may change. fees, for
  # any category, replace the listing's fees when sent and keep them when left out. A vehicle
  # rental has a vehicle_rate (RAA-149) by the same rules as a stay_rate.
  # A tour's details (RAA-110) are read by TourValues.
  # photos (RAA-106) are the ids of the listing's own photos (added through
  # /api/v1/partner/listings/:id/photos) in the partner's order: sent, the order is theirs
  # and a photo left out is deleted; left out, the photos stay as they are.
  module ListingValues
    include RequestValues
    include TourValues

    MAX_LANDMARKS = 30
    MAX_UNITS = 100
    MAX_FEES = 20
    STAY_RATE_FIELDS = %i[
      weekend_price_cents base_guests extra_guest_fee_cents weekly_discount_percent monthly_discount_percent min_nights
      max_nights
    ].freeze
    VEHICLE_RATE_FIELDS = %i[
      half_day_price_cents half_day_hours hourly_price_cents weekly_price_cents monthly_price_cents
      security_deposit_cents min_rental_days km_limit_per_day excess_km_fee_cents driver_fee_cents pickup_from_hour pickup_until_hour turnaround_minutes child_helmet_fee_cents
    ].freeze

    private

    def listing_attributes
      point = point_from(@params[:location])
      category = find_category
      @landmarks = landmarks_for(category)
      @units_count = units_count
      @stay_rate = stay_rate_for(category)
      @vehicle_rate = vehicle_rate_for(category)
      @flat_rate = flat_rate_for(category)
      @tour = tour_for(category)
      @fees = fees
      @photo_ids = photo_ids
      {
        title: required_string(@params, :title, "Title"),
        description: optional_text(:description, "Description"),
        category:,
        area: point && nearest_area(point),
        location: point,
        attrs: attrs,
        **address_attributes(@params[:address]),
        **cancellation_policy,
        **booking_mode,
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
        # Saves of one listing take turns: its dates, blocks and photos are replaced whole.
        Listing.where(id: listing.id).lock.pluck(:id)
        check_photo_limit!(listing)
        save_landmarks!(listing)
        save_units!(listing)
        save_stay_rate!(listing)
        save_vehicle_rate!(listing)
        save_flat_rate!(listing)
        save_tour!(listing)
        save_fees!(listing)
        save_photos!(listing)
        listing.reload.check_still_live!(@live_blockers) if @live_blockers
      end
      listing
    end

    def save_stay_rate!(listing)
      return listing.stay_rate&.destroy! unless listing.category.accommodation?

      rate = listing.stay_rate || listing.build_stay_rate
      rate.assign_attributes(@stay_rate) if @stay_rate
      rate.save!
    end

    def save_vehicle_rate!(listing)
      return listing.vehicle_rate&.destroy! unless listing.category.vehicle?

      rate = listing.vehicle_rate || listing.build_vehicle_rate
      if @vehicle_rate
        rate.assign_attributes(@vehicle_rate.except(:delivery))
        rate.assign_delivery(**@vehicle_rate[:delivery])
      end
      rate.save!
    end

    # Gear's and a transfer's price (RAA-191): kept when not sent, 0 ("no price yet") at first.
    def save_flat_rate!(listing)
      return listing.flat_rate&.destroy! unless listing.category.flat_priced?

      rate = listing.flat_rate || listing.build_flat_rate
      rate.assign_attributes(@flat_rate) if @flat_rate
      rate.save!
    end

    def save_fees!(listing)
      return if @fees.nil?

      listing.fees.delete_all
      @fees.each { |fee| listing.fees.create!(fee) }
      listing.fees.reset
    end

    def save_landmarks!(listing)
      return if @landmarks.nil?

      listing.landmark_visits.delete_all(:delete_all)
      @landmarks.each { |landmark| listing.landmark_visits.create!(landmark:) }
    end

    # Adds or removes units from the end to reach the count, never below the units booked on
    # any day from today (RAA-118): bookings take a number of units, not particular ones.
    def save_units!(listing)
      count = @units_count || (listing.units.none? ? 1 : nil)
      return if count.nil?

      check_units_booked!(listing, count) if count < listing.units.size
      listing.units.where("position > ?", count).delete_all
      (listing.units.maximum(:position).to_i + 1..count).each { |position| listing.units.create!(position:) }
      listing.units.reset
    end

    def check_units_booked!(listing, count)
      last = listing.bookings.holding.where(ends_on: Date.current..).maximum(:ends_on)
      return unless last

      ledger = Availability::Ledger.new([ listing ], Date.current, last)
      booked = (Date.current..last).map { ledger.booked(listing, _1) }.max
      return if booked <= count

      listing.errors.add(:base, "#{booked} units are booked on the same day: keep at least #{booked}")
      raise ActiveRecord::RecordInvalid, listing
    end

    # A listing made a tour (RAA-110), or photos put in order, may keep only as many photos as
    # it takes. A tour made before the limit keeps its photos until they are reordered;
    # guests see the first five.
    def check_photo_limit!(listing)
      kept = @photo_ids&.size || (listing.saved_change_to_category_id? ? listing.photos.count : 0)
      return if kept <= listing.photo_limit

      listing.errors.add(:base, "A #{listing.category.tour? ? 'tour' : 'listing'} can have at most " \
        "#{listing.photo_limit} photos: remove #{kept - listing.photo_limit} first")
      raise ActiveRecord::RecordInvalid, listing
    end

    # Puts the photos listed in that order and deletes the rest (their files go from storage
    # after the commit). Positions are unique only at commit, so two photos can swap places;
    # the listing's row is locked first (save_listing!), as adding a photo does, so a photo
    # added meanwhile isn't numbered over.
    def save_photos!(listing)
      return if @photo_ids.nil?

      photos = listing.photos.reload.index_by(&:id)
      unless (@photo_ids - photos.keys).empty?
        listing.errors.add(:base, "Photos must be this listing's photos")
        raise ActiveRecord::RecordInvalid, listing
      end
      photos.except(*@photo_ids).each_value(&:destroy!)
      @photo_ids.each.with_index(1) { |id, position| photos[id].update!(position:) }
      listing.photos.reset
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

    # nil keeps the listing's photos as they are; an array of its photo ids orders them. That
    # they are this listing's is checked under the lock (save_photos!).
    def photo_ids
      ids = @params[:photos]
      return nil if ids.nil?
      return error("Photos must be a list of photo ids") unless ids.is_a?(Array) && ids.all?(Integer)

      ids.uniq
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

    # The destination guests will find the listing under (Area.serving).
    def nearest_area(point)
      Area.serving(point) || error("No destination near this pin yet")
    end

    def cancellation_policy
      value = @params[:cancellation_policy]
      return {} if value.nil?
      return { cancellation_policy: value } if Listing::CANCELLATION_POLICIES.key?(value)

      error("Cancellation policy must be one of #{Listing::CANCELLATION_POLICIES.keys.join(', ')}")
      {}
    end

    # How guests book it (RAA-132): only request to book is offered (RAA-134). Left out, it keeps
    # what the listing has.
    def booking_mode
      value = @params[:booking_mode]
      return {} if value.nil?
      return { booking_mode: value } if Listing::OFFERED_BOOKING_MODES.key?(value)

      error("Booking mode must be one of #{Listing::OFFERED_BOOKING_MODES.keys.join(', ')}")
      {}
    end

    def attrs
      value = @params[:attrs]
      return {} if value.nil?
      return value.to_unsafe_h if value.is_a?(ActionController::Parameters)
      return value if value.is_a?(Hash)

      error("Details must be an object")
    end

    # nil keeps the listing's rate as it is. A rate sent replaces it whole: the optional
    # fields left out take their defaults.
    def stay_rate_for(category)
      value = @params[:stay_rate]
      accommodation = category&.accommodation?
      if value.nil?
        return error("Stay rate is required for accommodation") if accommodation && !@listing&.stay_rate

        return nil
      end
      return error("Only accommodation has a stay rate") if category && !accommodation
      return error("Stay rate must be an object") unless value.respond_to?(:key?)

      price = value[:nightly_price_cents]
      error("Nightly price must be a whole number of centavos above 0") unless price.is_a?(Integer) && price.positive?
      STAY_RATE_FIELDS.index_with do |key|
        field = value[key]
        next StayRate.column_defaults[key.to_s] if field.nil?
        next field if field.is_a?(Integer)

        error("#{StayRate.human_attribute_name(key)} must be a whole number")
      end.merge(nightly_price_cents: price)
    end

    # nil keeps the listing's rate as it is. A rate sent replaces it whole: the optional
    # fields left out take their defaults, and the shop neither delivers nor collects without
    # delivers / picks_up and the delivery_zones they go by (RAA-205).
    def vehicle_rate_for(category)
      value = @params[:vehicle_rate]
      vehicle = category&.vehicle?
      if value.nil?
        return error("Vehicle rate is required for a vehicle rental") if vehicle && !@listing&.vehicle_rate

        return nil
      end
      return error("Only a vehicle rental has a vehicle rate") if category && !vehicle
      return error("Vehicle rate must be an object") unless value.respond_to?(:key?)

      price = value[:daily_price_cents]
      error("Daily price must be a whole number of centavos above 0") unless price.is_a?(Integer) && price.positive?
      VEHICLE_RATE_FIELDS.index_with do |key|
        field = value[key]
        next VehicleRate.column_defaults[key.to_s] if field.nil?
        next field if field.is_a?(Integer)

        error("#{VehicleRate.human_attribute_name(key)} must be a whole number")
      end.merge(daily_price_cents: price, driving: driving_for(value[:driving]), delivery: delivery_for(value))
    end

    def delivery_for(value)
      delivers, picks_up = [ [ :delivers, "Delivers" ], [ :picks_up, "Picks up" ] ].map do |key, label|
        next false if value[key].nil?
        next value[key] if [ true, false ].include?(value[key])

        error("#{label} must be true or false")
      end
      { delivers:, picks_up:, zones: delivery_zones_for(value[:delivery_zones]) }
    end

    # Each zone's max_distance_m and fee_cents, whole numbers; the rate checks the rest.
    def delivery_zones_for(zones)
      return [] if zones.nil?
      return error("Delivery zones must be a list") || [] unless zones.is_a?(Array)
      return error("A shop can have at most #{VehicleRate::MAX_DELIVERY_ZONES} delivery zones") || [] if zones.size > VehicleRate::MAX_DELIVERY_ZONES

      zones.filter_map do |zone|
        next error("Each delivery zone must be an object") unless zone.respond_to?(:key?)

        distance, fee = zone[:max_distance_m], zone[:fee_cents]
        next error("A delivery zone's distance must be a whole number of metres") unless distance.is_a?(Integer)
        next error("A delivery zone's fee must be a whole number of centavos") unless fee.is_a?(Integer)

        { max_distance_m: distance, fee_cents: fee }
      end
    end

    # nil keeps the listing's price as it is. Only gear and transfers have one (Category#flat_priced?).
    def flat_rate_for(category)
      value = @params[:flat_rate]
      return nil if value.nil?
      return error("Only gear or a transfer has a flat price") if category && !category.flat_priced?
      return error("Flat rate must be an object") unless value.respond_to?(:key?)

      price = value[:price_cents]
      return error("Price must be a whole number of centavos above 0") unless price.is_a?(Integer) && price.positive?

      { price_cents: price }
    end

    def driving_for(value)
      return VehicleRate.column_defaults["driving"] if value.nil?
      return value if VehicleRate::DRIVING.include?(value)

      error("Driving must be one of #{VehicleRate::DRIVING.join(', ')}")
    end

    # nil keeps the listing's fees as they are; an array replaces them, in its order.
    def fees
      value = @params[:fees]
      return nil if value.nil?
      return error("Fees must be a list") unless value.is_a?(Array)
      return error("A listing can have at most #{MAX_FEES} fees") if value.size > MAX_FEES

      fees = value.each_with_index.map { |fee, index| fee_values(fee, index + 1) }
      names = fees.filter_map { _1[:name]&.downcase }
      error("Each fee needs a different name") if names.uniq.size < names.size
      fees
    end

    def fee_values(fee, position)
      return error("Each fee must be an object") || {} unless fee.respond_to?(:key?)

      name = fee[:name].is_a?(String) ? fee[:name].strip.presence : nil
      error("Each fee needs a name") unless name
      error("A fee's name can be at most 60 characters") if name && name.length > 60
      amount = fee[:amount_cents]
      error("Fee amount must be a whole number of centavos, 0 or more") unless amount.is_a?(Integer) && amount >= 0
      charged_per = fee[:charged_per]
      unless ListingFee::CHARGED_PER.key?(charged_per)
        error("Fees are charged per #{ListingFee::CHARGED_PER.keys.to_sentence(two_words_connector: ' or ', last_word_connector: ' or ')}")
      end
      required = fee[:required].nil? ? true : fee[:required]
      error("Whether a fee is required must be true or false") unless [ true, false ].include?(required)
      { name:, amount_cents: amount, charged_per:, required:, position: }
    end

    # Each message once: several fees can have the same problem.
    def error(message)
      @errors << message unless @errors.include?(message)
      nil
    end
  end
end
