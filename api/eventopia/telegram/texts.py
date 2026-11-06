from typing import Literal


def pick_language(language_code: str | None) -> Literal["uz", "ru", "en"]:
    if language_code in ("uz", "ru"):
        return language_code
    return "en"


def otp_message(lang: Literal["uz", "ru", "en"], code: str, ttl_minutes: int) -> str:
    if lang == "uz":
        return (
            f"Eventopia kirish kodi: {code}. Kod {ttl_minutes} daqiqa amal qiladi. "
            "Kodni hech kimga bermang. Agar kodni so'ramagan bo'lsangiz, "
            "bu xabarga e'tibor bermang."
        )
    if lang == "ru":
        return (
            f"Код входа в Eventopia: {code}. Срок действия: {ttl_minutes} минут. "
            "Никому не сообщайте код. Если вы не запрашивали код, "
            "проигнорируйте это сообщение."
        )
    return (
        f"Your Eventopia login code: {code}. It expires in {ttl_minutes} minutes. "
        "Never share this code. If you did not request it, ignore this message."
    )
