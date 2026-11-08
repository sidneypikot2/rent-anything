module BusinessLogos
  # A partner adds their business's logo (RAA-281), as a cover photo is added
  # (GalleryPhotos::Create): the row first, so the file's key is known, then the browser PUTs
  # the bytes and confirms. A business has one logo, so a new one replaces the one before
  # (its files go after the commit, StoredPhoto).
  class Create < ApplicationService
    include PhotoUploadValues

    def initialize(business, params)
      @business = business
      @params = params
      @errors = []
    end

    def call
      logo = BusinessLogo.new(business: @business, **upload_attributes)
      if @errors.any?
        @errors.each { |message| logo.errors.add(:base, message) }
        raise ActiveRecord::RecordInvalid, logo
      end

      @business.with_lock do
        @business.logo&.destroy!
        logo.save!
      end
      [ logo, upload_url(logo) ]
    end
  end
end
