module Partners
  # The signed-in partner saves their profile (RAA-40): what every profile has
  # (Profiles::Update), plus the display_name shown to travellers.
  class UpdateProfile < Profiles::Update
    private

    def profile
      @user.partner_profile || @user.build_partner_profile
    end

    # Travellers see the display name on a partner's listings, so adding one needs it and a
    # partner with listings can't clear it (RAA-86).
    def own_attributes
      display_name = optional_string(@params, :display_name, "Display name")
      if display_name.nil? && @user.listings.exists?
        @errors << "Display name is required while you have listings"
      end
      { display_name: }
    end
  end
end
