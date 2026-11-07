from eventopia.config import AppSection
from eventopia.models.auth import SharedContact, TelegramUser
from eventopia.phone import mask_phone
from eventopia.services.account import AccountService
from eventopia.telegram import texts
from eventopia.telegram.gateway import TelegramGateway


class BotDispatcher:
    def __init__(
        self,
        account_service: AccountService,
        telegram: TelegramGateway,
        app_config: AppSection,
    ) -> None:
        self._account_service = account_service
        self._telegram = telegram
        self._login_url = app_config["public_base_url"].rstrip("/") + "/login"

    async def handle_update(self, update: dict) -> None:
        membership = update.get("my_chat_member")
        if membership is not None:
            await self._handle_membership(membership)
            return
        message = update.get("message")
        if message is None or message.get("chat", {}).get("type") != "private":
            return
        sender_data = message.get("from")
        if sender_data is None or sender_data.get("is_bot"):
            return
        sender = _sender(sender_data)
        chat_id = message["chat"]["id"]
        identity = await self._account_service.touch_identity(sender, chat_id)
        lang = texts.pick_language(sender.language_code)
        contact = message.get("contact")
        if contact is not None:
            if contact.get("user_id") != sender.id:
                await self._telegram.send_message(
                    chat_id, texts.bot_text(lang, "foreign_contact")
                )
                return
            await self._account_service.register_from_contact(
                sender,
                SharedContact(contact.get("user_id"), contact["phone_number"]),
                chat_id,
            )
            await self._telegram.send_message(
                chat_id,
                texts.bot_text(lang, "registered").format(login_url=self._login_url),
                reply_markup={"remove_keyboard": True},
            )
            return
        command = (message.get("text") or "").split(maxsplit=1)
        command = command[0].split("@", 1)[0] if command else ""
        verified = (
            identity is not None
            and identity.phone_e164 is not None
            and identity.phone_verified_at is not None
        )
        if not verified or command == "/phone":
            key = "phone_prompt" if verified else "welcome"
            await self._telegram.send_message(
                chat_id,
                texts.bot_text(lang, key),
                reply_markup={
                    "keyboard": [
                        [
                            {
                                "text": texts.bot_text(lang, "share_button"),
                                "request_contact": True,
                            }
                        ]
                    ],
                    "one_time_keyboard": True,
                    "resize_keyboard": True,
                },
            )
        elif command == "/start":
            profile = await self._account_service.ensure_profile(identity.account_uid)
            await self._telegram.send_message(
                chat_id,
                texts.bot_text(lang, "already_registered").format(
                    username=profile.username,
                    phone=mask_phone(identity.phone_e164),
                    login_url=self._login_url,
                ),
            )
        else:
            await self._telegram.send_message(chat_id, texts.bot_text(lang, "help"))

    async def _handle_membership(self, membership: dict) -> None:
        chat = membership.get("chat", {})
        if chat.get("type") != "private":
            return
        status = membership.get("new_chat_member", {}).get("status")
        if status not in ("kicked", "member"):
            return
        # new_chat_member.user is the bot. The private chat identifies the user;
        # an administrator can be the actor in membership events.
        actor = membership.get("from", {})
        if actor.get("id") == chat["id"] and not actor.get("is_bot"):
            await self._account_service.touch_identity(_sender(actor), chat["id"])
        await self._account_service.set_chat_active(chat["id"], status == "member")


def _sender(data: dict) -> TelegramUser:
    return TelegramUser(
        data["id"],
        data.get("username"),
        data["first_name"],
        data.get("last_name"),
        data.get("language_code"),
    )
