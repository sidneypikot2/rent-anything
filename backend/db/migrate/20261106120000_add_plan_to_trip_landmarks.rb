# Review your trip (RAA-262): how a guest means to see a place they picked. `own` is going
# themselves on `visit_on`, `skip` is leaving it out of this trip, and no plan is undecided, or
# covered when a tour in the trip stops there (that comes from the trip's items).
class AddPlanToTripLandmarks < ActiveRecord::Migration[8.1]
  def change
    add_column :trip_landmarks, :plan, :string
    add_column :trip_landmarks, :visit_on, :date
    add_check_constraint :trip_landmarks, "plan IN ('own', 'skip')", name: "trip_landmarks_plan_check"
    add_check_constraint :trip_landmarks, "(visit_on IS NOT NULL) = (plan IS NOT DISTINCT FROM 'own')",
      name: "trip_landmarks_visit_on_check"
  end
end
