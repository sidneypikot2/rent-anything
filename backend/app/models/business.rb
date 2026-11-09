# A business a partner runs (RAA-100): "Basilia Guest House", "Basilia Motor Rentals". One
# partner can run several; each listing belongs to one of them, and guests see its name.
# ID checks stay with the partner; its payouts go to one of the partner's payout accounts,
# picked per business (RAA-145), and the database keeps it on its own partner's account.
# Names are unique per partner, ignoring case. Its address and map pin are where a new
# listing starts from ("Same as Business Address"); Businesses::BusinessValues requires them
# on a new business.
#
# Its shop page (RAA-281) also shows what the partner tells guests about it: opening hours (one
# daily range, and the weekdays it is closed), the languages it speaks, its host, the rules a
# stay there keeps, up to MAX_FAQS questions and answers, its logo and its cover photos.
class Business < ApplicationRecord
  NAME_LENGTH = 80
  LANGUAGES = %w[en tl ceb ilo ko zh ja de fr es].freeze
  HOUSE_RULES = %w[no_smoking no_parties quiet_hours no_visitors].freeze
  MAX_FAQS = 6
  QUESTION_LENGTH = 120
  ANSWER_LENGTH = 500
  MAX_COVER_PHOTOS = 8
  HALF_HOUR = /\A([01][0-9]|2[0-3]):(00|30)\z/

  belongs_to :partner, class_name: "User"
  belongs_to :payout_account, optional: true
  has_many :listings, dependent: :restrict_with_error
  # Its cover photos, in the partner's order (GalleryPhotos).
  has_many :photos, -> { order(:position) }, class_name: "BusinessPhoto", dependent: :destroy
  has_one :logo, class_name: "BusinessLogo", dependent: :destroy

  validates :name, presence: true, length: { maximum: NAME_LENGTH },
    uniqueness: { scope: :partner_id, case_sensitive: false }
  validates :description, length: { maximum: 2000 }
  validates :country, format: { with: /\A[A-Z]{2}\z/, message: "must be a two-letter country code" }
  validates :opens_at, :closes_at, :check_in_from, :check_in_until, :check_out_by, :quiet_from,
    format: { with: HALF_HOUR, message: "must be a time on the hour or half hour", allow_nil: true }
  validates :host_name, length: { maximum: 60 }
  validates :host_intro, length: { maximum: 160 }
  validates :rules_note, length: { maximum: 300 }
  validate :partner_is_a_partner
  validate :hours_make_a_range
  validate :lists_hold_known_values
  validate :faqs_are_questions_and_answers

  private

  def hours_make_a_range
    if opens_at.nil? != closes_at.nil?
      errors.add(:base, "Opening hours need both an opening and a closing time")
    elsif opens_at && closes_at && opens_at >= closes_at
      errors.add(:base, "Opening hours must close after they open")
    end
  end

  def lists_hold_known_values
    errors.add(:closed_days, "must be weekdays from 0 (Sunday) to 6") unless closed_days.all? { |day| day.in?(0..6) }
    errors.add(:languages, "must be from #{LANGUAGES.join(', ')}") unless (languages - LANGUAGES).empty?
    errors.add(:house_rules, "must be from #{HOUSE_RULES.join(', ')}") unless (house_rules - HOUSE_RULES).empty?
  end

  def faqs_are_questions_and_answers
    return errors.add(:base, "Good to know can have at most #{MAX_FAQS} questions") if faqs.size > MAX_FAQS

    faqs.each do |faq|
      question, answer = faq.is_a?(Hash) ? faq.values_at("question", "answer") : []
      next if question.is_a?(String) && answer.is_a?(String) && question.present? && answer.present? &&
        question.length <= QUESTION_LENGTH && answer.length <= ANSWER_LENGTH

      errors.add(:base, "Each question needs a question (up to #{QUESTION_LENGTH} characters) " \
        "and an answer (up to #{ANSWER_LENGTH})")
      break
    end
  end

  def partner_is_a_partner
    errors.add(:partner, "must be a partner") if partner && !partner.partner?
  end
end
