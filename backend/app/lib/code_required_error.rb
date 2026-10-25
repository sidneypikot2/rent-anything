# The email given at checkout belongs to another guest (RAA-175): a sign-in code was sent to
# it, and the guest signs in with that code before checking out. Rendered as 409.
class CodeRequiredError < StandardError
  def initialize(msg = "That email already has an account. We've emailed it a code: enter it to continue.")
    super
  end
end
