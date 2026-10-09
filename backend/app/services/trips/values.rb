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

    def integer_value(key, label, required: false, digits: false)
      value = @params[key]
      return value if value.is_a?(Integer)
      return Integer(value, 10) if digits && value.is_a?(String) && value.match?(/\A\d+\z/)
      return error("#{label} is required") if value.nil? && required

      error("#{label} must be a whole number") unless value.nil?
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
