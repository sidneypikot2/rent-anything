module Listings
  # Reading a water activity's details and offers from a listing body (RAA-270), for
  # ListingValues. `activity` is how it is sold, when it runs and its offers: required on a new
  # water activity or a listing made one, replaced when sent, kept when left out, refused for any
  # other category and dropped when the listing stops being one. An offer sent with the id of
  # one of the listing's current offers changes it in place; one sent without makes a new one;
  # a current offer left out is archived, never deleted, so a booking made with it keeps it.
  module ActivityValues
    TIME_LABEL = "on the hour or half hour".freeze

    private

    def activity_for(category)
      value = @params[:activity]
      water = category&.water_activity?
      if value.nil?
        return error("Activity details are required for a water activity") if water && !@listing&.activity_detail

        return nil
      end
      return error("Only water activities have activity details") if category && !water
      return error("Activity details must be an object") unless value.respond_to?(:key?)

      detail = activity_detail(value)
      { detail:, offers: activity_offers(value[:offers], detail[:schedule] == "open_hours" && detail) }
    end

    def save_activity!(listing)
      unless listing.category.water_activity?
        listing.activity_detail&.destroy!
        listing.activity_offers.current.update_all(archived_at: Time.current, updated_at: Time.current)
        return
      end
      return if @activity.nil?

      (listing.activity_detail || listing.build_activity_detail).update!(@activity[:detail])
      save_offers!(listing, @activity[:offers])
    end

    # Archived ones step aside first, so a name they had is free for a new offer.
    def save_offers!(listing, offers)
      current = listing.activity_offers.current.index_by(&:id)
      kept = offers.filter_map { _1[:id] }
      unknown = kept - current.keys
      if unknown.any?
        listing.errors.add(:base, "An offer's id must be one of this listing's offers")
        raise ActiveRecord::RecordInvalid, listing
      end
      listing.activity_offers.where(id: current.keys - kept).update_all(archived_at: Time.current, updated_at: Time.current)
      # Renamed offers can swap names: clear them first, as the unique index checks each row.
      current.slice(*kept).each_value { _1.update_columns(name: "#{_1.id}~", updated_at: Time.current) }
      offers.each_with_index do |offer, position|
        attributes = offer.except(:id).merge(position:)
        offer[:id] ? current[offer[:id]].update!(attributes) : listing.activity_offers.create!(attributes)
      end
      listing.offers.reset
      listing.activity_offers.reset
    end

    def activity_detail(value)
      sold_by = value[:sold_by]
      error("How it's sold must be #{sentence(ActivityDetail::SOLD_BY)}") unless ActivityDetail::SOLD_BY.include?(sold_by)
      schedule = value[:schedule]
      unless ActivityDetail::SCHEDULES.include?(schedule)
        error("When it runs must be open hours or departures")
      end
      opens_at, closes_at = open_hours(value) if schedule == "open_hours"
      {
        sold_by:, schedule:, opens_at:, closes_at:,
        departure_times: schedule == "departures" ? departure_times(value[:departure_times]) : [],
        seats_per_unit: whole(value[:seats_per_unit], 1..ActivityDetail::MAX_SEATS, "Seats per unit"),
        min_age: value[:min_age].nil? ? nil : whole(value[:min_age], ActivityDetail::MIN_AGES, "Minimum age"),
        included: activity_text(value[:included], "What's included"),
        requirements: activity_text(value[:requirements], "What guests need")
      }
    end

    def open_hours(value)
      opens_at = value[:opens_at]
      closes_at = value[:closes_at]
      if [ opens_at, closes_at ].all? { half_hour?(_1) } && opens_at < closes_at
        [ opens_at, closes_at ]
      else
        error("Opening and closing times must be #{TIME_LABEL}, opening first")
      end
    end

    def departure_times(value)
      unless value.is_a?(Array) && value.size.between?(1, ActivityDetail::MAX_DEPARTURES) && value.all? { half_hour?(_1) }
        return error("Departure times must be 1 to #{ActivityDetail::MAX_DEPARTURES} times, each #{TIME_LABEL}") || []
      end

      value.uniq.sort
    end

    def activity_offers(value, open_hours)
      return [] if value.nil?
      return error("Offers must be a list") || [] unless value.is_a?(Array)
      if value.size > ActivityOffer::MAX_PER_LISTING
        return error("A water activity can have at most #{ActivityOffer::MAX_PER_LISTING} offers") || []
      end

      offers = value.filter_map { |offer| activity_offer(offer, open_hours) }
      names = offers.filter_map { _1[:name]&.downcase }
      error("Each offer can be listed once by name") if names.uniq.size < names.size
      offers
    end

    def activity_offer(offer, open_hours)
      return error("Each offer must be an object") unless offer.respond_to?(:key?)

      id = offer[:id]
      error("An offer's id must be a whole number") unless id.nil? || id.is_a?(Integer)
      name = offer[:name].is_a?(String) ? offer[:name].strip : nil
      unless name && ActivityOffer::NAME_LENGTH.cover?(name.length)
        name = error("Each offer needs a name of at most #{ActivityOffer::NAME_LENGTH.max} characters")
      end
      { id:, name:, duration_minutes: offer_duration(offer[:duration_minutes], name, open_hours),
        price_cents: offer_price(offer[:price_cents]) }
    end

    def offer_duration(value, name, open_hours)
      durations = ActivityOffer::DURATIONS
      unless value.is_a?(Integer) && durations.cover?(value) && (value % 5).zero?
        return error("An offer's length must be #{durations.min} to #{durations.max} minutes, in steps of 5")
      end

      if name && open_hours && open_hours[:closes_at]
        minutes = ActivityDetail.minutes(open_hours[:closes_at]) - ActivityDetail.minutes(open_hours[:opens_at])
        return error("#{name} is longer than the open hours") if value > minutes
      end

      value
    end

    def offer_price(value)
      return value if value.is_a?(Integer) && value.positive?

      error("An offer's price must be a whole number of centavos above 0")
    end

    def activity_text(value, label)
      return nil if value.nil?
      return error("#{label} must be text") unless value.is_a?(String)

      text = value.strip.presence
      return error("#{label} can be at most #{ActivityDetail::TEXT_LENGTH} characters") if text && text.length > ActivityDetail::TEXT_LENGTH

      text
    end

    def half_hour?(value)
      value.is_a?(String) && ActivityDetail::HALF_HOUR.match?(value)
    end
  end
end
