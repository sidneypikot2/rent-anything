module Notifications
  # A page of a user's notifications for the bell: newest first, PAGE_SIZE at a time, older
  # than `before` (the last page's `next_before`) when given, with how many are unread.
  # A `before` that isn't an id is a 422.
  class List < ApplicationService
    PAGE_SIZE = 20

    def initialize(user, before: nil)
      @user = user
      @before = before
    end

    def call
      scope = @user.notifications.newest_first
      scope = scope.where(id: ...cursor) unless @before.nil?
      page = scope.limit(PAGE_SIZE + 1).to_a
      more = page.size > PAGE_SIZE
      page = page.first(PAGE_SIZE)
      { notifications: page, unread_count: @user.notifications.unread.count, next_before: more ? page.last.id : nil }
    end

    private

    def cursor
      id = Integer(@before, 10, exception: false) if @before.is_a?(String) || @before.is_a?(Integer)
      return id if id

      notification = Notification.new
      notification.errors.add(:base, "before must be a notification id")
      raise ActiveRecord::RecordInvalid, notification
    end
  end
end
