# Records the app needs to run. Idempotent: `bin/rails db:seed` can run any number of times.

# Admin accounts are never self-made (sign-up only makes guests and partners), so
# development gets one here. Production admins are created by hand at launch (M8).
if Rails.env.development?
  password = ENV.fetch("ADMIN_PASSWORD", "admin-password")
  User.find_or_create_by!(email: "admin@rent-anything.test") do |admin|
    admin.name = "Admin"
    admin.role = "admin"
    admin.password = password
    puts "Created admin@rent-anything.test with password #{password.inspect}"
  end
end
