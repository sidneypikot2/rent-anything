module Api
  module V1
    # The signed-in user's notifications, for the bell (guests and partners alike): a page of
    # them (Notifications::List), marking one read, and marking them all read. Another user's
    # notification is a 404.
    class NotificationsController < ApplicationController
      before_action :authenticate_user!

      def index
        page = Notifications::List.call(current_user, before: params[:before])
        render json: page.merge(notifications: page[:notifications].map { NotificationSerializer.call(_1) })
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
