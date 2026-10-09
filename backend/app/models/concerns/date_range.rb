# A starts_on / ends_on pair that is both set or both empty (RAA-64), as on trips and their
# items. CHECK constraints hold the same rules; dates newly set can't be in the past.
module DateRange
  extend ActiveSupport::Concern

  included do
    validate :dates_are_both_or_neither
    validate :dates_are_not_past, if: :dates_changed?
  end

  def dated?
    starts_on.present?
  end

  private

  def dates_changed?
    will_save_change_to_starts_on? || will_save_change_to_ends_on?
  end

  def dates_are_both_or_neither
    if starts_on.nil? != ends_on.nil?
      errors.add(:base, "Set both dates or neither")
    elsif dated? && ends_on < starts_on
      errors.add(:ends_on, "must be on or after the start date")
    end
  end

  # Only the date being set: a trip under way can still be extended at its end.
  def dates_are_not_past
    return unless dated?

    errors.add(:starts_on, "can't be in the past") if will_save_change_to_starts_on? && starts_on < Date.current
    errors.add(:ends_on, "can't be in the past") if will_save_change_to_ends_on? && ends_on < Date.current
  end
end
