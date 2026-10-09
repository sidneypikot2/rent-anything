# Reading a place named in a request as { type, slug } (a listing as { type, id }), without
# coercing it (backend.md). Shared by the search event and admin services (RAA-60). A
# missing or wrong-typed value adds a message to @errors; finding the record is left to
# the caller, which decides whether an unknown one is a 404 or a 422.
module RequestPlaces
  # Request type => model.
  PLACE_TYPES = { "area" => "Area", "landmark" => "Landmark", "tag" => "Tag", "listing" => "Listing" }.freeze

  private

  # The place as [model name, lookup], e.g. ["Area", { slug: "moalboal" }], or nil after
  # adding an error.
  def place_key(value, label, types)
    unless value.respond_to?(:key?)
      @errors << "#{label} must be an object"
      return nil
    end

    type = value[:type]
    unless types.include?(type)
      @errors << "#{label} type must be one of #{types.join(', ')}"
      return nil
    end

    if type == "listing"
      id = value[:id]
      return [ PLACE_TYPES[type], { id: } ] if id.is_a?(Integer)

      @errors << "#{label} id must be a whole number"
    else
      slug = value[:slug]
      return [ PLACE_TYPES[type], { slug: } ] if slug.is_a?(String) && slug.present?

      @errors << "#{label} slug is required"
    end
    nil
  end

  # A request string of 2 to 100 characters, stripped.
  def term_param(value, label)
    return value.strip if value.is_a?(String) && value.strip.length.between?(2, 100)

    @errors << "#{label} must be 2 to 100 characters"
    nil
  end

  def raise_if_invalid!
    request = RequestErrors.new(@errors)
    raise ActiveRecord::RecordInvalid, request if request.invalid?
  end

  # Request errors as a model, so they are a RecordInvalid (422) like any other.
  RequestErrors = Struct.new(:messages) do
    include ActiveModel::Validations

    validate { messages.each { |message| errors.add(:base, message) } }
  end

  # The API's name for a model's type: "area" for Area.
  def place_type(record)
    PLACE_TYPES.key(record.class.name)
  end

  def place_json(record)
    { type: place_type(record), slug: record.slug, name: record.name }
  end
end
