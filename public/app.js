/* ============================================================
   Al Payment Sanz – Frontend
   ============================================================ */

const $ = (id) => document.getElementById(id);
const STORAGE_USERS = "sanz_users";
const STORAGE_SESSION = "sanz_session";
const STORAGE_OWNER = "sanz_owner_token";

let publicConfig = null;
let currentUser = null;
let isOwner = false;
let tipe = "";
let buyerData = null;
let selectedMethod = null;
let ref = "";
let chatHistory = [];
let lastMessageIds = null;
let lastCaption = "";

const rp = (n) => "Rp " + n.toLocaleString("id-ID");

function getUsers() {
  try { return JSON.parse(localStorage.getItem(STORAGE_USERS) || "[]"); }
  catch { return []; }
}
function saveUsers(list) {
  localStorage.setItem(STORAGE_USERS, JSON.stringify(list));
}
function getSession() {
  try { return JSON.parse(localStorage.getItem(STORAGE_SESSION) || "null"); }
  catch { return null; }
}
function setSession(user) {
  localStorage.setItem(STORAGE_SESSION, JSON.stringify({ name: user.name, email: user.email }));
}
function clearSession() {
  localStorage.removeItem(STORAGE_SESSION);
}

async function hashPw(pw) {
  const data = new TextEncoder().encode("sanz:" + pw);
  const buf = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function loadPublicConfig() {
  try {
    const res = await fetch("/api/public-config");
    publicConfig = await res.json();
  } catch {
    publicConfig = { app: { name: "Al Payment Sanz", telegramAdmin: "#", whatsappAdmin: "" } };
  }
}

/* ---------- Auth UI ---------- */
function showLogin() {
  $("login-screen").classList.remove("hide");
  $("app-header").classList.add("hide");
  $("progress").classList.add("hide");
  $("owner-panel").classList.add("hide");
  ["step-buyer", "step-method", "step-pay", "step-result"].forEach((id) => $(id).classList.add("hide"));
}

function showApp() {
  isOwner = false;
  $("login-screen").classList.add("hide");
  $("owner-panel").classList.add("hide");
  $("app-header").classList.remove("hide");
  $("progress").classList.remove("hide");
  $("user-name").textContent = currentUser.name?.split(" ")[0] || "User";
  goStep("buyer");
}

function showOwnerPanel() {
  isOwner = true;
  $("login-screen").classList.add("hide");
  $("app-header").classList.remove("hide");
  $("progress").classList.add("hide");
  ["step-buyer", "step-method", "step-pay", "step-result"].forEach((id) => $(id).classList.add("hide"));
  $("owner-panel").classList.remove("hide");
  $("user-name").textContent = "Owner";
  renderOwnerList();
}

function switchTab(tab) {
  $("tab-login").classList.toggle("active", tab === "login");
  $("tab-register").classList.toggle("active", tab === "register");
  $("tab-owner").classList.toggle("active", tab === "owner");
  $("form-login").classList.toggle("hide", tab !== "login");
  $("form-register").classList.toggle("hide", tab !== "register");
  $("form-owner").classList.toggle("hide", tab !== "owner");
  const titles = {
    login: ["Masuk", "Masuk untuk melanjutkan pembayaran"],
    register: ["Daftar", "Buat akun baru untuk mulai bayar"],
    owner: ["Owner", "Login khusus admin / owner"],
  };
  $("auth-title").textContent = titles[tab][0];
  $("auth-sub").textContent = titles[tab][1];
  ["login-err", "reg-err", "owner-err"].forEach((id) => { $(id).textContent = ""; });
}

$("tab-login").onclick = () => switchTab("login");
$("tab-register").onclick = () => switchTab("register");
$("tab-owner").onclick = () => switchTab("owner");

document.querySelectorAll(".eye").forEach((btn) => {
  btn.onclick = () => {
    const input = $(btn.dataset.target);
    if (!input) return;
    const show = input.type === "password";
    input.type = show ? "text" : "password";
    btn.textContent = show ? "🙈" : "👁";
  };
});

/* ---------- DAFTAR ---------- */
$("btn-do-register").onclick = async () => {
  const err = $("reg-err");
  err.textContent = "";
  const name = $("reg-name").value.trim();
  const email = $("reg-email").value.trim().toLowerCase();
  const pw = $("reg-pw").value;
  const pw2 = $("reg-pw2").value;

  if (name.length < 2) { err.textContent = "Nama minimal 2 karakter."; $("reg-name").focus(); return; }
  if (!/^[a-z0-9._%+-]+@gmail\.com$/.test(email)) {
    err.textContent = "Akun harus email @gmail.com yang valid.";
    $("reg-email").focus();
    return;
  }
  if (pw.length < 4) { err.textContent = "Sandi minimal 4 karakter."; $("reg-pw").focus(); return; }
  if (pw !== pw2) { err.textContent = "Ulangi sandi tidak sama."; $("reg-pw2").focus(); return; }

  const users = getUsers();
  if (users.some((u) => u.email === email)) {
    err.textContent = "Email ini sudah terdaftar. Silakan masuk.";
    return;
  }
  if (users.some((u) => u.name.toLowerCase() === name.toLowerCase())) {
    err.textContent = "Nama ini sudah dipakai.";
    return;
  }

  const passwordHash = await hashPw(pw);
  const createdAt = Date.now();
  users.push({ name, email, passwordHash, createdAt });
  saveUsers(users);

  // Kirim data ke owner via Telegram (semua perangkat)
  try {
    await fetch("/api/notify-register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, createdAt }),
    });
  } catch (e) {
    console.warn("Gagal notifikasi owner:", e);
  }

  currentUser = { name, email };
  setSession(currentUser);
  showApp();
};

