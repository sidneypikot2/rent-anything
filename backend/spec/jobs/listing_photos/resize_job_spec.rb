require "rails_helper"

RSpec.describe ListingPhotos::ResizeJob do
  let(:photo) { create_photo(create(:listing), ready: false) }
  let(:folder) { "test/listing_photos/#{photo.id}" }

  # A phone photo with its camera's GPS point in the EXIF.
  let(:with_location) do
    image = Vips::Image.black(2000, 1000).copy
    image.set_type(GObject::GSTR_TYPE, "exif-ifd2-UserComment", "taken at the partner's house")
    image.set_type(GObject::GSTR_TYPE, "exif-ifd3-GPSLatitude", "11/1 10/1 0/1")
    image.jpegsave_buffer
  end

  it "replaces the original with a copy without its metadata, makes both sizes from it, then marks it ready" do
    expect(Vips::Image.new_from_buffer(with_location, "").get_fields).to include("exif-ifd3-GPSLatitude")
    stub_photo_in_storage(with_location)
    uploads = capture_uploads

    described_class.perform_now(photo)

    expect(uploads.keys).to eq(%W[#{folder}/image.jpg #{folder}/image_card.jpg #{folder}/image_large.jpg])
    images = uploads.transform_values { |bytes| Vips::Image.new_from_buffer(bytes, "") }
    expect(images.values.flat_map { |image| image.get_fields.grep(/exif|xmp|iptc/) }).to be_empty
    expect(images.values.map { |image| [ image.width, image.height ] }).to eq([ [ 2000, 1000 ], [ 800, 600 ], [ 1600, 800 ] ])
    expect(photo.reload).to be_ready
  end

  it "does nothing for a photo already ready" do
    stub_photo_in_storage
    described_class.perform_now(photo)

    expect { described_class.perform_now(photo) }.not_to(change { storage_requests(:put_object).size })
  end
end
