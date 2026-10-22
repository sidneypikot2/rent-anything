# Where a partner's money goes (RAA-145): a bank account, GCash or Maya. A partner saves one
# or more and each of their businesses picks one (Business#payout_account); two can share
# one. The account number is encrypted at rest and only its last four digits ever leave the
# API. A bank account names its bank by Xendit's Philippine payout channel code; confirm the
# list against Xendit's channel list when payouts are built (M4).
class PayoutAccount < ApplicationRecord
  KINDS = { "bank" => "Bank account", "gcash" => "GCash", "maya" => "Maya" }.freeze
  BANKS = {
    "PH_AUB" => "Asia United Bank",
    "PH_BDO" => "BDO Unibank",
    "PH_BPI" => "Bank of the Philippine Islands",
    "PH_CBC" => "China Banking Corporation",
    "PH_EWB" => "EastWest Bank",
    "PH_LBP" => "Land Bank of the Philippines",
    "PH_MET" => "Metrobank",
    "PH_PNB" => "Philippine National Bank",
    "PH_PSB" => "PSBank",
    "PH_RCBC" => "RCBC",
    "PH_SEC" => "Security Bank",
    "PH_UBP" => "UnionBank"
  }.freeze
  ACCOUNT_NAME_LENGTH = 100
  BANK_NUMBER = /\A[0-9]{6,20}\z/
  # An e-wallet is a Philippine mobile number, stored as 09XXXXXXXXX.
  MOBILE_NUMBER = /\A09[0-9]{9}\z/

  encrypts :account_number

  belongs_to :partner, class_name: "User"
  has_many :businesses, dependent: :restrict_with_error

  enum :kind, KINDS.keys.index_with(&:itself), validate: true

  validates :account_name, presence: true, length: { maximum: ACCOUNT_NAME_LENGTH }
  validates :bank_code, inclusion: { in: BANKS.keys, message: "must be one of the listed banks" }, if: :bank?
  validates :bank_code, absence: true, unless: :bank?
  validate :account_number_fits_kind
  validate :partner_is_a_partner

  before_validation :set_last4
  before_destroy :not_in_use, prepend: true

  def bank_name
    BANKS[bank_code]
  end

  # How the partner recognises it in a list: "BDO Unibank •••• 1234", "GCash •••• 5678".
  def label
    "#{bank? ? bank_name : KINDS[kind]} •••• #{account_number_last4}"
  end

  private

  def set_last4
    self.account_number_last4 = account_number.last(4) if account_number.present?
  end

  # Says which businesses still use it, ahead of restrict_with_error's generic message.
  def not_in_use
    names = businesses.order(:name).pluck(:name)
    return if names.empty?

    errors.add(:base, "#{names.to_sentence} still #{names.one? ? 'gets' : 'get'} payouts here. Pick another account for them first")
    throw :abort
  end

  def account_number_fits_kind
    return if account_number.nil? || kind.nil?

    if bank?
      errors.add(:account_number, "must be 6 to 20 digits") unless account_number.match?(BANK_NUMBER)
    elsif !account_number.match?(MOBILE_NUMBER)
      errors.add(:account_number, "must be a mobile number like 09171234567")
    end
  end

  def partner_is_a_partner
    errors.add(:partner, "must be a partner") if partner && !partner.partner?
  end
end
