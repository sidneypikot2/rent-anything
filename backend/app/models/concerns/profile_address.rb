# The legal name and address every profile has (RAA-40), one profile per user:
# PartnerProfile and GuestProfile. The phone is the user's own.
module ProfileAddress
  extend ActiveSupport::Concern

  # A name as it is on an ID: letters in any script (José, Peña), with the spaces,
  # hyphens, apostrophes and periods names use ("Ma. Cristina", "Dela Cruz", "O'Brien"),
  # starting with a letter. The web form checks the same pattern (web/src/lib/person-name.ts).
  NAME_FORMAT = /\A\p{L}[\p{L}\p{M} .'’-]*\z/
  NAME_MAX = 50

  included do
    belongs_to :user

    validates :legal_first_name, :legal_last_name, :street, :city, :region, :postal_code, presence: true
    validates :legal_first_name, :legal_last_name,
      length: { maximum: NAME_MAX },
      format: { with: NAME_FORMAT, message: "can only have letters, spaces, hyphens, apostrophes and periods" },
      allow_blank: true
    validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
    validates :user_id, uniqueness: true
  end

  class_methods do
    # "First name", not "Legal first name": what the forms call them.
    def human_attribute_name(attribute, options = {})
      { "legal_first_name" => "First name", "legal_last_name" => "Last name" }[attribute.to_s] || super
    end
  end
end
