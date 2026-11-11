# Every list endpoint answers a page at a time, asked for or not, so no request can read a
# whole table: `page` (from 1) and `per_page` (DEFAULT_PER_PAGE, at most MAX_PER_PAGE). The
# body keeps its shape; the page is described in headers — X-Total-Count, X-Page, X-Per-Page
# and a Link with rel="next" / rel="prev" where those pages exist. A page past the end is an
# empty list with the real total. A page or per_page that isn't a whole number in range is a
# 422. The page is cut in SQL, before anything is serialized.
module Paginated
  DEFAULT_PER_PAGE = 50
  MAX_PER_PAGE = 200
  MAX_PAGE = 100_000

  # Read and checked once per request: [page, per_page].
  class Window
    include ActiveModel::Validations

    attr_reader :page, :per_page

    def initialize(params)
      @page = whole(params[:page], 1, "Page", MAX_PAGE)
      @per_page = whole(params[:per_page], DEFAULT_PER_PAGE, "Per page", MAX_PER_PAGE)
      raise ActiveRecord::RecordInvalid, self if errors.any?
    end

    def offset = (page - 1) * per_page

    private

    def whole(value, default, label, max)
      return default if value.nil? || value == ""

      number = Integer(value, 10, exception: false) if value.is_a?(String) && value.match?(/\A\d+\z/)
      return number if number&.between?(1, max)

      errors.add(:base, "#{label} must be a whole number from 1 to #{max}")
      default
    end
  end

  private

  # The relation's page for this request, with the paging headers set from its total.
  def paginate(relation)
    window = page_window
    page_headers(count_all(relation), window)
    relation.limit(window.per_page).offset(window.offset)
  end

  def page_window
    @page_window ||= Window.new(params)
  end

  # A grouped or distinct relation counts its rows as a subquery; anything else counts plainly.
  def count_all(relation)
    plain = relation.except(:order, :limit, :offset, :includes, :preload, :eager_load)
    if plain.group_values.any? || plain.distinct_value
      relation.klass.unscoped.from(plain, :rows).count
    else
      plain.except(:select).count(:all)
    end
  end

  def page_headers(total, window)
    response.set_header("X-Total-Count", total.to_s)
    response.set_header("X-Page", window.page.to_s)
    response.set_header("X-Per-Page", window.per_page.to_s)
    last = [ (total.to_f / window.per_page).ceil, 1 ].max
    links = []
    links << %(<#{page_url(window.page + 1)}>; rel="next") if window.page < last
    links << %(<#{page_url([ window.page - 1, last ].min)}>; rel="prev") if window.page > 1
    response.set_header("Link", links.join(", ")) if links.any?
  end

  def page_url(page)
    "#{request.base_url}#{request.path}?#{request.query_parameters.compact_blank.merge('page' => page).to_query}"
  end
end
