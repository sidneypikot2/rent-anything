class ApplicationController < ActionController::API
  # Sets ActiveStorage::Current.url_options from the request; only auto-wired for
  # ActionController::Base. Listing photo URLs need it.
  include ActiveStorage::SetCurrent
  include Authentication

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from NotAuthorizedError, with: :render_forbidden
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable
  rescue_from ActionController::ParameterMissing, with: :render_parameter_missing

  private

  # The request's values for `keys` (under `scope` when given), keeping their JSON types:
  # unlike `permit`, a hash where a string belongs is kept, so the service can make it a
  # 422 (ApplicationService#require_strings!) instead of it silently vanishing.
  def request_values(*keys, scope: nil)
    values = scope ? params[scope] : params
    raise ActionController::ParameterMissing, scope unless values.is_a?(ActionController::Parameters)

    values.to_unsafe_h.slice(*keys).symbolize_keys
  end

  def render_not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def render_forbidden
    render json: { error: "Forbidden" }, status: :forbidden
  end

  def render_unprocessable(exception)
    render json: { errors: exception.record.errors.full_messages }, status: :unprocessable_content
  end

  def render_parameter_missing(exception)
    render json: { errors: [ exception.message ] }, status: :unprocessable_content
  end
end
