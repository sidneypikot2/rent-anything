# Email confirmation (RAA-214): when the account proved it owns its email. A password account
# needs it before checking out or paying. Every account that exists now with a password or a
# Google or Facebook sign-in is backfilled as confirmed: there is no production database yet, so
# they are staging's (the team's testers) and the seeds', and leaving them unconfirmed would stop
# them checking out before the web app can confirm an email. Guests without either typed their
# email at checkout unchecked, so they stay unconfirmed and get the link if they set a password.
class AddEmailConfirmedAtToUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :email_confirmed_at, :datetime
    execute <<~SQL.squish
      UPDATE users SET email_confirmed_at = now()
      WHERE email IS NOT NULL
        AND (password_digest IS NOT NULL OR EXISTS (SELECT 1 FROM oauth_identities oi WHERE oi.user_id = users.id))
    SQL
  end

  def down
    remove_column :users, :email_confirmed_at
  end
end
