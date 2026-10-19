/**
 * POST /api/owner-login
 * Login khusus owner (username + password dari config)
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const { username, password } = body;
    const o = config.owner || {};

    if (!o.username || !o.password) {
      return res.status(500).json({ error: "Owner belum dikonfigurasi di api/config.js" });
    }

    if (username === o.username && password === o.password) {
      // token sederhana (bukan JWT production)
      const token = Buffer.from(`owner:${Date.now()}:${o.username}`).toString("base64");
      return res.status(200).json({ ok: true, token, role: "owner" });
    }

    return res.status(401).json({ error: "Username atau sandi owner salah" });
  } catch (err) {
    return res.status(500).json({ error: "Error login owner" });
  }
};
