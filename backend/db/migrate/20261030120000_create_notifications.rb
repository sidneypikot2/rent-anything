# Notifications: one row per person for something they should know about (a booking request,
# an answer, a payment, a reminder), shown in the app's bell and, for some kinds, emailed.
# `params` holds the few values its wording needs, so the wording can change without touching
# old rows. `dedupe_key` stops a reminder being sent twice for the same deadline.
class CreateNotifications < ActiveRecord::Migration[8.1]
  def change
    create_table :notifications do |t|
      t.references :recipient, null: false, foreign_key: { to_table: :users, on_delete: :cascade }, index: false
      t.string :kind, null: false
      t.references :subject, polymorphic: true, null: false
      t.jsonb :params, null: false, default: {}
      t.string :dedupe_key
      t.datetime :read_at
      t.timestamps
    end
    add_index :notifications, %i[recipient_id created_at]
    add_index :notifications, :recipient_id, where: "read_at IS NULL", name: "index_notifications_unread"
    add_index :notifications, %i[recipient_id kind subject_type subject_id dedupe_key], unique: true,
      where: "dedupe_key IS NOT NULL", name: "index_notifications_dedupe"
    add_check_constraint :notifications, "char_length(kind) <= 60", name: "notifications_kind_length_check"
  end
end
