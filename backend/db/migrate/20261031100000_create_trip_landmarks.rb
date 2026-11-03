# Saved places (trip_landmarks): a place to see a guest wants to go to, kept on one of their
# trips with no dates or price. Never booked or sent to a partner; the plan suggests the
# tours that go there.
class CreateTripLandmarks < ActiveRecord::Migration[8.1]
  def change
    create_table :trip_landmarks do |t|
      t.references :trip, null: false, foreign_key: { on_delete: :cascade }, index: false
      t.references :landmark, null: false, foreign_key: { on_delete: :cascade }
      t.timestamps
    end
    add_index :trip_landmarks, %i[trip_id landmark_id], unique: true
  end
end
