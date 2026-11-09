# What a business tells guests on its shop page (RAA-281), the same for its partner and its
# guests (the `business_shop` schema in spec/swagger_helper.rb). Each part is null when the
# partner hasn't filled it in. Preload photos and logo.
module BusinessShopSerializer
  def self.call(business)
    {
      hours: business.opens_at && {
        opens_at: business.opens_at, closes_at: business.closes_at, closed_days: business.closed_days
      },
      languages: business.languages,
      host: business.host_name && { name: business.host_name, intro: business.host_intro },
      stay_rules: stay_rules(business),
      faqs: business.faqs.map { |faq| { question: faq["question"], answer: faq["answer"] } }
    }
  end

  def self.stay_rules(business)
    values = [ business.check_in_from, business.check_in_until, business.check_out_by, business.quiet_from, business.rules_note ]
    return nil if values.all?(&:nil?) && business.house_rules.empty?

    {
      check_in_from: business.check_in_from,
      check_in_until: business.check_in_until,
      check_out_by: business.check_out_by,
      house_rules: business.house_rules,
      quiet_from: business.quiet_from,
      note: business.rules_note
    }
  end

  # The guest's photos: the ready logo and cover photos, as card and large URLs.
  def self.photos(business)
    logo = business.logo
    {
      logo: logo&.ready? ? ListingPhotoSerializer.call(logo) : nil,
      cover_photos: business.photos.select(&:ready?).map { |photo| ListingPhotoSerializer.call(photo) }
    }
  end

  # The partner's: every photo, with its id and state, so they can be reordered and replaced.
  def self.partner_photos(business)
    {
      logo: business.logo && ListingPhotoSerializer.partner(business.logo),
      cover_photos: business.photos.map { |photo| ListingPhotoSerializer.partner(photo) }
    }
  end
end
