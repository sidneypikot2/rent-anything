require "rails_helper"

RSpec.describe Cable::CloseExpiredJob do
  let(:user) { create(:user) }

  it "closes the user's connections, which reconnect with the token they hold now" do
    expect { described_class.perform_now(user) }
      .to have_broadcasted_to("action_cable/#{user.to_gid_param}").with(type: "disconnect", reconnect: true)
  end

  it "is dropped for a user who is gone (deleting the account closed their connections)" do
    job_data = described_class.new(user).serialize
    user.destroy!

    expect { ActiveJob::Base.execute(job_data) }.not_to raise_error
  end
end
