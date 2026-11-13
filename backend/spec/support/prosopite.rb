# N+1 queries on reads (RAA-321): every GET a request spec sends runs under Prosopite, which
# fails the spec when the same query runs from the same place for each of several rows. Only
# the request is scanned, never the spec's setup (factories), and writes aren't: they change a
# few rows at a time, while a read's rows grow with the data.
Prosopite.raise = true
Prosopite.rails_logger = true
# Repeats that are fixed, not one per row:
Prosopite.allow_stack_paths = [
  /AreaDetail#typical_prices/,    # one query for each of two groups, stays and tours
  /UserChannel\.booking_updated/  # a booking change's broadcast to its guest and partner, a write
]

module ProsopiteReads
  def process(method, path, **)
    return super unless method.to_s.casecmp?("get")

    Prosopite.scan { super }
  end
end

ActionDispatch::Integration::Session.prepend(ProsopiteReads)
