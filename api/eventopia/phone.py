import phonenumbers

from eventopia.exceptions import ValidationError


def normalize_phone(raw: str, default_region: str = "UZ") -> str:
    raw = raw.strip()
    candidates = [raw]
    if raw.isascii() and raw.isdigit() and len(raw) >= 11:
        # Honor valid regional trunk prefixes before Telegram's bare country code.
        candidates.append("+" + raw)
    for candidate in candidates:
        try:
            number = phonenumbers.parse(candidate, default_region)
        except phonenumbers.NumberParseException:
            continue
        if phonenumbers.is_valid_number(number):
            return phonenumbers.format_number(
                number,
                phonenumbers.PhoneNumberFormat.E164,
            )
    raise ValidationError("Invalid phone number")


def mask_phone(e164: str) -> str:
    number = phonenumbers.parse(e164, None)
    national = phonenumbers.national_significant_number(number)
    if len(national) <= 6:
        return f"+{number.country_code} *** {national[-2:]}"
    return f"+{number.country_code} {national[:2]} *** {national[-4:]}"
