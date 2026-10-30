module Api
  module V1
    # The signed-in user's notifications, for the bell (guests and partners alike): newest
    # first, PAGE_SIZE at a time (`before` the last id seen), with how many are unread;
    # marking one read, and marking them all read. Another user's notification is a 404.
    class NotificationsController < ApplicationController
      PAGE_SIZE = 20

      before_action :authenticate_user!

      def index
        scope = current_user.notifications.newest_first
        if params.key?(:before)
          before = Integer(params[:before], 10, exception: false)
          return render json: { errors: [ "before must be a notification id" ] }, status: :unprocessable_content unless before

          scope = scope.where(id: ...before)
        end
        page = scope.limit(PAGE_SIZE + 1).to_a
        more = page.size > PAGE_SIZE
        page = page.first(PAGE_SIZE)
        render json: {
          notifications: page.map { NotificationSerializer.call(_1) },
          unread_count: current_user.notifications.unread.count,
          next_before: more ? page.last.id : nil
        }
      end

      def read
        notification = current_user.notifications.find(params[:id])
        notification.update!(read_at: Time.current) unless notification.read?
        render json: NotificationSerializer.call(notification)
      end

      def read_all
        current_user.notifications.unread.update_all(read_at: Time.current, updated_at: Time.current)
        render json: { unread_count: 0 }
      end
    end
  end
end
