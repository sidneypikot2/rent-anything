# Base class for service objects: plain Ruby objects with one public entry point.
# Subclasses implement #call (and an #initialize for whatever it needs); callers use
# the class method, e.g. Auth::SessionIssuer.call(user).
class ApplicationService
  def self.call(...)
    new(...).call
  end

  private

  # Request values keep their JSON type (ApplicationController#request_values), so a hash or
  # array where a string belongs is a 422 here rather than being stringified or dropped.
  # Keys in `present` must also be non-blank.
  def require_strings!(record, values, present: [])
    values.each do |key, value|
      record.errors.add(key, "must be a string") unless value.nil? || value.is_a?(String)
    end
    present.each do |key|
      # A string message: the :blank symbol reads the attribute, which `key` needn't be.
      record.errors.add(key, "can't be blank") if values[key].blank? && !record.errors.include?(key)
    end
    raise ActiveRecord::RecordInvalid, record if record.errors.any?
  end
end
