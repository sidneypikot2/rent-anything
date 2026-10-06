module Guests
  # The signed-in guest saves their profile (RAA-40): what every profile has
  # (Profiles::Update), nothing more yet. Guest-only fields go here as they come.
  class UpdateProfile < Profiles::Update
    private

    def profile
      @user.guest_profile || @user.build_guest_profile
    end
  end
end
