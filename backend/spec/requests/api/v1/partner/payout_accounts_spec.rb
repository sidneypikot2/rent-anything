require "swagger_helper"

RSpec.describe "Partner payout accounts", type: :request do
  let(:user) { create(:user, :partner) }
  let(:Authorization) { bearer_for(user) }

  path "/api/v1/partner/payout_accounts" do
    get "The signed-in partner's payout accounts" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. Where the partner's payouts can go (RAA-145) — bank accounts, GCash and Maya — " \
        "oldest first, each with the businesses paid out to it. Only the last four digits of a number are returned."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "only the partner's own accounts, with the businesses that use them" do
        schema type: :array, items: { "$ref" => "#/components/schemas/payout_account" }

        let!(:bank) { create(:payout_account, partner: user, account_number: "001234567890") }
        let!(:gcash) { create(:payout_account, :gcash, partner: user, account_number: "09171234567") }

        before do
          create(:business, partner: user, name: "Basilia Guest House", payout_account: bank)
          create(:payout_account)
        end

        run_test! do |response|
          expect(response.parsed_body.pluck("id")).to eq([ bank.id, gcash.id ])
          expect(response.parsed_body.first).to include(
            "kind" => "bank", "bank_code" => "PH_BDO", "bank_name" => "BDO Unibank",
            "account_number_last4" => "7890", "label" => "BDO Unibank •••• 7890",
            "businesses" => [ a_hash_including("name" => "Basilia Guest House") ]
          )
          expect(response.parsed_body.second).to include("kind" => "gcash", "bank_code" => nil, "label" => "GCash •••• 4567")
          expect(response.body).not_to include("001234567890", "09171234567")
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    post "Add a payout account" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. `kind`, `account_name` and `account_number` are required, and `bank_code` for a " \
        "bank account (the banks are in payout options). A bank account number is 6 to 20 digits; an e-wallet's " \
        "is a Philippine mobile number. The number is stored encrypted."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/payout_account_body" }

      let(:body) do
        { kind: "bank", bank_code: "PH_BPI", account_name: " Juan Dela Cruz ", account_number: "1234-5678-90" }
      end

      response "201", "a bank account, its number kept encrypted" do
        schema "$ref" => "#/components/schemas/payout_account"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "kind" => "bank", "bank_name" => "Bank of the Philippine Islands", "account_name" => "Juan Dela Cruz",
            "account_number_last4" => "7890", "businesses" => []
          )
          account = user.payout_accounts.sole
          expect(account.account_number).to eq("1234567890")
          raw = PayoutAccount.connection.select_value("SELECT account_number FROM payout_accounts WHERE id = #{account.id}")
          expect(raw).not_to include("1234567890")
        end
      end

      response "201", "a Maya account by its +63 number, with no bank" do
        schema "$ref" => "#/components/schemas/payout_account"
        let(:body) { { kind: "maya", bank_code: "PH_BPI", account_name: "Juan Dela Cruz", account_number: "+63 917 123 4567" } }

        run_test! do |response|
          expect(response.parsed_body).to include("kind" => "maya", "bank_code" => nil, "account_number_last4" => "4567")
          expect(user.payout_accounts.sole.account_number).to eq("09171234567")
        end
      end

      response "422", "a bank account without a bank" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { kind: "bank", account_name: "Juan Dela Cruz", account_number: "1234567890" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Bank is required")
          expect(user.payout_accounts).to be_empty
        end
      end

      response "422", "a bank that isn't listed and a bank account number with letters" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { kind: "bank", bank_code: "PH_NOPE", account_name: "Juan Dela Cruz", account_number: "12ab" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Bank code must be one of the listed banks", "Account number must be 6 to 20 digits"
          )
        end
      end

      response "422", "an e-wallet number that isn't a mobile number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { kind: "gcash", account_name: "Juan Dela Cruz", account_number: "1234567890" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Account number must be a mobile number like 09171234567")
        end
      end

      response "422", "missing or wrong-typed values" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { kind: "cash", account_name: [ "Juan" ], account_number: 1234567890 } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include(
            "Kind must be one of bank, gcash, maya", "Account name is required", "Account number is required"
          )
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/payout_accounts/{id}" do
    parameter name: :id, in: :path, schema: { type: :integer }
    parameter name: :Authorization, in: :header, schema: { type: :string }

    let(:account) { create(:payout_account, partner: user, account_number: "001234567890") }
    let(:id) { account.id }

    patch "Change a payout account" do
      tags "Partner"
      consumes "application/json"
      produces "application/json"
      description "Partner-only. The same rules as adding one; what is left out is kept, except that changing " \
        "`kind` needs a new `account_number` (and `bank_code` for a bank). Another partner's account is a 404."
      security [ { bearer: [] } ]
      parameter name: :body, in: :body, schema: { "$ref" => "#/components/schemas/payout_account_body" }

      let(:body) { { account_name: "Maria Dela Cruz" } }

      response "200", "renamed; the bank and number are kept" do
        schema "$ref" => "#/components/schemas/payout_account"

        run_test! do |response|
          expect(response.parsed_body).to include(
            "account_name" => "Maria Dela Cruz", "bank_code" => "PH_BDO", "account_number_last4" => "7890"
          )
        end
      end

      response "200", "a new number" do
        schema "$ref" => "#/components/schemas/payout_account"
        let(:body) { { account_number: "009876543210" } }

        run_test! do |response|
          expect(response.parsed_body["account_number_last4"]).to eq("3210")
          expect(account.reload.account_number).to eq("009876543210")
        end
      end

      response "200", "switched from a bank to GCash, which drops the bank" do
        schema "$ref" => "#/components/schemas/payout_account"
        let(:body) { { kind: "gcash", account_number: "09171234567" } }

        run_test! do |response|
          expect(response.parsed_body).to include("kind" => "gcash", "bank_code" => nil, "account_number_last4" => "4567")
        end
      end

      response "422", "switched to GCash without a new number" do
        schema "$ref" => "#/components/schemas/validation_errors"
        let(:body) { { kind: "gcash" } }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to include("Account number is required")
          expect(account.reload).to be_bank
        end
      end

      response "404", "another partner's account" do
        schema "$ref" => "#/components/schemas/error"
        let(:other) { create(:payout_account, account_name: "Not yours") }
        let(:id) { other.id }

        run_test! { expect(other.reload.account_name).to eq("Not yours") }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end

    delete "Delete a payout account" do
      tags "Partner"
      description "Partner-only. Refused while one of the partner's businesses gets payouts there. Another " \
        "partner's account is a 404."
      security [ { bearer: [] } ]

      response "204", "deleted" do
        run_test! { expect(PayoutAccount.exists?(account.id)).to be(false) }
      end

      response "422", "a business still gets payouts there" do
        schema "$ref" => "#/components/schemas/validation_errors"

        before { create(:business, partner: user, name: "Basilia Guest House", payout_account: account) }

        run_test! do |response|
          expect(response.parsed_body["errors"]).to eq(
            [ "Basilia Guest House still gets payouts here. Pick another account for them first" ]
          )
          expect(PayoutAccount.exists?(account.id)).to be(true)
        end
      end

      response "404", "another partner's account" do
        schema "$ref" => "#/components/schemas/error"
        let(:id) { create(:payout_account).id }

        run_test! { expect(PayoutAccount.exists?(id)).to be(true) }
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { bearer_for(create(:user)) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end

  path "/api/v1/partner/payout_options" do
    get "What the payout account form offers" do
      tags "Partner"
      produces "application/json"
      description "Partner-only. The kinds of payout account (bank, GCash, Maya) and the banks a bank account can be at."
      security [ { bearer: [] } ]
      parameter name: :Authorization, in: :header, schema: { type: :string }

      response "200", "the kinds and banks" do
        schema "$ref" => "#/components/schemas/payout_options"

        run_test! do |response|
          expect(response.parsed_body["kinds"].pluck("value")).to eq(%w[bank gcash maya])
          expect(response.parsed_body["banks"]).to include("code" => "PH_BDO", "name" => "BDO Unibank")
        end
      end

      response "403", "a guest" do
        schema "$ref" => "#/components/schemas/error"
        let(:user) { create(:user) }

        run_test!
      end

      response "401", "signed out" do
        schema "$ref" => "#/components/schemas/error"
        let(:Authorization) { nil }

        run_test!
      end
    end
  end
end
