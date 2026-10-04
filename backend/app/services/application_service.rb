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
  def require_strings!(record, values)
    values.each do |key, value|
      record.errors.add(key, "must be a string") unless value.nil? || value.is_a?(String)
    end
    raise ActiveRecord::RecordInvalid, record if record.errors.any?
  end
end
