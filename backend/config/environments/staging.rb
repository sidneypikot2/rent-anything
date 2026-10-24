# Staging (the Lightsail instance, deploy/staging/) runs exactly as production does, under its
# own name, so Rails.env tells them apart: R2 photo folder, cache namespace, Action Cable
# prefix. Production is what main will run once it has a host. Put a staging-only difference
# below the require, and only one that production must not have.
require_relative "production"
