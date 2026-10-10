# Category descriptions (RAA-82): what a category means, for a partner choosing one —
# shown when picking an accommodation's property type.
class AddDescriptionToCategories < ActiveRecord::Migration[8.1]
  def change
    add_column :categories, :description, :text, default: "", null: false
  end
end
