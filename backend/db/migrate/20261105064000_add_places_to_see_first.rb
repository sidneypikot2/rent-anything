# Places to see first (RAA-257): the team's must-see flag, where a boat-only place's boats leave
# from (a place with this pin is reached by boat tour only), and a destination's port.
class AddPlacesToSeeFirst < ActiveRecord::Migration[8.1]
  def change
    add_column :landmarks, :must_see, :boolean, default: false, null: false
    add_column :landmarks, :boat_departure, :st_point, geographic: true, srid: 4326
    add_index :landmarks, :boat_departure, using: :gist

    add_column :areas, :port_name, :string
    add_column :areas, :port_location, :st_point, geographic: true, srid: 4326
  end
end
