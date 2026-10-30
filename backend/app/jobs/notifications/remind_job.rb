module Notifications
  # Reminders before booking deadlines (Notifications::Remind). Every 15 minutes, from
  # config/recurring.yml.
  class RemindJob < ApplicationJob
    queue_as :default

    def perform
      Notifications::Remind.call
    end
  end
end
