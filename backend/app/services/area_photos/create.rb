module AreaPhotos
  # The team sets an area's banner photo (RAA-164), the way a partner adds a listing photo
  # (ListingPhotos::Create): the row first, then the browser PUTs the bytes to storage and
  # confirms with AreaPhotos::Update. An area has one banner, so a new one replaces the old,
  # whose files go after the commit.
  class Create < ApplicationService
    include PhotoUploadValues

    def initialize(area, params)
      @area = area
      @params = params
      @errors = []
    end

    def call
      photo = AreaPhoto.new(area: @area, **upload_attributes)
      if @errors.any?
        @errors.each { |message| photo.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, photo
      end

      @area.with_lock do
        AreaPhoto.find_by(area: @area)&.destroy!
        photo.save!
      end
      [ photo, upload_url(photo) ]
    end
  end
end
