# The legal name and address every profile has (RAA-40), one profile per user:
# PartnerProfile and GuestProfile. The phone is the user's own.
module ProfileAddress
  extend ActiveSupport::Concern

  included do
    belongs_to :user

    validates :legal_first_name, :legal_last_name, :street, :city, :region, :postal_code, presence: true
    validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
    validates :user_id, uniqueness: true
  end
end
