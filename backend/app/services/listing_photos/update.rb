module ListingPhotos
  # A partner confirms a photo's upload (RAA-106), or the team an area banner's (RAA-164): once
  # its file is in storage, guests see it and its sizes are made (ListingPhotos::ResizeJob).
  # Sending it again is harmless, so a browser that lost the answer can retry. The file's first
  # bytes must be the declared type's (RAA-221), or it is deleted.
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

      start = PhotoStorage.read_start(@photo.key)
      unless start
        @photo.errors.add(:base, "Photo must finish uploading first")
        raise ActiveRecord::RecordInvalid, @photo
      end
      # The type is the browser's word for it (RAA-221): a file that isn't that image goes, row
      # and all, so the partner adds it again.
      unless @photo.signature_matches?(start)
        @photo.reject!
        @photo.errors.add(:base, "#{@photo.filename} isn't a JPEG, PNG or WebP image")
        raise ActiveRecord::RecordInvalid, @photo
      end

      @photo.update!(uploaded_at: Time.current)
      ListingPhotos::ResizeJob.perform_later(@photo)
      @photo
    end
  end
end
