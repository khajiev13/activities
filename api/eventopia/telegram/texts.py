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


_BOT_TEXTS = {
    "uz": {
        "welcome": (
            "Eventopia'ga xush kelibsiz! Ro'yxatdan o'tish uchun telefon "
            "raqamingizni ulashing."
        ),
        "share_button": "📱 Telefon raqamimni ulashish",
        "foreign_contact": "Tugma orqali o'zingizning telefon raqamingizni ulashing.",
        "registered": (
            "Ro'yxatdan o'tdingiz! {login_url} sahifasida shu telefon raqamini "
            "kiriting."
        ),
        "already_registered": (
            "Siz @{username} sifatida ro'yxatdan o'tgansiz. {login_url} "
            "sahifasida {phone} bilan kiring. Raqamni o'zgartirish: /phone."
        ),
        "help": (
            "/start — ro'yxatdan o'tish holati. /phone — telefon raqamini "
            "o'zgartirish."
        ),
        "phone_prompt": "Yangi telefon raqamingizni quyidagi tugma orqali ulashing.",
    },
    "ru": {
        "welcome": (
            "Добро пожаловать в Eventopia! Поделитесь своим номером телефона "
            "для регистрации."
        ),
        "share_button": "📱 Поделиться номером телефона",
        "foreign_contact": (
            "Используйте кнопку, чтобы поделиться своим номером телефона."
        ),
        "registered": (
            "Вы зарегистрированы! Введите этот номер телефона на {login_url}."
        ),
        "already_registered": (
            "Вы зарегистрированы как @{username}. Войдите на {login_url} с "
            "номером {phone}. Изменить номер: /phone."
        ),
        "help": "/start — статус регистрации. /phone — изменить номер телефона.",
        "phone_prompt": "Поделитесь новым номером телефона с помощью кнопки ниже.",
    },
    "en": {
        "welcome": "Welcome to Eventopia! Share your phone number to register.",
        "share_button": "📱 Share my phone number",
        "foreign_contact": "Please use the button to share your own number.",
        "registered": (
            "You're registered! Enter this phone number at {login_url} to log "
            "in."
        ),
        "already_registered": (
            "You're registered as @{username}. Log in at {login_url} with "
            "{phone}. Use /phone to change your number."
        ),
        "help": "/start — registration status. /phone — change your phone number.",
        "phone_prompt": "Use the button below to share your new phone number.",
    },
}


def bot_text(lang: Literal["uz", "ru", "en"], key: str) -> str:
    return _BOT_TEXTS[lang][key]
