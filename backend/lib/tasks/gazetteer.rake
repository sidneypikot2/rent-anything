# The gazetteer (RAA-59): areas from the PSA's PSGC and OCHA's COD-AB boundaries. The data
# files and where they come from are in db/gazetteer/README.md.
namespace :gazetteer do
  desc "Import or update every region, province, city and town, then the curated islands (new ones as drafts)"
  task import: :environment do
    summary = Gazetteer::Import.call
    puts "Gazetteer: #{summary[:created]} areas added, #{summary[:updated]} updated, #{summary[:islands]} islands built"
  end

  desc "Publish areas and every area above them: SLUGS=moalboal,badian"
  task publish: :environment do
    slugs = ENV.fetch("SLUGS") { abort "Usage: bin/rails gazetteer:publish SLUGS=moalboal,badian" }.split(",").map(&:strip)
    areas = Area.where(slug: slugs).to_a
    missing = slugs - areas.map(&:slug)
    abort "No area with slug: #{missing.join(", ")}" if missing.any?

    areas.each(&:publish!)
    puts "Published #{slugs.join(", ")} and the areas above them"
  end
end
