require "rails_helper"

# Rails' own direct upload endpoint takes anyone's file of any type and size (RAA-106):
# uploads go through POST /api/v1/partner/direct_uploads instead.
RSpec.describe "Active Storage's own routes", type: :request do
  it "doesn't take uploads at /rails/active_storage/direct_uploads" do
    post "/rails/active_storage/direct_uploads", as: :json, params: {
      blob: { filename: "x.zip", byte_size: 10, checksum: "1B2M2Y8AsgTpgAmY7PhCfg==", content_type: "application/zip" }
    }

    expect(response).to have_http_status(:not_found)
    expect(ActiveStorage::Blob.count).to eq(0)
  end
end
