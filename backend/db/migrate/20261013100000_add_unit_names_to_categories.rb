# Unit names (RAA-100): what one of a listing's units is called in its category, so guests
# read "5 rooms" or "50 motorcycles". Blank on a category means "unit" / "units". Filled by
# slug here; db/seeds.rb runs the same fill for a database loaded from schema.rb.
class AddUnitNamesToCategories < ActiveRecord::Migration[8.1]
  UNIT_NAMES = {
    "hotel" => %w[room rooms], "guest-house" => %w[room rooms], "resort" => %w[room rooms],
    "hostel" => %w[bed beds], "apartment" => %w[apartment apartments], "house" => %w[house houses],
    "villa" => %w[villa villas], "cottage" => %w[cottage cottages],
    "action-camera" => %w[camera cameras], "camera" => %w[camera cameras], "snorkel-gear" => %w[set sets],
    "bicycle" => %w[bicycle bicycles], "car" => %w[car cars], "e-trike" => %w[e-trike e-trikes],
    "motorcycle" => %w[motorcycle motorcycles], "multicab" => %w[multicab multicabs],
    "tricycle" => %w[tricycle tricycles], "van-rental" => %w[van vans], "van" => %w[van vans],
    "photographer" => %w[photographer photographers]
  }.freeze

  def self.fill(connection)
    UNIT_NAMES.each do |slug, (name, plural)|
      connection.execute <<~SQL
        UPDATE categories SET unit_name = #{connection.quote(name)}, unit_name_plural = #{connection.quote(plural)}
        WHERE slug = #{connection.quote(slug)} AND unit_name IS NULL
      SQL
    end
  end

  def change
    add_column :categories, :unit_name, :string
    add_column :categories, :unit_name_plural, :string

    reversible { |dir| dir.up { self.class.fill(connection) } }
  end
end
