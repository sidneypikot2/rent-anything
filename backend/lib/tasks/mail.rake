namespace :mail do
  desc "Send a test email to check the SMTP set-up: TO=you@example.com"
  task test: :environment do
    to = ENV.fetch("TO") { abort "Usage: bin/rails mail:test TO=you@example.com" }
    # deliver_now, not deliver_later: an SMTP error shows up here instead of in a job.
    SystemMailer.test_email(to:).deliver_now
    puts "Sent to #{to} via #{ActionMailer::Base.delivery_method} (#{ENV['SMTP_ADDRESS'].presence || 'no SMTP_ADDRESS'})"
  end
end
