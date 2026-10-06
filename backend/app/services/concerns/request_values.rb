# Reading values from a request without coercing them (backend.md): a missing or
# wrong-typed value adds a message to @errors, and the service raises RecordInvalid once
# it has read everything. Shared by the services that take an address: the profiles
# (RAA-40) and listings (RAA-41), so an address means the same thing in both.
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
end
