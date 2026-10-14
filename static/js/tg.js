/**
 * Telegram WebApp Integration Layer
 * Wraps Telegram WebApp SDK, handles haptics, theme, and backend API communication.
 */
class TelegramBridge {
  constructor() {
    this.tg = window.Telegram?.WebApp || null;
    this.isInsideTelegram = !!(this.tg && this.tg.initData);
    this.user = null;
    this.initData = "";

    this.initialize();
  }

  initialize() {
    if (this.isInsideTelegram) {
      try {
        this.tg.ready();
        this.tg.expand();
        this.initData = this.tg.initData;

        // Extract user data from initDataUnsafe
        if (this.tg.initDataUnsafe && this.tg.initDataUnsafe.user) {
          this.user = this.tg.initDataUnsafe.user;
        }

        // Apply Telegram theme colors if available
        this.applyThemeColors();

        // Setup MainButton / BackButton behavior if needed
        this.tg.BackButton?.onClick(() => {
          console.log("Back button clicked");
        });

        console.log("[TelegramBridge] Initialized inside Telegram client:", this.user);
      } catch (e) {
        console.warn("[TelegramBridge] Failed to fully initialize Telegram SDK:", e);
      }
    } else {
      console.log("[TelegramBridge] Running in standalone browser / Dev mode");
      this.initData = "test_dev_mode";
      this.user = {
        id: 999999,
        first_name: "Commander",
        username: "cosmic_pilot"
      };
    }
  }

  applyThemeColors() {
    if (!this.tg) return;
    const theme = this.tg.themeParams;
    if (theme) {
      if (theme.bg_color) {
        document.documentElement.style.setProperty('--bg-primary', theme.bg_color);
      }
      if (theme.button_color) {
        document.documentElement.style.setProperty('--primary-accent', theme.button_color);
      }
    }
  }

  // --- Haptic Feedback Methods ---
  hapticImpact(style = 'medium') {
    // style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft'
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.impactOccurred(style);
      } catch (e) {
        console.warn("Haptics failed:", e);
      }
    }
  }

  hapticNotification(type = 'success') {
    // type: 'error' | 'success' | 'warning'
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.notificationOccurred(type);
      } catch (e) {
        console.warn("Haptics failed:", e);
      }
    }
  }

  hapticSelection() {
    if (this.tg?.HapticFeedback) {
      try {
        this.tg.HapticFeedback.selectionChanged();
      } catch (e) {
        console.warn("Haptics failed:", e);
      }
    }
  }

  // --- Backend API Integration ---
  async verifySession() {
    try {
      const response = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initData: this.initData })
      });
      if (response.ok) {
        const data = await response.json();
        return data;
      }
      return null;
    } catch (e) {
      console.warn("[TelegramBridge] Session verification failed:", e);
      return null;
    }
  }

  async submitScore(score, collectedGems = 0) {
    try {
      const response = await fetch('/api/score/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initData: this.initData,
          score: Math.round(score),
          collected_gems: collectedGems
        })
      });
      if (response.ok) {
        return await response.json();
      }
      return null;
    } catch (e) {
      console.error("[TelegramBridge] Error submitting score:", e);
      return null;
    }
  }

  async fetchLeaderboard() {
    try {
      const response = await fetch('/api/score/leaderboard');
      if (response.ok) {
        return await response.json();
      }
      return { leaderboard: [] };
    } catch (e) {
      console.error("[TelegramBridge] Error fetching leaderboard:", e);
      return { leaderboard: [] };
    }
  }
}

// Global instance
window.tgBridge = new TelegramBridge();
