module ListingPhotos
  # Deletes a photo's files from storage after its row is gone (RAA-106, ListingPhoto).
  # Keys never written, such as sizes not made yet, are skipped.
  class DeleteFilesJob < ApplicationJob
    queue_as :default

    retry_on Aws::S3::Errors::ServiceError, Seahorse::Client::NetworkingError, wait: :polynomially_longer, attempts: 5

    def perform(keys)
      PhotoStorage.delete(keys)
    end
  end
end
