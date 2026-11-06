module Trips
  # A guest says how they mean to see a place they saved to a trip (PATCH /trip_landmarks/:id,
  # RAA-262): `own` on `visit_on`, a day of the trip; `skip`; or null to leave it undecided.
  # A rental never decides this, and a tour needs no plan: a tour in the trip covers the place
  # by stopping there. Another guest's saved place is a 404. Returns the trip.
  class PlanLandmark < ApplicationService
    include Values

    def initialize(user, id, params)
      @user = user
      @id = id
      @params = params
      @errors = []
    end

    def call
      saved = TripLandmark.joins(:trip).where(trips: { user_id: @user.id }).find(@id)
      plan = plan_value
      visit_on = plan == "own" ? visit_day(saved.trip) : nil
      raise_errors!(saved)

      saved.update!(plan:, visit_on:)
      saved.trip
    end

    private

    def plan_value
      return error("Plan is required") unless @params.key?(:plan)

      plan = @params[:plan]
      plan.nil? || TripLandmark::PLANS.include?(plan) ? plan : error("Plan must be own, skip or null")
    end

    def visit_day(trip)
      day = required_date(:visit_on, "Day")
      return day if day.nil? || (trip.dated? && day.between?(trip.starts_on, trip.ends_on))

      error("Pick a day within your trip")
    end
  end
end
