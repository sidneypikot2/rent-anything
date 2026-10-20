# The team answers booking requests on partners' behalf for launch (RAA-141): an answer from
# /admin is recorded with actor "admin" and the admin's user.
class AllowAdminBookingEventActor < ActiveRecord::Migration[8.1]
  def change
    remove_check_constraint :booking_events, "actor::text = ANY (ARRAY['guest'::character varying, 'partner'::character varying, 'system'::character varying]::text[])",
      name: "booking_events_actor_check"
    add_check_constraint :booking_events, "actor IN ('guest', 'partner', 'system', 'admin')", name: "booking_events_actor_check"
  end
end
