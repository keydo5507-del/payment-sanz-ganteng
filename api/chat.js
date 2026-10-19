/**
 * POST /api/chat — Gemini AI
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = config.gemini?.apiKey;
  const model = config.gemini?.model || "gemini-3.5-flash-lite";
  const baseUrl = (config.gemini?.baseUrl || "https://generativelanguage.googleapis.com/v1beta").replace(/\/$/, "");

  if (!apiKey || apiKey.startsWith("YOUR_")) {
    return res.status(500).json({
      error: "API Key Gemini belum diisi. Buka api/config.js → gemini.apiKey",
    });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { message, history = [] } = body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Pesan kosong" });
    }

    const systemPrompt = `Kamu adalah asisten AI resmi website "${config.app.name}".
Bantu user tentang: cara bayar QRIS/transfer, upload bukti, status referensi, login/daftar.
Jawab singkat, ramah, Bahasa Indonesia. Tolak sopan jika di luar topik.`;

    const contents = [
      { role: "user", parts: [{ text: systemPrompt }] },
      { role: "model", parts: [{ text: "Siap membantu seputar pembayaran." }] },
      ...history.slice(-6).map((h) => ({
        role: h.role === "user" ? "user" : "model",
        parts: [{ text: String(h.text || "") }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const url = `${baseUrl}/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents,
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 1024,
        },
      }),
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const errMsg =
        data?.error?.message ||
        data?.error?.status ||
        `HTTP ${response.status}`;
      console.error("Gemini error:", response.status, data);
      return res.status(500).json({
        error: `Gemini: ${errMsg}`,
        model,
        hint: "Cek apiKey & model di api/config.js (gemini-3.5-flash-lite / gemini-3.6-flash / gemini-3.8-flash)",
      });
    }

    const text =
      data.candidates?.[0]?.content?.parts?.[0]?.text ||
      "Maaf, saya tidak bisa menjawab saat ini.";

    return res.status(200).json({ reply: text, model });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server error: " + (err.message || "unknown") });
  }
};
