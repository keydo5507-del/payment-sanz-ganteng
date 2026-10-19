# Al Payment Sanz

## Perbaikan AI (Gemini)

Di `api/config.js`:

```js
gemini: {
  model: "gemini-3.5-flash-lite",  // atau gemini-3.6-flash / gemini-3.8-flash
  apiKey: "AIzaSy....",           // WAJIB diisi dari aistudio.google.com
  baseUrl: "https://generativelanguage.googleapis.com/v1beta",
},
```

Endpoint yang dipakai:
`POST {baseUrl}/models/{model}:generateContent?key=...`

Jika AI masih gagal, error detail sekarang muncul di chat (bukan hanya "Gagal terhubung").

## Owner

```js
owner: {
  username: "owner",
  password: "owner1234",  // ganti!
},
```

Tab **Owner** di layar login → panel:
- Lihat akun di perangkat ini
- Hapus akun
- Setiap **daftar baru** otomatis dikirim ke Telegram semua `ownerIds`

## Deploy ulang

1. Isi `apiKey` Gemini + bot + owner di `api/config.js`
2. Push GitHub
3. Vercel Redeploy (pastikan folder `api/` ikut)

## Struktur api/

- config.js
- chat.js
- notify-register.js  ← data daftar → Telegram
- owner-login.js
- send-proof.js
- check-status.js
- public-config.js
