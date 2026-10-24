namespace :photos do
  # RAA-172: staging ran as RAILS_ENV=production, so its photos sit under production/ in R2.
  # Keys are built from the env name, never stored, so they must be copied to staging/.
  desc "Copy photos from one R2 root to another: FROM=production TO=staging (skips keys already there)"
  task copy_root: :environment do
    from = ENV.fetch("FROM") { abort "Usage: bin/rails photos:copy_root FROM=production TO=staging" }
    to = ENV.fetch("TO") { abort "Usage: bin/rails photos:copy_root FROM=production TO=staging" }
    abort "R2_BUCKET is blank: this copies inside the R2 bucket" if ENV["R2_BUCKET"].blank?

    result = PhotoStorage.copy_root(from:, to:)
    puts "Copied #{result[:copied]}, skipped #{result[:skipped]} already in #{to}/"
  end
end
