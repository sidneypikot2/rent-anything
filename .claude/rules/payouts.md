---
paths:
  - "backend/app/models/payout_account.rb"
  - "backend/app/services/payout_accounts/**"
  - "backend/app/controllers/api/v1/partner/payout_*"
  - "backend/app/serializers/payout_account_serializer.rb"
---

# Payout accounts (RAA-145)

**Shape**: a partner saves payout accounts (`payout_accounts`: `kind` bank, gcash or maya) and each business picks one (`businesses.payout_account_id`, nullable). Two businesses can share an account. A composite foreign key to `payout_accounts (id, partner_id)` keeps a business on its own partner's account; `Businesses::BusinessValues` also refuses another partner's id with a 422. An account a business still uses can't be deleted (422 naming the businesses). The Xendit sub-account stays per partner; only the destination is per business.

**The account number is a secret**: `encrypts :account_number` (Active Record Encryption, the first use in this repo) and only `account_number_last4` (and `label`, built from it) ever leave the API. Never add the number to a serializer, a log line or an error message; request logs filter `account_number` (`config/initializers/filter_parameter_logging.rb`). The keys come from `ACTIVE_RECORD_ENCRYPTION_*` on Render (`render.yaml`); development and test set fixed keys in their environment files. Changing the keys on Render makes the saved numbers unreadable.

**Values**: a bank account names its bank by Xendit's Philippine payout channel code (`PayoutAccount::BANKS`, served by `GET partner/payout_options`) and has 6–20 digits; an e-wallet has no bank and a mobile number stored as `09XXXXXXXXX` (`+63` is read as `0`). Only some of the bank codes were confirmed in Xendit's docs: check the list against Xendit's channel list when payouts are built (M4).
