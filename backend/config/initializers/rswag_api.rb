# Serves swagger/v1/openapi.yaml at /api-docs/v1/openapi.yaml. The file is generated from
# the request specs (spec/requests/**, see spec/swagger_helper.rb), never edited by hand.
Rswag::Api.configure do |c|
  c.openapi_root = Rails.root.join("swagger").to_s
end
