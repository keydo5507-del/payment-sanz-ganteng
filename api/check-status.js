/**
 * POST /api/check-status
 * Cek apakah admin sudah ACC / tolak (callback_query)
 * Token tetap di server
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { botToken } = config.telegram || {};
  if (!botToken) return res.status(500).json({ error: "Config Telegram belum diisi" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { ref, messageIds, caption } = body || {};
    if (!ref) return res.status(400).json({ error: "ref wajib" });

    const tgRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100&allowed_updates=${encodeURIComponent('["callback_query"]')}`
    );
    const data = await tgRes.json();
    const hit = (data.result || [])
      .map((u) => u.callback_query)
      .find((c) => c && (c.data === "acc:" + ref || c.data === "no:" + ref));

    if (!hit) {
      return res.status(200).json({ status: "pending" });
    }

    const ok = hit.data.startsWith("acc:");

    // Jawab callback
    await fetch(
      `https://api.telegram.org/bot${botToken}/answerCallbackQuery?callback_query_id=${hit.id}&text=${encodeURIComponent(ok ? "Pembayaran di-ACC" : "Bukti ditolak")}`
    ).catch(() => {});

    // Update caption di semua owner (jika messageIds ada)
    if (messageIds && caption) {
      for (const [chatId, mid] of Object.entries(messageIds)) {
        await fetch(
          `https://api.telegram.org/bot${botToken}/editMessageCaption?chat_id=${chatId}&message_id=${mid}&caption=${encodeURIComponent(caption + "\nStatus: " + (ok ? "✅ ACC" : "❌ DITOLAK"))}`
        ).catch(() => {});
      }
    }

    return res.status(200).json({
      status: ok ? "accepted" : "rejected",
      adminLinks: {
        telegram: config.app.telegramAdmin,
        whatsapp: `https://wa.me/${config.app.whatsappAdmin}?text=${encodeURIComponent(
          `Halo admin, pembayaran saya sudah di-ACC.\nRef: ${ref}`
        )}`,
      },
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Gagal cek status" });
  }
};
