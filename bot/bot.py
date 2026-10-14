import os
import logging
from aiogram import Bot, Dispatcher, types
from aiogram.filters import CommandStart, Command
from aiogram.types import (
    InlineKeyboardMarkup,
    InlineKeyboardButton,
    WebAppInfo,
    MenuButtonWebApp
)

logger = logging.getLogger(__name__)

def create_bot_router(bot: Bot, webapp_url: str) -> Dispatcher:
    """
    Creates and configures the Aiogram 3 Dispatcher with all handlers.
    """
    dp = Dispatcher()

    @dp.message(CommandStart())
    async def command_start_handler(message: types.Message) -> None:
        user_name = message.from_user.first_name if message.from_user else "Commander"
        
        # Configure WebApp Menu Button (left of input box)
        try:
            await bot.set_chat_menu_button(
                chat_id=message.chat.id,
                menu_button=MenuButtonWebApp(
                    text="🎮 Play",
                    web_app=WebAppInfo(url=webapp_url)
                )
            )
        except Exception as e:
            logger.warning(f"Could not set chat menu button: {e}")

        # Inline button that opens the Mini App
        keyboard = InlineKeyboardMarkup(
            inline_keyboard=[
                [
                    InlineKeyboardButton(
                        text="🌌 Launch Anti-Gravity Game",
                        web_app=WebAppInfo(url=webapp_url)
                    )
                ],
                [
                    InlineKeyboardButton(
                        text="🏆 Leaderboard & Tips",
                        callback_data="game_help"
                    )
                ]
            ]
        )

        welcome_text = (
            f"👋 <b>Welcome, {user_name}!</b>\n\n"
            "🌀 <b>Anti-Gravity: Quantum Core</b> is ready for launch.\n\n"
            "✨ <b>Mechanics:</b>\n"
            "• Manipulate cosmic gravity vectors (Normal, Inverted, Zero-G Float)\n"
            "• Guide the Quantum Core to gather Plasma Crystals\n"
            "• Avoid anti-matter anomalies and cosmic lasers\n"
            "• High-score synchronized with Telegram backend\n\n"
            "Tap below to begin your mission!"
        )

        await message.answer(
            text=welcome_text,
            reply_markup=keyboard,
            parse_mode="HTML"
        )

    @dp.callback_query(lambda c: c.data == "game_help")
    async def help_callback_handler(callback_query: types.CallbackQuery):
        help_text = (
            "🪐 <b>How to Play:</b>\n\n"
            "1. <b>Gravity Controls:</b> Tap the <b>GRAVITY SWITCH</b> button or spacebar to cycle through:\n"
            "   • ⬇️ <b>Normal:</b> Standard downward pull\n"
            "   • ⬆️ <b>Inverted:</b> Downward forces reversed!\n"
            "   • 🟢 <b>Zero-G:</b> Pure weightlessness & inertia drift\n"
            "2. <b>Thruster Impulse:</b> Tap on the screen in Zero-G to fire directional micro-thrusters.\n"
            "3. <b>Points:</b> Collect glowing Quantum Crystals. Consecutive pickups without touching hazards create combos!\n"
            "4. <b>Leaderboard:</b> Scores are validated using your authenticated Telegram session."
        )
        await callback_query.answer()
        await callback_query.message.answer(text=help_text, parse_mode="HTML")

    return dp
