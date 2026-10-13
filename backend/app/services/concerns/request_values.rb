# Reading values from a request without coercing them (backend.md): a missing or
# wrong-typed value adds a message to @errors, and the service raises RecordInvalid once
# it has read everything. Shared by the services that take an address: the profiles
# (RAA-40), listings (RAA-41) and businesses (RAA-100), so an address and a map pin mean
# the same thing in each.
module RequestValues
  ADDRESS = { street: "Street", city: "City", region: "Region", postal_code: "ZIP code", country: "Country" }.freeze

  private

  def required_string(source, key, label)
    value = source[key]
    return value.strip if value.is_a?(String) && value.present?

    @errors << "#{label} is required"
    nil
  end

  def optional_string(source, key, label)
    value = source[key]
    return nil if value.nil?
    return value.strip.presence if value.is_a?(String)

    @errors << "#{label} must be text"
    nil
  end

  # A full address: every field required but the province, which is empty where there is
  # none (Metro Manila, many countries) and stored as nil.
  def address_attributes(address)
    unless address.respond_to?(:key?)
      @errors << "Address must be an object"
      address = {}
    end
    ADDRESS.to_h { |key, label| [ key, required_string(address, key, label) ] }
      .merge(province: optional_string(address, :province, "Province"))
  end

  # A map pin, { lat:, lng: }, as a WKT point (longitude first).
  def point_from(location)
    unless location.respond_to?(:key?)
      @errors << "Location is required"
      return nil
    end

    lat = coordinate(location[:lat], 90, "Latitude")
    lng = coordinate(location[:lng], 180, "Longitude")
    "POINT(#{lng} #{lat})" if lat && lng
  end

  def coordinate(value, limit, label)
    return value if value.is_a?(Numeric) && value.between?(-limit, limit)

    @errors << "#{label} must be a number between -#{limit} and #{limit}"
    nil
  end
end
