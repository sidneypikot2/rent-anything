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

    # One expression naming a listing's card, for counting cards in Ruby: a stay's, any other's.
    # Constants, so the SQL they go into is never built from a value.
    STAY_KEY_SQL = "listings.business_id::text".freeze
    TITLE_KEY_SQL = "listings.business_id::text || '-' || #{TITLE_KEY}".freeze

    # How many cards the listings make in each guest group, in one pass: { "stay" => 3, ... },
    # every group present.
    def self.counts(scope)
      group_sql = Category.guest_group_sql
      key_sql = "CASE WHEN #{group_sql} = 'stay' THEN #{STAY_KEY_SQL} ELSE #{TITLE_KEY_SQL} END"
      rows = ActiveRecord::Base.connection.select_rows(<<~SQL.squish)
        SELECT card_group, COUNT(DISTINCT card) FROM (#{scope.select(Arel.sql("#{group_sql} AS card_group, #{key_sql} AS card")).to_sql}) AS cards
        WHERE card_group IS NOT NULL GROUP BY card_group
      SQL
      Category::GUEST_GROUPS.index_with(0).merge(rows.to_h { |group, count| [ group, count.to_i ] })
    end

    # How many cards the listings make, counted in the database.
    def self.count(scope, group)
      grouped = scope.group(*columns(group).map { |column| Arel.sql(column) }).select("1")
      ActiveRecord::Base.connection.select_value("SELECT COUNT(*) FROM (#{grouped.to_sql}) AS cards").to_i
    end
  end
end
