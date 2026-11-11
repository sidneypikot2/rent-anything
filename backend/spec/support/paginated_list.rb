# Every list endpoint answers a page at a time (Paginated, app/controllers/concerns/paginated.rb).
# In an rswag operation (`get ... do`): `paginated_list` documents `page` and `per_page` and leaves
# both unsent; `page_headers` documents the response headers; `include_examples "a paginated list"`
# checks a second page of one and the 422 for a per_page out of range. The spec's data must
# hold `total:` rows, at least two.
module PaginatedList
  def paginated_list
    parameter name: :page, in: :query, required: false, schema: { type: :integer, minimum: 1, default: 1 },
      description: "Which page, from 1. A page past the end is an empty list."
    parameter name: :per_page, in: :query, required: false,
      schema: { type: :integer, minimum: 1, maximum: Paginated::MAX_PER_PAGE, default: Paginated::DEFAULT_PER_PAGE },
      description: "How many a page"

    let(:page) { nil }
    let(:per_page) { nil }
  end

  def page_headers
    header "X-Total-Count", schema: { type: :integer }, description: "How many there are across every page"
    header "X-Page", schema: { type: :integer }, description: "This page"
    header "X-Per-Page", schema: { type: :integer }, description: "How many a page"
    header "Link", schema: { type: :string }, description: "The next and previous pages (rel=\"next\", rel=\"prev\") where they exist"
  end
end

RSpec.configure do |config|
  config.extend PaginatedList, type: :request
end

RSpec.shared_examples "a paginated list" do |total:|
  response "200", "a page of them, counting them all" do
    page_headers

    let(:page) { 2 }
    let(:per_page) { 1 }

    run_test! do |response|
      expect(%w[X-Total-Count X-Page X-Per-Page].map { response.headers[_1] }).to eq([ total.to_s, "2", "1" ])
      expect(response.headers["Link"]).to match(/[?&]page=1&per_page=1[&>][^,]*rel="prev"/)
      expect(response.headers["Link"].include?('rel="next"')).to eq(total > 2)
    end
  end

  response "422", "a page or per_page out of range" do
    schema "$ref" => "#/components/schemas/validation_errors"

    let(:per_page) { Paginated::MAX_PER_PAGE + 1 }

    run_test! do |response|
      expect(response.parsed_body["errors"]).to eq([ "Per page must be a whole number from 1 to #{Paginated::MAX_PER_PAGE}" ])
    end
  end
end
