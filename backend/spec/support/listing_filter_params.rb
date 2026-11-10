# The filter parameters a browse endpoint takes (Discovery::ListingFilters), for its rswag spec:
# `listing_filter_parameters` inside a `get` block declares them and defaults each one's `let` to
# nil (unset); a context sets the ones it tests.
module ListingFilterParams
  def listing_filter_parameters
    parameter name: :free_cancellation, in: :query, type: :boolean, required: false,
      description: "Only listings free to cancel, any time or up to some days before"
    parameter name: :pets, in: :query, type: :boolean, required: false, description: "Only stays that take pets"
    parameter name: :min_price_cents, in: :query, type: :integer, required: false,
      description: "Only a from-price at least this (unpriced ones drop out)"
    parameter name: :max_price_cents, in: :query, type: :integer, required: false,
      description: "Only a from-price at most this (unpriced ones drop out)"
    parameter name: :"kinds[]", in: :query, required: false, style: :form, explode: true,
      schema: { type: :array, items: { type: :string } }, description: "Rentals: only these categories (slugs)"
    parameter name: :"transmissions[]", in: :query, required: false, style: :form, explode: true,
      schema: { type: :array, items: { type: :string } }, description: "Rentals: only these transmissions"
    parameter name: :delivery, in: :query, type: :boolean, required: false, description: "Rentals: only those that drop off"
    parameter name: :pickup, in: :query, type: :boolean, required: false, description: "Rentals: only those that pick up at the end"
    parameter name: :child_helmets, in: :query, type: :boolean, required: false, description: "Rentals: only those with child helmets"
    parameter name: :"includes[]", in: :query, required: false, style: :form, explode: true,
      schema: { type: :array, items: { type: :string } }, description: "Only listings that include all of these (facets' keys)"
    parameter name: :q, in: :query, type: :string, required: false, description: "Only listings with every word somewhere in them"
    %i[free_cancellation pets min_price_cents max_price_cents kinds[] transmissions[] delivery pickup child_helmets includes[] q]
      .each { |name| let(name) { nil } }
  end
end

RSpec.configure { |config| config.extend ListingFilterParams, type: :request }
