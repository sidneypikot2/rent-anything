# A notification as the bell lists it (the `notification` schema in spec/swagger_helper.rb):
# its wording and link (Notifications::Copy), whether it was read, and when it came.
module NotificationSerializer
  def self.call(notification)
    copy = Notifications::Copy.call(notification)
    {
      id: notification.id,
      kind: notification.kind,
      title: copy[:title],
      body: copy[:body],
      path: copy[:path],
      read: notification.read?,
      created_at: notification.created_at
    }
  end
end