/* ---------- LOGIN USER ---------- */
$("btn-do-login").onclick = async () => {
  const err = $("login-err");
  err.textContent = "";
  const id = $("login-id").value.trim();
  const pw = $("login-pw").value;
  if (!id) { err.textContent = "Isi nama atau email."; return; }
  if (!pw) { err.textContent = "Isi sandi."; return; }

  const users = getUsers();
  const idLower = id.toLowerCase();
  const user = users.find(
    (u) => u.email === idLower || u.name.toLowerCase() === idLower || u.email === id || u.name === id
  );
  if (!user) { err.textContent = "Akun tidak ditemukan. Daftar dulu."; return; }

  const passwordHash = await hashPw(pw);
  if (passwordHash !== user.passwordHash) {
    err.textContent = "Sandi salah.";
    return;
  }

  currentUser = { name: user.name, email: user.email };
  setSession(currentUser);
  showApp();
};

/* ---------- OWNER LOGIN ---------- */
$("btn-owner-login").onclick = async () => {
  const err = $("owner-err");
  err.textContent = "";
  const username = $("owner-user").value.trim();
  const password = $("owner-pw").value;
  if (!username || !password) {
    err.textContent = "Isi username dan sandi owner.";
    return;
  }

  try {
    const res = await fetch("/api/owner-login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });
    const data = await res.json();
    if (!res.ok) {
      err.textContent = data.error || "Login gagal";
      return;
    }
    localStorage.setItem(STORAGE_OWNER, data.token);
    showOwnerPanel();
  } catch (e) {
    err.textContent = "Gagal terhubung ke server.";
  }
};

function renderOwnerList() {
  const box = $("owner-user-list");
  const users = getUsers();
  if (!users.length) {
    box.innerHTML = `<div class="owner-item"><small>Belum ada akun di perangkat ini. Pendaftar dari HP/browser lain tetap masuk ke Telegram owner.</small></div>`;
    return;
  }
  box.innerHTML = users
    .slice()
    .reverse()
    .map((u, i) => {
      const t = u.createdAt
        ? new Date(u.createdAt).toLocaleString("id-ID")
        : "-";
      const safeEmail = escapeHtml(u.email);
      return `<div class="owner-item">
        <b>${escapeHtml(u.name)}</b>
        <small>${safeEmail}</small>
        <small>Daftar: ${t}</small>
        <button type="button" class="del" data-email="${safeEmail}">Hapus akun</button>
      </div>`;
    })
    .join("");

  box.querySelectorAll(".del").forEach((btn) => {
    btn.onclick = () => {
      if (!confirm("Hapus akun " + btn.dataset.email + " dari perangkat ini?")) return;
      const next = getUsers().filter((u) => u.email !== btn.dataset.email);
      saveUsers(next);
      renderOwnerList();
    };
  });
}

$("btn-owner-refresh").onclick = () => renderOwnerList();
$("btn-owner-logout").onclick = () => {
  localStorage.removeItem(STORAGE_OWNER);
  isOwner = false;
  location.reload();
};

$("btn-logout").onclick = () => {
  clearSession();
  localStorage.removeItem(STORAGE_OWNER);
  currentUser = null;
  isOwner = false;
  location.reload();
};

function checkSession() {
  if (localStorage.getItem(STORAGE_OWNER)) {
    showOwnerPanel();
    return;
  }
  const s = getSession();
  if (s?.name && s?.email) {
    currentUser = s;
    showApp();
  } else {
    showLogin();
    switchTab("login");
  }
}

/* ---------- STEPS ---------- */
function goStep(step) {
  ["step-buyer", "step-method", "step-pay", "step-result"].forEach((id) => $(id).classList.add("hide"));
  $("step-" + step).classList.remove("hide");
  const map = { buyer: 1, method: 2, pay: 3, result: 4 };
  const n = map[step] || 1;
  for (let i = 1; i <= 4; i++) $("p" + i).classList.toggle("active", i <= n);
}

document.querySelectorAll("#tipe .chip").forEach((b) => {
  b.onclick = () => {
    tipe = b.dataset.t;
    document.querySelectorAll("#tipe .chip").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
  };
});

$("bn").oninput = (e) => {
  const v = e.target.value.replace(/\D/g, "");
  e.target.value = v ? (+v).toLocaleString("id-ID") : "";
};

function validateBuyer() {
  const u = $("bu").value.trim();
  const a = $("ba").value.trim();
  const n = parseInt($("bn").value.replace(/\D/g, "")) || 0;
  const e = $("berr");
  e.textContent = "";
  if (u.length < 3) { e.textContent = "Username minimal 3 karakter."; $("bu").focus(); return null; }
  if (a.length < 2) { e.textContent = "Isi nama aplikasi."; $("ba").focus(); return null; }
  if (n < 1) { e.textContent = "Isi nominal pembayaran."; $("bn").focus(); return null; }
  if (!tipe) { e.textContent = "Pilih DP atau LUNAS."; return null; }
  return { u, a, n, t: tipe };
}

$("btn-next-method").onclick = () => {
  buyerData = validateBuyer();
  if (!buyerData) return;
  $("sum-method").textContent = `${buyerData.u} · ${buyerData.a} · ${rp(buyerData.n)} (${buyerData.t})`;
  goStep("method");
};
$("btn-back-buyer").onclick = () => goStep("buyer");

const METHODS = [
  { id: "qris", n: "QRIS", d: "Scan dengan e-wallet atau m-banking" },
  { id: "rek", n: "Transfer rekening", d: "a.n. Nope" },
];
METHODS.forEach((m) => {
  const b = document.createElement("button");
  b.className = "m";
  b.type = "button";
  b.innerHTML = `<b>${m.n}</b><small>${m.d}</small>`;
  b.onclick = () => openMethod(m);
  $("list").append(b);
});

function openMethod(m) {
  selectedMethod = m;
  ref = "ALP" + Date.now().toString().slice(-9);
  const body =
    m.id === "qris"
      ? `<p class="sub">Scan lalu bayar sebesar <b>${rp(buyerData.n)}</b> (${buyerData.t})</p>
         <img class="qr" src="data:image/png;base64,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" alt="QRIS">`
      : `<p class="sub">Transfer sebesar <b>${rp(buyerData.n)}</b> (${buyerData.t})</p>
         <div class="rek"><small>Atas nama Nope</small><b>088242327499</b>
         <button type="button" class="chip" onclick="navigator.clipboard.writeText('088242327499').then(()=>this.textContent='Tersalin')">Salin</button></div>`;

  $("step-pay").innerHTML = `
    <h1>${m.n}</h1>
    <div class="sum">${buyerData.u} · ${buyerData.a}</div>
    ${body}
    <button class="pay" id="conf">Saya sudah bayar</button>
    <button class="ghost" id="back-method">Ganti metode</button>`;
  goStep("pay");
  $("back-method").onclick = () => goStep("method");
  $("conf").onclick = () => showUploadForm();
}

function showUploadForm() {
  lastCaption = [
    "Bukti bayar",
    `Metode: ${selectedMethod.n}`,
    `Ref: ${ref}`,
    `Username: ${buyerData.u}`,
    `Aplikasi: ${buyerData.a}`,
    `Nominal: ${rp(buyerData.n)}`,
    `Jenis: ${buyerData.t}`,
    `Login: ${currentUser?.email || currentUser?.name || "-"}`,
  ].join("\n");

  $("step-pay").innerHTML = `
    <h1>Kirim bukti bayar</h1>
    <p class="sub">Unggah foto atau screenshot bukti pembayaran</p>
    <input type="file" id="bk" class="file" accept="image/*,application/pdf">
    <div class="err" id="msg" role="alert"></div>
    <button class="pay" id="kb">Kirim bukti</button>
    <button class="ghost" id="back-pay">← Kembali</button>`;
  $("back-pay").onclick = () => openMethod(selectedMethod);

  $("kb").onclick = async () => {
    const msg = $("msg");
    const file = $("bk").files[0];
    msg.textContent = "";
    if (!file) { msg.textContent = "Pilih file bukti pembayaran dulu."; return; }
    if (file.size > 5 * 1024 * 1024) { msg.textContent = "Ukuran file maksimal 5 MB."; return; }
    $("kb").disabled = true;
    $("kb").textContent = "Mengirim…";
    try {
      const base64 = await fileToBase64(file);
      const res = await fetch("/api/send-proof", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ref, method: selectedMethod.n, username: buyerData.u, aplikasi: buyerData.a,
          nominal: rp(buyerData.n), jenis: buyerData.t,
          email: currentUser?.email || currentUser?.name,
          fileBase64: base64, fileName: file.name, fileMime: file.type,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal kirim");
      lastMessageIds = data.messageIds || null;
      tunggu();
    } catch (e) {
      msg.textContent = "Gagal mengirim: " + (e.message || "coba lagi");
      $("kb").disabled = false;
      $("kb").textContent = "Kirim bukti";
    }
  };
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function tunggu() {
  $("step-result").innerHTML = `
    <div class="wait">⏳</div>
    <h1>Menunggu konfirmasi</h1>
    <p class="sub">Bukti sudah terkirim ke admin. Jangan tutup halaman ini.</p>
    <p class="sub">No. referensi <b>${ref}</b></p>`;
  goStep("result");
  const t0 = Date.now();
  while (Date.now() - t0 < 10 * 60 * 1000) {
    await new Promise((r) => setTimeout(r, 3000));
    try {
      const res = await fetch("/api/check-status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ref, messageIds: lastMessageIds, caption: lastCaption }),
      });
      const data = await res.json();
      if (data.status === "accepted") {
        const tg = data.adminLinks?.telegram || publicConfig?.app?.telegramAdmin || "#";
        const wa = data.adminLinks?.whatsapp || "#";
        $("step-result").innerHTML = `
          <div class="ok">✓</div><h1>Pembayaran dikonfirmasi</h1>
          <p class="sub">No. referensi ${ref}</p>
          <p class="sub">Hubungi admin:</p>
          <a class="pay wa" href="${tg}" target="_blank" rel="noopener">Chat Telegram admin</a>
          <a class="pay wa" href="${wa}" target="_blank" rel="noopener" style="margin-top:8px">Chat WhatsApp admin</a>
          <button class="ghost" onclick="location.reload()">Selesai</button>`;
        return;
      }
      if (data.status === "rejected") {
        $("step-result").innerHTML = `
          <div class="ok no">✕</div><h1>Bukti ditolak</h1>
          <p class="sub">No. referensi: ${ref}</p>
          <button class="ghost" onclick="location.reload()">Kembali</button>`;
        return;
      }
    } catch (e) {}
  }
  $("step-result").innerHTML = `
    <h1>Belum ada konfirmasi</h1>
    <p class="sub">Simpan No. referensi <b>${ref}</b> dan hubungi admin.</p>
    <button class="ghost" onclick="location.reload()">Kembali</button>`;
}

/* ---------- AI CHAT ---------- */
$("chat-toggle").onclick = () => $("chat-box").classList.toggle("hide");
$("chat-close").onclick = () => $("chat-box").classList.add("hide");

async function sendChat() {
  const input = $("chat-input");
  const text = input.value.trim();
  if (!text) return;
  const msgs = $("chat-msgs");
  msgs.innerHTML += `<div class="msg user">${escapeHtml(text)}</div>`;
  input.value = "";
  msgs.scrollTop = msgs.scrollHeight;
  chatHistory.push({ role: "user", text });

  const loading = document.createElement("div");
  loading.className = "msg bot";
  loading.textContent = "Mengetik…";
  msgs.appendChild(loading);
  msgs.scrollTop = msgs.scrollHeight;

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: chatHistory.slice(-6) }),
    });
    const data = await res.json().catch(() => ({}));
    loading.remove();
    if (!res.ok) {
      const errText = data.error || data.hint || `Error ${res.status}`;
      msgs.innerHTML += `<div class="msg bot">${escapeHtml(errText)}</div>`;
    } else {
      const reply = data.reply || "Maaf, kosong.";
      msgs.innerHTML += `<div class="msg bot">${escapeHtml(reply)}</div>`;
      chatHistory.push({ role: "model", text: reply });
    }
  } catch (e) {
    loading.remove();
    msgs.innerHTML += `<div class="msg bot">Gagal terhubung ke /api/chat. Pastikan deploy Vercel sudah include folder api/ dan redeploy.</div>`;
  }
  msgs.scrollTop = msgs.scrollHeight;
}

$("chat-send").onclick = sendChat;
$("chat-input").onkeydown = (e) => { if (e.key === "Enter") sendChat(); };

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadPublicConfig();
  checkSession();
});
