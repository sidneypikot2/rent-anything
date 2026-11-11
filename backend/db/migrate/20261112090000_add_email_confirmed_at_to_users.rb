# Email confirmation (RAA-214): when the account proved it owns its email. A password account
# needs it before checking out or paying. Every account that exists now is backfilled as
# confirmed: there is no production database yet, so they are staging's (the team's testers,
# Google sign-ins, guests who signed in with an emailed code) and the seeds', and leaving them
# unconfirmed would stop them checking out before the web app can confirm an email.
class AddEmailConfirmedAtToUsers < ActiveRecord::Migration[8.1]
  def up
    add_column :users, :email_confirmed_at, :datetime
    execute "UPDATE users SET email_confirmed_at = now() WHERE email IS NOT NULL"
  end

  def down
    remove_column :users, :email_confirmed_at
  end
end
