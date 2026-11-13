# WebP photo sizes (RAA-240): which format a photo's card and large sizes were saved in. NULL
# for a photo sized before WebP, whose sizes are in its original's format (or one not sized
# yet), so its keys stay what they were until ResizeJob gives it WebP sizes.
class AddVersionsContentTypeToPhotos < ActiveRecord::Migration[8.1]
  TABLES = %i[listing_photos area_photos landmark_photos business_photos business_logos].freeze

  def change
    TABLES.each do |table|
      add_column table, :versions_content_type, :string
      add_check_constraint table, "versions_content_type IN ('image/jpeg', 'image/png', 'image/webp')",
        name: "#{table}_versions_content_type_check"
    end
  end
end
