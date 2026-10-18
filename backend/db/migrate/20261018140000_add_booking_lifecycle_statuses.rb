# The booking lifecycle (RAA-132): requested → accepted → awaiting_payment → confirmed →
# in_progress → completed, with declined and expired beside cancelled. A value added to a
# Postgres enum can't be used in the transaction that adds it, so the columns and indexes
# that read these come in the next migration.
class AddBookingLifecycleStatuses < ActiveRecord::Migration[8.1]
  def up
    %w[requested accepted awaiting_payment in_progress completed declined expired].each do |status|
      add_enum_value :booking_status, status, if_not_exists: true
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration, "Postgres can't drop an enum value"
  end
end
