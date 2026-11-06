import phonenumbers
import pytest

from eventopia.exceptions import ValidationError
from eventopia.phone import mask_phone, normalize_phone


@pytest.mark.parametrize(
    "raw",
    [
        "+998 90 123-45-67",
        "(90) 123 45 67",
        "901234567",
        "998901234567",
        "+998901234567",
        "  +998 90 123 45 67  ",
    ],
)
def test_normalize_uz(raw):
    assert normalize_phone(raw) == "+998901234567"


@pytest.mark.parametrize("raw", ["", "abc", "123", "+1 555", "+998001234567"])
def test_normalize_rejects_invalid_phone(raw):
    with pytest.raises(ValidationError):
        normalize_phone(raw)


def test_normalize_international_and_default_region():
    assert normalize_phone("442079460018") == "+442079460018"
    assert normalize_phone("020 7946 0018", default_region="GB") == "+442079460018"


@pytest.mark.parametrize(
    ("phone", "masked"),
    [
        ("+998901234567", "+998 90 *** 4567"),
        ("+998711234567", "+998 71 *** 4567"),
        ("+442079460018", "+44 20 *** 0018"),
    ],
)
def test_mask_phone(phone, masked):
    assert mask_phone(phone) == masked


def test_normalize_gb_digit_only_trunk_prefix_matches_spaced_form():
    assert normalize_phone("02079460018", default_region="GB") == "+442079460018"


@pytest.mark.parametrize("region", ["FO", "NU", "SH", "AC"])
def test_mask_short_valid_numbers_actually_hides_national_digits(region):
    number = phonenumbers.example_number(region)
    assert phonenumbers.is_valid_number(number)
    national = phonenumbers.national_significant_number(number)
    national_length = len(national)
    assert 4 <= national_length <= 6
    masked = mask_phone(
        phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
    )
    country, _, masked_national = masked.partition(" ")
    correct_country = country == "+" + str(number.country_code)
    assert correct_country, "Country code must be retained"
    visible_count = sum(character.isdigit() for character in masked_national)
    assert visible_count < national_length, "Mask must conceal national digits"
