module Partners
  # The signed-in partner saves their profile (RAA-40): what every profile has
  # (Profiles::Update), plus an optional display_name. Travellers see a listing's business
  # name instead (RAA-100); the web app stops asking for a display name in RAA-101.
  class UpdateProfile < Profiles::Update
    private

    def profile
      @user.partner_profile || @user.build_partner_profile
    end

    def own_attributes
      { display_name: optional_string(@params, :display_name, "Display name") }
    end
  end
end
