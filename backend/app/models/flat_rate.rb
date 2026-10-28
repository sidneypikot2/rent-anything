# A flat price for a listing with no rate of its own (RAA-191): gear's price for one item a day,
# a transfer's for one vehicle a trip (Category#flat_priced?). A price of 0 is "no price yet".
class FlatRate < ApplicationRecord
  belongs_to :listing, inverse_of: :flat_rate

  validates :price_cents, numericality: { only_integer: true, greater_than_or_equal_to: 0 }
  validate :listing_is_flat_priced

  def priced?
    price_cents.positive?
  end

  private

  def listing_is_flat_priced
    errors.add(:listing, "must be gear or a transfer") if listing && !listing.category.flat_priced?
  end
end
