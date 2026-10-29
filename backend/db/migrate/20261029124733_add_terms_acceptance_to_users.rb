# Consent: when an account agreed to the Terms and Privacy policy, and which version
# (User::TERMS_VERSION). Null for accounts made before it was asked.
class AddTermsAcceptanceToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :terms_accepted_at, :datetime
    add_column :users, :terms_version, :string
    add_check_constraint :users, "(terms_accepted_at IS NULL) = (terms_version IS NULL)", name: "users_terms_acceptance_check"
  end
end
