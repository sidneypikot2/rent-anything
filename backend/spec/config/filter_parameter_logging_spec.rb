require "rails_helper"

# What request logs must never show (RAA-175): a trip link's PIN and an emailed sign-in code.
RSpec.describe "Filtered request parameters" do
  let(:filter) { ActiveSupport::ParameterFilter.new(Rails.application.config.filter_parameters) }

  it "hides PINs and sign-in codes, and keeps other codes readable" do
    filtered = filter.filter("pin" => "042917", "code" => "381204", "postal_code" => "6000", "token" => "tok")

    expect(filtered).to eq("pin" => "[FILTERED]", "code" => "[FILTERED]", "postal_code" => "6000", "token" => "[FILTERED]")
  end
end
