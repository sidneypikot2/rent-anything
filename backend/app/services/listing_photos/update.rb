module ListingPhotos
  # A partner confirms a photo's upload (RAA-106): once its file is in storage, guests see it
  # and its sizes are made (ListingPhotos::ResizeJob). Sending it again is harmless, so a
  # browser that lost the answer can retry.
  class Update < ApplicationService
    def initialize(photo, params)
      @photo = photo
      @params = params
    end

    def call
      unless @params[:uploaded] == true
        @photo.errors.add(:base, "Uploaded must be true")
        raise ActiveRecord::RecordInvalid, @photo
      end
      return @photo if @photo.uploaded?

      unless PhotoStorage.exist?(@photo.key)
        @photo.errors.add(:base, "Photo must finish uploading first")
        raise ActiveRecord::RecordInvalid, @photo
      end

      @photo.update!(uploaded_at: Time.current)
      ListingPhotos::ResizeJob.perform_later(@photo)
      @photo
    end
  end
end
