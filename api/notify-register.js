/**
 * POST /api/notify-register
 * Kirim data pendaftar baru ke SEMUA owner via Telegram
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { botToken, ownerIds } = config.telegram || {};
  if (!botToken || !ownerIds?.length) {
    return res.status(500).json({ error: "Telegram config belum diisi" });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { name, email, createdAt } = body;
    if (!name || !email) {
      return res.status(400).json({ error: "Nama & email wajib" });
    }

    const waktu = createdAt
      ? new Date(createdAt).toLocaleString("id-ID", { timeZone: "Asia/Jakarta" })
      : new Date().toLocaleString("id-ID", { timeZone: "Asia/Jakarta" });

    const text = [
      "🆕 PENDAFTAR BARU",
      "━━━━━━━━━━━━",
      `👤 Nama: ${name}`,
      `📧 Email: ${email}`,
      `🕐 Waktu: ${waktu}`,
      "━━━━━━━━━━━━",
      "Data akun tersimpan di browser user.",
    ].join("\n");

    const results = [];
    for (const chatId of ownerIds) {
      const r = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          disable_web_page_preview: true,
        }),
      });
      const j = await r.json();
      results.push({ chatId, ok: j.ok });
    }

    return res.status(200).json({ ok: results.some((x) => x.ok), results });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: err.message || "Gagal kirim notifikasi" });
  }
};
