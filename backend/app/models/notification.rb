# Something a user should know about (a booking request, an answer, a payment, a reminder):
# one row per recipient, made by Notifications::Notify and listed in the app's bell. Its
# wording and link come from Notifications::Copy, from `kind` and `params`, so old rows read
# with today's wording.
class Notification < ApplicationRecord
  belongs_to :recipient, class_name: "User", inverse_of: :notifications
  belongs_to :subject, polymorphic: true

  validates :kind, inclusion: { in: -> { Notifications::Copy::KINDS } }

  scope :unread, -> { where(read_at: nil) }
  scope :newest_first, -> { order(id: :desc) }

  def read?
    read_at.present?
  end
end
