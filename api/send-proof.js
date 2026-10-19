/**
 * POST /api/send-proof
 * Kirim bukti pembayaran ke SEMUA owner via Telegram
 * Bot token & owner IDs hanya ada di server (api/config.js)
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const { botToken, ownerIds } = config.telegram || {};
  if (!botToken || botToken.startsWith("YOUR_") || !ownerIds?.length) {
    return res.status(500).json({ error: "Telegram config belum diisi di api/config.js" });
  }

  try {
    // Body: multipart/form-data dari browser
    // Vercel Node runtime mendukung req.body untuk JSON, untuk file kita pakai raw
    // Karena FormData dari client, kita gunakan pendekatan sederhana:
    // Client kirim base64 + metadata (lebih mudah di serverless)

    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const {
      ref,
      method,
      username,
      aplikasi,
      nominal,
      jenis,
      email,
      fileBase64,
      fileName,
      fileMime,
    } = body || {};

    if (!ref || !fileBase64) {
      return res.status(400).json({ error: "Data tidak lengkap" });
    }

    const caption = [
      "Bukti bayar",
      `Metode: ${method}`,
      `Ref: ${ref}`,
      `Username: ${username}`,
      `Aplikasi: ${aplikasi}`,
      `Nominal: ${nominal}`,
      `Jenis: ${jenis}`,
      `Login: ${email || "-"}`,
    ].join("\n");

    const isImage = (fileMime || "").startsWith("image/");
    const buffer = Buffer.from(fileBase64, "base64");

    const results = [];
    const messageIds = {};

    for (const chatId of ownerIds) {
      const form = new FormData();
      form.append("chat_id", chatId);
      form.append("caption", caption);
      form.append(
        "reply_markup",
        JSON.stringify({
          inline_keyboard: [
            [
              { text: "✅ ACC", callback_data: "acc:" + ref },
              { text: "❌ Tolak", callback_data: "no:" + ref },
            ],
          ],
        })
      );

      // Undici / native FormData di Node 18+
      const blob = new Blob([buffer], { type: fileMime || "application/octet-stream" });
      if (isImage) {
        form.append("photo", blob, fileName || "bukti.jpg");
      } else {
        form.append("document", blob, fileName || "bukti.pdf");
      }

      const apiMethod = isImage ? "sendPhoto" : "sendDocument";
      const tgRes = await fetch(`https://api.telegram.org/bot${botToken}/${apiMethod}`, {
        method: "POST",
        body: form,
      });
      const j = await tgRes.json();

      if (!j.ok && isImage) {
        // fallback document
        const form2 = new FormData();
        form2.append("chat_id", chatId);
        form2.append("caption", caption);
        form2.append(
          "reply_markup",
          JSON.stringify({
            inline_keyboard: [
              [
                { text: "✅ ACC", callback_data: "acc:" + ref },
                { text: "❌ Tolak", callback_data: "no:" + ref },
              ],
            ],
          })
        );
        form2.append("document", blob, fileName || "bukti.pdf");
        const tgRes2 = await fetch(`https://api.telegram.org/bot${botToken}/sendDocument`, {
          method: "POST",
          body: form2,
        });
        const j2 = await tgRes2.json();
        results.push({ chatId, ok: j2.ok, data: j2 });
        if (j2.ok) messageIds[chatId] = j2.result.message_id;
      } else {
        results.push({ chatId, ok: j.ok, data: j });
        if (j.ok) messageIds[chatId] = j.result.message_id;
      }
    }

    const anyOk = results.some((r) => r.ok);
    if (!anyOk) {
      const errMsg = results[0]?.data?.description || "Gagal kirim ke Telegram";
      return res.status(500).json({ error: errMsg });
    }

    return res.status(200).json({
      ok: true,
      ref,
      messageIds,
    });
  } catch (err) {
    console.error("send-proof error:", err);
    return res.status(500).json({ error: err.message || "Gagal mengirim bukti" });
  }
};
