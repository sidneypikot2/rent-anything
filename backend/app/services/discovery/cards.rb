module Discovery
  # What makes a guest's browse card (What to book, the plan's steps): a stay's card is its
  # business, any other one a business's listing title ("Mio 125" by one shop, its two "Fortuner"
  # listings together). The web app's byCard (browse-offers.tsx) groups the same way.
  module Cards
    # A listing title as cards compare it: "Mio 125" and " mio 125" are one card.
    TITLE_KEY = "LOWER(TRIM(listings.title))".freeze

    # The columns a group's cards are grouped by.
    def self.columns(group)
      group == "stay" ? [ "listings.business_id" ] : [ "listings.business_id", TITLE_KEY ]
    end

    # One expression naming a listing's card, for counting cards in Ruby.
    def self.key_sql(group)
      group == "stay" ? "listings.business_id::text" : "listings.business_id::text || '-' || #{TITLE_KEY}"
    end

    # How many cards the listings make.
    def self.count(scope, group)
      scope.group(*columns(group).map { |column| Arel.sql(column) }).count.size
    end
  end
end
