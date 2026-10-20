# Admins (RAA-141) are made by hand: Auth::GrantAdmin says why this isn't a role change.
namespace :admin do
  desc "Make an admin: EMAIL=you@example.com [PASSWORD=...] (by default the password of an account with that email)"
  task grant: :environment do
    email = ENV.fetch("EMAIL") { abort "Usage: bin/rails admin:grant EMAIL=you@example.com [PASSWORD=...]" }
    admin = Auth::GrantAdmin.call(email:, password: ENV["PASSWORD"].presence)
    puts "#{admin.email} is an admin (user #{admin.id}): sign in at /admin"
  rescue ActiveRecord::RecordInvalid => e
    abort e.record.errors.full_messages.to_sentence
  end
end
