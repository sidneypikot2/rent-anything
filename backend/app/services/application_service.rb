# Base class for service objects: plain Ruby objects with one public entry point.
# Subclasses implement #call (and an #initialize for whatever it needs); callers use
# the class method, e.g. Auth::SessionIssuer.call(user).
class ApplicationService
  # A block goes to #call (a list service gets its relation paged by it, Paginated).
  def self.call(*args, **kwargs, &block)
    new(*args, **kwargs).call(&block)
  end
end
