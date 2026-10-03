class ApplicationController < ActionController::API
  # Sets ActiveStorage::Current.url_options from the request; only auto-wired for
  # ActionController::Base. Listing photo URLs need it.
  include ActiveStorage::SetCurrent

  rescue_from ActiveRecord::RecordNotFound, with: :render_not_found
  rescue_from NotAuthorizedError, with: :render_forbidden
  rescue_from ActiveRecord::RecordInvalid, with: :render_unprocessable

  private

  def render_not_found
    render json: { error: "Not found" }, status: :not_found
  end

  def render_forbidden
    render json: { error: "Forbidden" }, status: :forbidden
  end

  def render_unprocessable(exception)
    render json: { errors: exception.record.errors.full_messages }, status: :unprocessable_content
  end
end
