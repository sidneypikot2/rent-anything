module Listings
  # Reading a tour's details and a listing's blocked dates from a listing body (RAA-110), for
  # ListingValues. `tour` is a tour's type, group size, duration, schedule, base price and
  # inclusions: required on a new tour or a listing made one, replaced whole when sent, kept
  # when left out, refused for any other category and dropped when the listing stops being a
  # tour. `blocked_dates`, for any listing, replace its blocks when sent and keep them when
  # left out. Dates are "YYYY-MM-DD" strings, today or later; one the listing already has may
  # be sent back once it is past, as the response stopped showing it only at midnight.
  module TourValues
    MAX_DATES = 366
    DATE = /\A\d{4}-\d{2}-\d{2}\z/

    private

    def tour_for(category)
      value = @params[:tour]
      tour = category&.tour?
      if value.nil?
        return error("Tour details are required for a tour") if tour && !@listing&.tour_detail

        return nil
      end
      return error("Only tours have tour details") if category && !tour
      return error("Tour details must be an object") unless value.respond_to?(:key?)

      type = value[:tour_type]
      error("Tour type must be private or joiner") unless TourDetail::TOUR_TYPES.include?(type)
      dates = tour_dates(value[:dates])
      weekdays = weekdays(value[:weekdays])
      error("A tour must run on at least one weekday or date") if weekdays&.empty? && dates&.empty?
      min_guests = whole(value[:min_guests], 1..TourDetail::MAX_GUESTS, "Minimum guests")
      max_guests = whole(value[:max_guests], 1..TourDetail::MAX_GUESTS, "Maximum guests")
      if min_guests && max_guests && max_guests < min_guests
        error("Maximum guests can't be fewer than the minimum guests")
      end
      unit = duration_unit(value[:duration_unit])
      {
        detail: {
          tour_type: type, min_guests:, max_guests:,
          max_groups_per_day: whole(value[:max_groups_per_day], 1..TourDetail::MAX_GROUPS_PER_DAY, "Groups per day"),
          duration_value: duration_value(value[:duration_value], unit), duration_unit: unit,
          weekdays:, base_price_cents: base_price(value[:base_price_cents])
        },
        dates:,
        inclusions: inclusions(value[:inclusions], type)
      }
    end

    def save_tour!(listing)
      unless listing.category.tour?
        listing.tour_detail&.destroy!
        listing.tour_dates.delete_all
        listing.tour_inclusions.delete_all
        return
      end
      return if @tour.nil?

      detail = listing.tour_detail || listing.build_tour_detail
      detail.update!(@tour[:detail])
      listing.tour_dates.delete_all
      @tour[:dates].each { |date| listing.tour_dates.create!(date:) }
      listing.tour_inclusions.delete_all
      @tour[:inclusions].each { |inclusion| listing.tour_inclusions.create!(inclusion) }
      [ listing.tour_dates, listing.tour_inclusions ].each(&:reset)
    end

    def save_blocked_dates!(listing)
      return if @blocked_dates.nil?

      listing.availability_blocks.delete_all
      @blocked_dates.each { |block| listing.availability_blocks.create!(block) }
      listing.availability_blocks.reset
    end

    # nil keeps the listing's blocks; a list replaces them.
    def blocked_dates
      value = @params[:blocked_dates]
      return nil if value.nil?
      return error("Blocked dates must be a list") unless value.is_a?(Array)
      return error("A listing can have at most #{MAX_DATES} blocked dates") if value.size > MAX_DATES

      blocks = value.filter_map { |block| block_values(block) }
      overlap = blocks.sort_by { _1[:starts_on] }.each_cons(2).any? { |a, b| b[:starts_on] <= a[:ends_on] }
      error("Blocked dates can't overlap") if overlap
      blocks
    end

    def block_values(block)
      return error("Each blocked date must be an object") unless block.respond_to?(:key?)

      starts_on = date(block[:starts_on])
      ends_on = date(block[:ends_on])
      unless starts_on && ends_on
        return error("Each blocked date needs starts_on and ends_on dates (YYYY-MM-DD)")
      end
      return error("A blocked date can't end before it starts") if ends_on < starts_on
      if ends_on < Date.current && !saved_block?(starts_on, ends_on)
        return error("Blocked dates must end today or later")
      end

      reason = block[:reason]
      reason = reason.strip.presence if reason.is_a?(String)
      error("A blocked date's reason must be text") unless reason.nil? || reason.is_a?(String)
      if reason.is_a?(String) && reason.length > AvailabilityBlock::REASON_LENGTH
        error("A blocked date's reason can be at most #{AvailabilityBlock::REASON_LENGTH} characters")
      end
      { starts_on:, ends_on:, reason: reason.is_a?(String) ? reason : nil }
    end

    def tour_dates(value)
      unless value.is_a?(Array) && value.all? { date(_1) }
        return error("Tour dates must be a list of dates (YYYY-MM-DD)")
      end

      dates = value.map { date(_1) }.uniq.sort
      return error("A tour can have at most #{MAX_DATES} dates") if dates.size > MAX_DATES

      saved = @listing&.persisted? ? @listing.tour_dates.map(&:date) : []
      error("Tour dates must be today or later") if dates.any? { |day| day < Date.current && !saved.include?(day) }
      dates
    end

    def weekdays(value)
      unless value.is_a?(Array) && value.all? { TourDetail::WEEKDAYS.include?(_1) }
        return error("Weekdays must be a list of days, 0 (Sunday) to 6 (Saturday)")
      end

      value.uniq.sort
    end

    # At most one of each kind, its options in the order we offer them.
    def inclusions(value, type)
      return [] if value.nil?
      return error("Inclusions must be a list") || [] unless value.is_a?(Array)

      inclusions = value.filter_map { |inclusion| inclusion_values(inclusion, type) }
      kinds = inclusions.pluck(:kind)
      error("Each kind of inclusion can be listed once") if kinds.uniq.size < kinds.size
      inclusions
    end

    def inclusion_values(inclusion, type)
      return error("Each inclusion must be an object") unless inclusion.respond_to?(:key?)

      kind = inclusion[:kind]
      allowed = TourInclusion::KINDS[kind]
      return error("Inclusions are #{sentence(TourInclusion::KINDS.keys)}") unless allowed

      { kind:, options: inclusion_options(inclusion[:options], kind, allowed), note: inclusion_note(inclusion[:note]),
        price_per_head_cents: inclusion_price(inclusion[:price_per_head_cents], type) }
    end

    def inclusion_options(value, kind, allowed)
      label = kind.humanize
      return [] if value.nil? && allowed.empty?
      unless value.is_a?(Array) && (value - allowed).empty?
        return error(allowed.empty? ? "#{label} takes no options" : "#{label} options must be from #{sentence(allowed)}")
      end
      return error("#{label} must name at least one of #{sentence(allowed)}") if allowed.any? && value.empty?

      allowed & value
    end

    def inclusion_note(value)
      return nil if value.nil?
      return error("An inclusion's note must be text") unless value.is_a?(String)

      note = value.strip.presence
      if note && note.length > TourInclusion::NOTE_LENGTH
        error("An inclusion's note can be at most #{TourInclusion::NOTE_LENGTH} characters")
      end
      note
    end

    # A private tour's inclusions are add-ons priced per head (0 is free); a joiner tour's are
    # in its price.
    def inclusion_price(value, type)
      if type == "joiner"
        return 0 if value.nil? || value == 0

        return error("A joiner tour's inclusions are in its price: leave out their price per head")
      end
      return value if value.is_a?(Integer) && value >= 0

      error("A private tour's inclusions need a price per head: a whole number of centavos, 0 or more")
    end

    def base_price(value)
      return value if value.is_a?(Integer) && value.positive?

      error("Base price must be a whole number of centavos above 0")
    end

    def duration_value(value, unit)
      return error("Duration must be a whole number") unless value.is_a?(Integer)
      return error("Duration must be at least 1") if value < 1

      longest = TourDetail::DURATION_UNITS[unit]
      longest && value > longest ? error("Duration can be at most #{longest} #{unit}") : value
    end

    def duration_unit(value)
      TourDetail::DURATION_UNITS.key?(value) ? value : error("Duration unit must be hours or days")
    end

    def whole(value, range, label)
      return value if value.is_a?(Integer) && range.cover?(value)

      error("#{label} must be a whole number from #{range.min} to #{range.max}")
    end

    def date(value)
      return nil unless value.is_a?(String) && value.match?(DATE)

      Date.iso8601(value)
    rescue Date::Error
      nil
    end

    def saved_block?(starts_on, ends_on)
      @listing&.persisted? && @listing.availability_blocks.any? { _1.starts_on == starts_on && _1.ends_on == ends_on }
    end

    def sentence(words)
      words.to_sentence(two_words_connector: " or ", last_word_connector: " or ")
    end
  end
end
