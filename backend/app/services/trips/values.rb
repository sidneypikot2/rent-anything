module Trips
  # Reading trip and trip-item fields from a request (RAA-64), without coercion
  # (backend.md): dates are ISO 8601 strings ("2026-11-12"), ids and counts are integers.
  # A query string carries everything as text, so the suggestion's listing_id may also be a
  # string of digits. Each service raises RecordInvalid once it has read everything.
  module Values
    include RequestValues

    private

    # A date not sent keeps its current value, so a change can send just the new end date.
    def read_dates(record_label, current = [ nil, nil ])
      from = @params.key?(:starts_on) ? date_value(:starts_on, "Start date") : current.first
      to = @params.key?(:ends_on) ? date_value(:ends_on, "End date") : current.last
      error("#{record_label} needs both dates or neither") if from.nil? != to.nil? && @errors.empty?
      [ from, to ]
    end

    def dates_sent?
      @params.key?(:starts_on) || @params.key?(:ends_on)
    end

    def date_value(key, label)
      value = @params[key]
      return if value.nil?

      (value.is_a?(String) && Date.iso8601(value)) || error("#{label} must be a date")
    rescue Date::Error
      error("#{label} must be a date like 2026-11-12")
    end

    def required_date(key, label)
      return error("#{label} is required") if @params[key].blank?

      date_value(key, label)
    end

    def integer_value(key, label, required: false, digits: false)
      value = @params[key]
      return value if value.is_a?(Integer)
      return Integer(value, 10) if digits && value.is_a?(String) && value.match?(/\A\d+\z/)
      return error("#{label} is required") if value.nil? && required

      error("#{label} must be a whole number") unless value.nil?
    end

    # A count of people or pets (RAA-182), from 0 to `max`; nil when not sent.
    def count_value(key, label, max:, digits: false)
      value = integer_value(key, label, digits:)
      return value if value.nil? || value.between?(0, max)

      error("#{label} must be from 0 to #{max}")
    end

    # A stay's split into rooms (RAA-182): 1 to 99 rooms, each { adults, children, infants }
    # of whole numbers from 0 to 99, 0 when left out (Stays::Arrangement wants an adult in each). A query string
    # carries it as JSON text (json: true). Nil when not sent or sent as null.
    def room_guests_value(json: false)
      value = @params[:room_guests]
      value = JSON.parse(value) if json && value.is_a?(String)
      return if value.nil?

      rooms = value.is_a?(Array) && value.map { |room| room.respond_to?(:to_unsafe_h) ? room.to_unsafe_h : room }
      if rooms && rooms.size.between?(1, 99) && rooms.all? { room_guests_room?(_1) }
        rooms.map { |room| Stays::Arrangement::KINDS.to_h { |kind| [ kind.to_s, room[kind.to_s] || room[kind] || 0 ] } }
      else
        error("Rooms must be a list of 1 to 99 rooms, each with adults, children and infants")
      end
    rescue JSON::ParserError
      error("Rooms must be a list of 1 to 99 rooms, each with adults, children and infants")
    end

    def room_guests_room?(room)
      room.is_a?(Hash) && (room.keys.map(&:to_s) - %w[adults children infants]).empty? &&
        room.values.all? { _1.is_a?(Integer) && _1.between?(0, 99) }
    end

    # The guests (an item's quantity, a booking's guests) once a split into rooms is sent:
    # what its rooms add up to, which a number sent with it must agree with.
    def guests_for(room_guests, guests, sent:)
      return guests unless room_guests

      total = room_guests.sum { _1.values.sum }
      error("Guests must be what the rooms add up to (#{total})") if sent && guests != total
      total
    end

    # A split into rooms or pets (RAA-182) is for a stay, and must fit it (Stays::Arrangement).
    def check_stay_party(listing, guests, room_guests, pets)
      return if room_guests.nil? && pets.zero?
      return error("Only a stay can be split into rooms or take pets") unless listing.category.accommodation?
      return error(Stays::Arrangement.pets_refusal(listing, pets)) unless room_guests

      Stays::Arrangement.new(listing, **Stays::Arrangement.party_of(room_guests), room_guests:, pets:).errors.each { error(_1) }
    end

    # How many vehicles a rental vehicle's guests take (RAA-191): at least enough seats for them,
    # at most one each, and never more people than the whole fleet seats. Units sent for anything
    # but a vehicle with seats are refused. Nil leaves them derived (Booking.units_for).
    def check_vehicle_units(listing, guests, units)
      seats = listing.vehicle_seats
      return error("Only a vehicle can be booked by how many") if units && !seats
      return unless seats

      noun = Values.vehicle_noun(listing)
      fleet = listing.units.size
      return error("This #{noun} seats #{seats}. #{fleet} of them seat #{seats * fleet} at most.") if guests > seats * fleet
      return unless units

      needed = guests.fdiv(seats).ceil
      error("#{guests} people need at least #{needed} #{noun.pluralize(needed)}") if units < needed
      error("#{units} #{noun.pluralize(units)} is more than one each for #{guests}") if units > guests
    end

    # A vehicle rental's pickup time (RAA-195): "08:30", one of the shop's (VehicleRate#pickup_times).
    # Nil when not sent or sent as null, which takes the shop's default.
    def pickup_time_value(listing)
      value = @params[:pickup_time]
      return if value.nil?
      return error("Only a vehicle rental has a pickup time") unless listing.category.vehicle?
      unless value.is_a?(String) && value.match?(Booking::PICKUP_TIME_FORMAT)
        return error("Pickup time must be a time on the half hour, like 08:30")
      end

      times = listing.vehicle_rate&.pickup_times
      return error("Pickup is from #{times.first} to #{times.last}") if times && !times.include?(value)

      value
    end

    DELIVERY_KEYS = %i[delivery return_pickup delivery_address delivery_location delivery_notes].freeze
    NO_DELIVERY = { delivery: false, return_pickup: false, delivery_address: nil, delivery_location: nil,
                    delivery_distance_m: nil, delivery_notes: nil }.freeze

    # A vehicle rental's delivery and pick-up (RAA-195): delivery (brought to the guest) and
    # return_pickup (collected from them at the end), each only where the shop offers it, to the
    # guest's pin (delivery_location, { lat, lng }) within the shop's farthest zone (RAA-205),
    # with the address it is at and notes for the rider; all of them required with either, but
    # the notes, and dropped without. Fields not sent keep `current`'s; none sent is {}. A query
    # string carries the booleans as "true" / "false" and the pin's lat and lng as text. A price
    # (address: false) needs neither address nor pin, and a pin out of reach is Price's to refuse.
    def delivery_values(listing, current = {}, address: true)
      return {} unless DELIVERY_KEYS.any? { @params.key?(_1) }

      refused = @errors.size
      delivery = boolean_value(:delivery, "Delivery", current.fetch(:delivery, false))
      return_pickup = boolean_value(:return_pickup, "Pick-up", current.fetch(:return_pickup, false))
      place = text_value(:delivery_address, "The address", current[:delivery_address])
      notes = text_value(:delivery_notes, "The notes", current[:delivery_notes])
      unread = @errors.size
      point = @params.key?(:delivery_location) ? delivery_point(text: !address) : current[:delivery_location]
      pin_refused = @errors.size > unread
      return NO_DELIVERY.dup unless delivery || return_pickup
      return error("Only a vehicle rental can be delivered or picked up") unless listing.category.vehicle?

      rate = listing.vehicle_rate
      error("This shop doesn't deliver") if delivery && !rate&.delivers?
      error("This shop doesn't pick up at the end") if return_pickup && !rate&.picks_up?
      error("Add the address for the delivery or pick-up") if place.nil? && address
      error("Drop a pin where the rider meets you") if point.nil? && address && !pin_refused
      error("The address must be 200 characters or fewer") if place && place.length > 200
      error("The notes must be 200 characters or fewer") if notes && notes.length > 200
      distance = point && listing.distance_m_to(point)
      if address && distance && @errors.size == refused && rate.handover_fee_for(distance).nil?
        error(Trips::Values.out_of_reach(rate))
      end
      { delivery:, return_pickup:, delivery_address: place, delivery_location: point, delivery_distance_m: distance,
        delivery_notes: notes }
    end

    def self.out_of_reach(rate)
      km = rate.max_delivery_m.to_i / 1000.0
      "This shop doesn't deliver here: it delivers up to #{km % 1 == 0 ? km.to_i : km.round(1)} km away"
    end

    # A trimmed text field, or `current` when not sent; nil when blank.
    def text_value(key, label, current)
      value = @params.key?(key) ? @params[key] : current
      return value&.strip.presence if value.nil? || value.is_a?(String)

      error("#{label} must be text")
    end

    # The guest's pin as WKT, from numbers (or, in a query string, text that is a number).
    def delivery_point(text:)
      value = @params[:delivery_location]
      return nil if value.nil?
      return error("The delivery pin must have a lat and lng") unless value.respond_to?(:key?)

      lat, lng = [ value[:lat], value[:lng] ].map do |part|
        text && part.is_a?(String) && part.match?(/\A-?\d+(\.\d+)?\z/) ? part.to_f : part
      end
      lat = coordinate(lat, 90, "Latitude")
      lng = coordinate(lng, 180, "Longitude")
      "POINT(#{lng} #{lat})" if lat && lng
    end

    # Child helmets for a motorcycle rental (RAA-205): 0 to 99, any but 0 only where the shop
    # offers them; nil when not sent. A query string carries it as digits.
    def child_helmets_value(listing, digits: false)
      helmets = count_value(:child_helmets, "Child helmets", max: 99, digits:)
      return helmets unless helmets&.positive?
      return error("This shop doesn't offer child helmets") unless listing.vehicle_rate&.child_helmets?

      helmets
    end

    # One child helmet at most for each vehicle: a motorbike takes one child.
    def check_child_helmets(helmets, units)
      error("Child helmets can't be more than the vehicles (#{units})") if helmets && units && helmets > units
    end

    def boolean_value(key, label, default)
      return default unless @params.key?(key)

      value = @params[key]
      return value if [ true, false ].include?(value)
      return value == "true" if %w[true false].include?(value)

      error("#{label} must be true or false")
    end

    # Units sent for an item (RAA-191): 1 to 99, or nil when not sent or sent as null.
    def units_value
      units = integer_value(:units, "Units")
      return units if units.nil? || units.between?(1, 99)

      error("Units must be from 1 to 99")
    end

    # What one of a vehicle listing's units is called, for refusals: "motorbike", "car", "van".
    def self.vehicle_noun(listing)
      { "motorcycle" => "motorbike", "van-rental" => "van" }.fetch(listing.category.slug, listing.category.name.downcase)
    end

    # digits: from a query string, where every value is text.
    def find_listing(digits: false)
      id = integer_value(:listing_id, "Listing", required: true, digits:)
      id && (Listing.active.find_by(id:) || error("That listing isn't available to book"))
    end

    def error(message)
      @errors << message if message
      nil
    end

    def raise_errors!(record)
      return if @errors.empty?

      @errors.each { |message| record.errors.add(:base, message) }
      raise ActiveRecord::RecordInvalid, record
    end
  end
end
