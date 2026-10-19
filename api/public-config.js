/**
 * GET /api/public-config
 * Data aman untuk frontend
 */
const config = require("./config");

module.exports = async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Cache-Control", "no-store");

  if (req.method === "OPTIONS") return res.status(200).end();
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  return res.status(200).json({
    app: {
      name: config.app.name,
      telegramAdmin: config.app.telegramAdmin,
      whatsappAdmin: config.app.whatsappAdmin,
    },
  });
};
