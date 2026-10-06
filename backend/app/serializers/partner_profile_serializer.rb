# A partner's profile as the partner sees it (the `partner_profile` schema in
# spec/swagger_helper.rb). Fields are nil until the profile is first saved.
module PartnerProfileSerializer
  def self.call(user)
    profile = user.partner_profile
    {
      display_name: profile&.display_name,
      legal_first_name: profile&.legal_first_name,
      legal_last_name: profile&.legal_last_name,
      phone: user.phone,
      email: user.email,
      address: {
        street: profile&.street,
        city: profile&.city,
        region: profile&.region,
        province: profile&.province,
        postal_code: profile&.postal_code,
        country: profile&.country
      },
      complete: profile.present? && user.phone.present?
    }
  end
end
