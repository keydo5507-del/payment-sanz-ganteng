/**
 * ============================================================
 *  CONFIG SERVER-SIDE SAJA (folder api/)
 * ============================================================
 */
module.exports = {
  // ---------- Telegram Bot ----------
  telegram: {
    botToken: "8948934520:AAGwMVbINzvw8kYeqKKUk0N4T0hHYKDYXRg",
    ownerIds: [
      "8719557370",   // Owner 1
      "5916421026",   // Owner 2 ← ganti
    ],
  },

  // ---------- Login Owner (panel admin) ----------
  owner: {
    username: "key",
    password: "270811", // ganti sandi kuat
  },

  // ---------- Gemini AI ----------
  gemini: {
    // Model terbaru (2026). Bisa diganti: gemini-3.5-flash-lite | gemini-3.6-flash | gemini-3.8-flash
    model: "gemini-3.5-flash",
    apiKey: "AQ.Ab8RN6KCxQPqzuLOaGKyTlYBzvZZvJBgzO3Q_mMM4ScbYlEUrQ", // dari https://aistudio.google.com/apikey
    // Base URL resmi Google AI
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
  },

  // ---------- App ----------
  app: {
    name: "Al Payment Sanz",
    telegramAdmin: "https://t.me/SANZGNTNG",
    whatsappAdmin: "6283139901289",
  },
};
