// ============================================
// Telegram Registration-Wizard Bot — Vercel Function
// ============================================

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ACCOUNT_NUMBER = "1000102646437";
const BN_HEADER = "✨🎓📚 <b>𝗕𝗡 𝗔𝗖𝗔𝗗𝗘𝗠𝗬</b> 📚🎓✨\n•▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬•\n\n";
const DB_URL = "https://chemistry-quiz-b0389-default-rtdb.firebaseio.com";

const MAX_UNITS_PER_GRADE = 6;

const MATH_MAX_UNITS_PER_GRADE = { 9: 9, 10: 7, 11: 8, 12: 5 };
const CHEM_MAX_UNITS_PER_GRADE = { 9: 5, 10: 6, 11: 6, 12: 5 };
const HIST_MAX_UNITS_PER_GRADE = { 9: 9, 10: 9, 11: 9, 12: 9 };
const GEO_MAX_UNITS_PER_GRADE = { 9: 8, 10: 8, 11: 7, 12: 8 };
const ECON_MAX_UNITS_PER_GRADE = { 9: 8, 10: 8, 11: 7, 12: 8 };
const PHYS_MAX_UNITS_PER_GRADE = { 9: 7, 10: 6, 11: 7, 12: 5 };
const BIO_MAX_UNITS_PER_GRADE = { 9: 6, 10: 6, 11: 6, 12: 6 };

const DAILY_INVOCATION_LIMIT = 100; // 4 ምዝገባ x ~20 invocation + buffer
const MAX_COMPLETIONS_PER_DAY = 4; // ሙሉ ምዝገባ (registration) በቀን ለአንድ ተማሪ የሚፈቀደው ብዛት

const SUBJECTS = {
  social: [
    { key: "mathematics", label: "Mathematics" },
    { key: "geography", label: "Geography" },
    { key: "history", label: "History" },
    { key: "economics", label: "Economics" },
  ],
  natural: [
    { key: "mathematics", label: "Mathematics" },
    { key: "physics", label: "Physics" },
    { key: "chemistry", label: "Chemistry" },
    { key: "biology", label: "Biology" },
  ],
};

const COUNTRIES = [
  { code: "251", label: "🇪🇹 Ethiopia +251", length: 9, startsWith: "9" },
  { code: "1", label: "🇺🇸 USA/Canada +1", length: 10 },
  { code: "44", label: "🇬🇧 UK +44", length: 10 },
  { code: "254", label: "🇰🇪 Kenya +254", length: 9 },
  { code: "966", label: "🇸🇦 Saudi Arabia +966", length: 9 },
];

function isValidName(value) {
  const v = (value || "").trim();
  if (v.length < 4) return false;
  return /^[A-Za-z\u1200-\u137F]+$/.test(v);
}

function countryKeyboard() {
  return {
    inline_keyboard: [
      ...COUNTRIES.map((c) => [{ text: c.label, callback_data: `country:${c.code}` }]),
      [{ text: "🌍 ሌላ አገር (Other)", callback_data: "country:other" }],
    ],
  };
}

function getMaxUnits(subject, grade, track) {
  if (subject === "all") {
    const list = SUBJECTS[track] || [];
    const vals = list.map((x) => getMaxUnits(x.key, grade));
    return vals.length ? Math.max(...vals) : MAX_UNITS_PER_GRADE;
  }
  if (subject === "mathematics") return MATH_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "chemistry") return CHEM_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "history") return HIST_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "geography") return GEO_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "economics") return ECON_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "physics") return PHYS_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  if (subject === "biology") return BIO_MAX_UNITS_PER_GRADE[grade] || MAX_UNITS_PER_GRADE;
  return MAX_UNITS_PER_GRADE;
}

function isSubjectFull(session) {
  const ALL_GRADES = [9, 10, 11, 12];
  const grades = session.grades || [];
  if (grades.length !== ALL_GRADES.length) return false;
  if (!ALL_GRADES.every((g) => grades.includes(g))) return false;
  const unitsByGrade = session.unitsByGrade || {};
  return ALL_GRADES.every((g) => {
    const maxForGrade = getMaxUnits(session.subject, g, session.track);
    const selected = Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0;
    return selected >= maxForGrade;
  });
}

function computePrice(gradesCount, totalUnits, subject, session) {
  if (subject === "all") {
    // ሁሉም subject (4) + የመረጠው grade ሁሉም unit
    const ALL_SUBJECTS_PRICE = { 1: 400, 2: 500, 3: 580, 4: 800 };
    return ALL_SUBJECTS_PRICE[gradesCount] || 400;
  }
  if (subject === "mathematics" && session && isSubjectFull(session)) return 200;
  if (subject === "chemistry" && session && isSubjectFull(session)) return 200;
  if (subject === "history" && session && isSubjectFull(session)) return 200;
  if (subject === "geography" && session && isSubjectFull(session)) return 200;
  if (subject === "economics" && session && isSubjectFull(session)) return 200;
  if (subject === "physics" && session && isSubjectFull(session)) return 200;
  if (subject === "biology" && session && isSubjectFull(session)) return 200;
  if (gradesCount === 1) {
    if (totalUnits === 1) return 50;
    if (totalUnits === 2) return 70;
    if (totalUnits === 3) return 80;
    if (totalUnits === 4) return 85;
    if (totalUnits === 5) return 90;
    if (totalUnits >= 6) return 100;
  }
  if (gradesCount === 2) {
    if (totalUnits <= 6) return 100;
    if (totalUnits <= 11) return 120;
    if (totalUnits >= 12) return 125;
  }
  if (gradesCount === 3) {
    if (totalUnits <= 6) return 100;
    if (totalUnits <= 12) return 125;
    if (totalUnits >= 13) return 145;
  }
  if (gradesCount === 4) {
    if (totalUnits <= 6) return 100;
    if (totalUnits <= 12) return 125;
    if (totalUnits <= 18) return 145;
    if (totalUnits >= 19) return 170;
  }
  return 100;
}

async function getSession(chatId) {
  try {
    const res = await fetch(`${DB_URL}/bot_sessions/${chatId}.json`);
    const data = await res.json();
    if (!data) return { step: "idle", grades: [], unitsByGrade: {} };
    if (!Array.isArray(data.grades)) data.grades = [];
    if (!data.unitsByGrade || typeof data.unitsByGrade !== "object") data.unitsByGrade = {};
    return data;
  } catch (e) {
    return { step: "idle", grades: [], unitsByGrade: {} };
  }
}

async function saveSession(chatId, session) {
  try {
    await fetch(`${DB_URL}/bot_sessions/${chatId}.json`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(session),
    });
  } catch (e) {}
}

async function getSessionStep(chatId) {
  try {
    const res = await fetch(`${DB_URL}/bot_sessions/${chatId}.json`);
    const text = await res.text();
    if (!text || text === "null") return "idle";
    const data = JSON.parse(text);
    if (!data || typeof data !== "object") return "idle";
    return typeof data.step === "string" ? data.step : "idle";
  } catch (e) {
    return "idle";
  }
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

async function checkAndIncrementUsage(chatId) {
  const path = `${DB_URL}/bot_usage/${chatId}.json`;
  try {
    const res = await fetch(path);
    const current = await res.json();
    const now = Date.now();
    const hasWindow = current && typeof current.windowStart === "number";
    const windowExpired = !hasWindow || now - current.windowStart >= ONE_DAY_MS;
    const count = windowExpired ? 0 : current.count || 0;
    const windowStart = windowExpired ? now : current.windowStart;
    if (count >= DAILY_INVOCATION_LIMIT) {
      return { allowed: false, count };
    }
    const newCount = count + 1;
    await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowStart, count: newCount }),
    });
    return { allowed: true, count: newCount };
  } catch (e) {
    // If usage tracking fails for any reason, don't block the student
    return { allowed: true, count: 0 };
  }
}

async function getCompletionCount(chatId) {
  const path = `${DB_URL}/bot_completions/${chatId}.json`;
  try {
    const res = await fetch(path);
    const current = await res.json();
    const now = Date.now();
    const hasWindow = current && typeof current.windowStart === "number";
    const windowExpired = !hasWindow || now - current.windowStart >= ONE_DAY_MS;
    return windowExpired ? 0 : current.count || 0;
  } catch (e) {
    return 0;
  }
}

async function incrementCompletionCount(chatId) {
  const path = `${DB_URL}/bot_completions/${chatId}.json`;
  try {
    const res = await fetch(path);
    const current = await res.json();
    const now = Date.now();
    const hasWindow = current && typeof current.windowStart === "number";
    const windowExpired = !hasWindow || now - current.windowStart >= ONE_DAY_MS;
    const count = windowExpired ? 0 : current.count || 0;
    const windowStart = windowExpired ? now : current.windowStart;
    await fetch(path, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ windowStart, count: count + 1 }),
    });
  } catch (e) {}
}

async function tg(method, payload) {
  const res = await fetch(`${TELEGRAM_API}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return res.json();
}

async function sendMessage(chatId, text, extra = {}) {
  return tg("sendMessage", { chat_id: chatId, text, parse_mode: "HTML", ...extra });
}

async function editMarkup(chatId, messageId, replyMarkup) {
  return tg("editMessageReplyMarkup", {
    chat_id: chatId,
    message_id: messageId,
    reply_markup: replyMarkup,
  });
}

async function answerCallbackQuery(id, text, showAlert = false) {
  await tg("answerCallbackQuery", { callback_query_id: id, text, show_alert: showAlert });
}

function personName(from) {
  const first = from.first_name || "";
  const last = from.last_name || "";
  const username = from.username ? `@${from.username}` : "(username የለውም)";
  return { fullName: `${first} ${last}`.trim(), username };
}

async function notifyAdmin(text) {
  if (!ADMIN_CHAT_ID) return;
  await sendMessage(ADMIN_CHAT_ID, text);
}

function trackKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "A. Social subject", callback_data: "track:social" }],
      [{ text: "B. Natural subject", callback_data: "track:natural" }],
    ],
  };
}

function subjectKeyboard(track, selected) {
  const letters = ["A", "B", "C", "D"];
  return {
    inline_keyboard: [
      ...SUBJECTS[track].map((s, i) => [
        { text: `${selected === s.key || selected === "all" ? "✅ " : ""}${letters[i]}. ${s.label}`, callback_data: `subj:${s.key}` },
      ]),
      [{ text: selected === "all" ? "✅ ሁሉንም subject ተመርጧል (ለማንሳት ይንኩ)" : "☑️ ሁሉንም subject ምረጥ (Select all subjects)", callback_data: "subj:all" }],
      [{ text: "✅ ጨርሻለሁ (Done)", callback_data: "subj_done" }],
    ],
  };
}

function namePromptText() {
  return (
    `እባክዎትን application ሲጠቀሙ ወደ premium future ሲገቡ የተጠቀሙበት first name, last name እና your phone ነበር የተጠቀሙበት ትክክለኛውን እራሱን spelling ሳይሳሳቱ ያስገቡ🙏\n` +
    `ከረሱት application nave button ላይ አካውት የሚለውን በመንካት ከተዘረዘሩት ውስጥ my info(የኔ መረጃ) የሚለውን ነክተው copy የምትለዋን ነክተው copy አድርገው እዚ ላይ መለጠፍ(paste) ማድረግ ይችላሉ !! እባክዋ ያስገቡ🙏!?\n\n` +
    `👉 <b>First name</b> ያስገቡ፦`
  );
}

function gradeKeyboard(selectedGrades) {
  const grades = [9, 10, 11, 12];
  const letters = ["A", "B", "C", "D"];
  return {
    inline_keyboard: [
      ...grades.map((g, i) => {
        const selected = selectedGrades.includes(g);
        return [{ text: `${selected ? "✅ " : ""}${letters[i]}. Grade ${g}`, callback_data: `grade:${g}` }];
      }),
      [{ text: grades.every((g) => selectedGrades.includes(g)) ? "☑️ ሁሉንም grade አንሳ (Clear all)" : "☑️ ሁሉንም grade ምረጥ (Select all grades)", callback_data: "grades_all" }],
      [{ text: "✅ ጨርሻለሁ (Done)", callback_data: "grades_done" }],
    ],
  };
}

function subjectLabel(track, key) {
  const list = SUBJECTS[track] || [];
  const found = list.find((s) => s.key === key);
  return found ? found.label : key;
}

function unitsKeyboard(session) {
  const grades = [...session.grades].sort((a, b) => a - b);
  const unitsByGrade = session.unitsByGrade || {};
  const maxByGrade = {};
  grades.forEach((g) => { maxByGrade[g] = getMaxUnits(session.subject, g, session.track); });
  const overallMax = Math.max(0, ...grades.map((g) => maxByGrade[g]));
  const rows = [];
  for (let n = 1; n <= overallMax; n++) {
    const row = grades.map((g) => {
      if (n > maxByGrade[g]) {
        return { text: " ", callback_data: "noop" };
      }
      const selected = Array.isArray(unitsByGrade[g]) && unitsByGrade[g].includes(n);
      return { text: `${selected ? "✅ " : ""}G${g}-U${n}`, callback_data: `unit:${g}:${n}` };
    });
    rows.push(row);
  }
  const allSelected = grades.every((g) => Array.isArray(unitsByGrade[g]) && unitsByGrade[g].length >= maxByGrade[g]);
  rows.push([{ text: allSelected ? "☑️ ሁሉንም አንሳ (Clear all)" : "☑️ ሁሉንም unit ምረጥ (Select all)", callback_data: "units_all" }]);
  rows.push([{ text: "✅ ጨርሻለሁ (Done)", callback_data: "units_done" }]);
  return { inline_keyboard: rows };
}

async function sendFinalInstructions(chatId, session) {
  const grades = [...session.grades].sort((a, b) => a - b);
  const unitsByGrade = session.unitsByGrade || {};
  let totalUnits = 0;
  grades.forEach((g) => { totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0; });
  const price = computePrice(grades.length, totalUnits, session.subject, session);

  const text =
    `✅ ገብቷል፦ <b>${session.firstName || "-"} ${session.lastName || "-"}</b> | ${session.phoneNumber || "-"}\n\n` +
    `ሰላም 🥰?\n` +
    `መጀመርያ በዚህ Account number <code>${ACCOUNT_NUMBER}</code> (mesele samuel endale)\n\n` +
    `<b>${price} ብር</b> ገቢ ካደረጉ በኋላ የከፈሉበትን ደረሰኝ ወይም screenshot ወደዚህ ወደዚሁ chat በመላክ የመረጡትን subject መምህሩ ተመልክቶ ክፍያዎን ካረጋገጠ በኋላ በቅርቡ ለመረጡት subject እና unit access ይሰጥዎታል። 🥰\n\n` +
    `🙏🙏🙏🙏🙏🙏🙏BN academy 🙏🙏🙏🙏🙏🙏🙏`;

  await sendMessage(chatId, BN_HEADER + text);
}


// ---------- PAYMENT APPROVAL ----------
function sessionTotals(session) {
  const grades = [...(session.grades || [])].sort((a, b) => a - b);
  const unitsByGrade = session.unitsByGrade || {};
  let totalUnits = 0;
  grades.forEach((g) => { totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0; });
  const price = computePrice(grades.length, totalUnits, session.subject, session);
  return { grades, unitsByGrade, totalUnits, price };
}

async function dbGet(path) {
  const r = await fetch(`${DB_URL}/${path}.json`);
  return r.json();
}
async function dbPut(path, body) {
  await fetch(`${DB_URL}/${path}.json`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ድረገጹ የሚጠቀምበት የ subject → Firebase አድራሻ
const SUBJECT_DB = {
  mathematics: { db: "https://mathematics-quiz-6884e-default-rtdb.firebaseio.com", path: "requests_math_allgrades" },
  biology:     { db: "https://biology-quiz-f4100-default-rtdb.firebaseio.com", path: "requests_bio_allgrades" },
  chemistry:   { db: "https://mathe-quiz-437d1-default-rtdb.firebaseio.com", path: "requests_chem_allgrades_reset_g12u2" },
  economics:   { db: "https://economics---quiz-default-rtdb.firebaseio.com", path: "requests_economics_allgrades" },
  geography:   { db: "https://geography-quiz-d8b97-default-rtdb.firebaseio.com", path: "requests_geography_allgrades" },
  history:     { db: "https://history-quiz-e7489-default-rtdb.firebaseio.com", path: "requests_history_allgrades" },
  physics:     { db: "https://physics-quiz-d8ff6-default-rtdb.firebaseio.com", path: "requests_physics_allgrades" },
};

// ተማሪው ደረሰኝ ሲልክ የሚፈጠረው ክፍያ ውስጥ dial/digits ያስቀምጣል (ድረገጹ ቁልፉን `251_952497862` ብሎ ነው የሚሠራው)
function splitPhone(session) {
  const cc = session.countryCode || "";
  const full = String(session.phoneNumber || "").replace(/\D/g, "");
  if (!cc || !full.startsWith(cc)) return { dial: "", digits: "" };
  return { dial: cc, digits: full.slice(cc.length) };
}

// አንድ subject ውስጥ ተማሪውን approved አድርጎ unit ይከፍታል
async function grantOne(subject, pay, unitsByGrade) {
  const target = SUBJECT_DB[subject];
  if (!target) return { ok: false, reason: `ያልታወቀ subject: ${subject}` };
  const key = `${pay.dial}_${pay.digits}`;
  const url = `${target.db}/${target.path}/${key}.json`;

  // የሚከፈቱ unit ቁልፎች (ለምሳሌ G9U1)
  const newKeys = [];
  Object.keys(unitsByGrade || {}).forEach((g) => {
    (unitsByGrade[g] || []).forEach((n) => newKeys.push(`G${g}U${n}`));
  });

  const existing = await (await fetch(url)).json();

  if (existing) {
    const sameName =
      String(existing.firstName || "").trim().toLowerCase() === String(pay.firstName).trim().toLowerCase() &&
      String(existing.lastName || "").trim().toLowerCase() === String(pay.lastName).trim().toLowerCase();
    if (!sameName) {
      return { ok: false, reason: `${subject}: ይህ ስልክ በድረገጹ በሌላ ስም (${existing.firstName} ${existing.lastName}) ተመዝግቧል` };
    }
  }

  const merged = Array.from(new Set([...(existing && existing.unlockedUnits ? existing.unlockedUnits : []), ...newKeys]));
  const body = existing
    ? { status: "approved", unlockedUnits: merged }
    : {
        firstName: pay.firstName,
        lastName: pay.lastName,
        phone: `+${pay.dial} ${pay.digits}`,
        status: "approved",
        unlockedUnits: merged,
        requestedAt: new Date().toISOString(),
        approvedAt: new Date().toISOString(),
        userAgent: "telegram-bot",
      };
  const r = await fetch(url, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!r.ok) return { ok: false, reason: `${subject}: Firebase ስህተት ${r.status}` };
  return { ok: true, count: newKeys.length };
}

// ክፍያ ሲረጋገጥ access ይከፍታል (subject = "all" ከሆነ የ track ውስጥ ያሉትን ሁሉንም subject ይከፍታል)
async function grantAccess(chatId, pay) {
  if (!pay.dial || !pay.digits) {
    return { ok: false, reason: "ስልኩ ከሌላ አገር ነው (country code አልታወቀም)፤ በ control page በእጅ ይክፈቱ" };
  }
  if (pay.subject !== "all") return grantOne(pay.subject, pay, pay.unitsByGrade);

  const list = SUBJECTS[pay.track] || [];
  if (!list.length) return { ok: false, reason: `ያልታወቀ track: ${pay.track}` };
  const failures = [];
  for (const sub of list) {
    // ተማሪው የመረጠውን grade/unit በዚህ subject ውስጥ ካለው ከፍተኛ ብዛት በላይ ሳይሆን ይከፍታል
    const chosen = {};
    Object.keys(pay.unitsByGrade || {}).forEach((g) => {
      const max = getMaxUnits(sub.key, g);
      chosen[g] = (pay.unitsByGrade[g] || []).filter((n) => n <= max);
    });
    const r = await grantOne(sub.key, pay, chosen);
    if (!r.ok) failures.push(r.reason);
  }
  if (failures.length) return { ok: false, reason: failures.join(" | ") };
  return { ok: true, count: list.length };
}

// ---------- OCR (OCR.space) ----------
const OCR_KEY = process.env.OCR_SPACE_API_KEY;
const AUTO_APPROVE = process.env.AUTO_APPROVE === "true";
const AUTO_REJECT = process.env.AUTO_REJECT !== "false"; // default: ON
const RECEIVER_DISPLAY = "MESELE SAMUEL ENDALE";
const RECEIVER_NAME_TOKENS = ["MESELE", "SAMUEL", "ENDALE"];

async function downloadTelegramFile(fileId) {
  const info = await tg("getFile", { file_id: fileId });
  if (!info.ok) throw new Error("getFile failed");
  const r = await fetch(`https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${info.result.file_path}`);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf;
}

async function ocrImage(fileId) {
  if (!OCR_KEY) return null;
  const buf = await downloadTelegramFile(fileId);
  const form = new URLSearchParams();
  form.set("apikey", OCR_KEY);
  form.set("base64Image", `data:image/jpeg;base64,${buf.toString("base64")}`);
  form.set("language", "eng");
  form.set("OCREngine", "2");
  form.set("scale", "true");
  const r = await fetch("https://api.ocr.space/parse/image", { method: "POST", body: form });
  const j = await r.json();
  if (!j || j.IsErroredOnProcessing || !j.ParsedResults || !j.ParsedResults[0]) return null;
  return String(j.ParsedResults[0].ParsedText || "");
}

// ከ OCR ጽሑፍ መጠን፣ ተቀባይ እና transaction ቁጥር ይፈትሻል
function analyzeReceipt(text, price) {
  const up = String(text || "").toUpperCase();
  const digitsOnly = up.replace(/\D/g, "");

  // መጠን፦ ነጥብ ያለው ቁጥር (125.00) ከዋጋው እኩል ወይም ከዚያ በላይ
  const amounts = [];
  const re = /(\d{1,3}(?:,\d{3})+|\d+)\.\d{2}\b/g;
  let m;
  while ((m = re.exec(up))) amounts.push(Math.abs(parseFloat(m[0].replace(/,/g, ""))));
  const amountOk = amounts.some((n) => n >= price && n <= price * 20);

  // ተቀባይ፦ account ቁጥር (መጨረሻ 7 አሃዝ) ወይም ቢያንስ 2 የስም ክፍሎች
  const accTail = ACCOUNT_NUMBER.slice(-7);
  const nameHits = RECEIVER_NAME_TOKENS.filter((t) => up.includes(t)).length;
  const receiverOk = digitsOnly.includes(accTail) || nameHits >= 2;

  // Transaction ቁጥር፦ 2 ፊደል + ፊደል/ቁጥር (ቢያንስ አንድ አሃዝ ያለው)
  let txn = "";
  const tre = /\b[A-Z]{2}[A-Z0-9]{8,12}\b/g;
  while ((m = tre.exec(up))) {
    if (/\d/.test(m[0])) { txn = m[0]; break; }
  }
  return { amountOk, receiverOk, txn, amounts: amounts.slice(0, 4) };
}

async function approvePayment(studentId, pay) {
  let result;
  try { result = await grantAccess(studentId, pay); } catch (e) { result = { ok: false, reason: String(e) }; }
  if (!result.ok) return result;
  pay.status = "approved";
  pay.decidedAt = Date.now();
  await dbPut(`bot_payments/${studentId}`, pay);
  if (pay.txn) await dbPut(`bot_txns/${pay.txn}`, { chatId: String(studentId), at: Date.now() });
  await sendMessage(studentId, BN_HEADER + "✅ ክፍያዎ ተረጋግጧል! ለመረጡት subject እና unit access ተከፍቷል። ወደ application ገብተው ይጠቀሙ 🥰\n\n🙏 BN Academy 🙏");
  return result;
}

module.exports = async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(200).send("ok");
    return;
  }

  let update;
  try {
    update = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch (e) {
    res.status(200).send("ok");
    return;
  }

  // ---- CALLBACK QUERIES ----
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message.chat.id;
    const data = cq.data;
    const { fullName, username } = personName(cq.from);
    const isAdminCq = String(chatId) === String(ADMIN_CHAT_ID);

    if (data.startsWith("pay:")) {
      if (!isAdminCq) {
        await answerCallbackQuery(cq.id, "⛔", true);
        res.status(200).send("ok");
        return;
      }
      const [, action, studentId] = data.split(":");
      const pay = await dbGet(`bot_payments/${studentId}`);
      const allowed = pay && (pay.status === "pending" || (action === "ok" && pay.status === "auto_rejected"));
      if (!allowed) {
        await answerCallbackQuery(cq.id, "ይህ ቀድሞ ተስተናግዷል ወይም አልተገኘም", true);
        await editMarkup(chatId, cq.message.message_id, { inline_keyboard: [] });
        res.status(200).send("ok");
        return;
      }
      if (action === "ok") {
        const result = await approvePayment(studentId, pay);
        if (!result.ok) {
          await answerCallbackQuery(cq.id, "⚠️ አልተከፈተም", true);
          await sendMessage(chatId, `⚠️ <b>Access መክፈት አልተቻለም</b>\nChat ID: <code>${studentId}</code>\nምክንያት: ${result.reason}\n(በተኖቹ አሁንም ይሠራሉ፤ ችግሩን አስተካክለው በድጋሚ ይሞክሩ ወይም በ control page በእጅ ይክፈቱ)`);
          res.status(200).send("ok");
          return;
        }
        await answerCallbackQuery(cq.id, "✅ Approved");
        await editMarkup(chatId, cq.message.message_id, { inline_keyboard: [[{ text: "✅ Approved", callback_data: "noop" }]] });
      } else {
        pay.status = "rejected";
        pay.decidedAt = Date.now();
        await dbPut(`bot_payments/${studentId}`, pay);
        await sendMessage(studentId, "❌ ክፍያዎን ማረጋገጥ አልተቻለም። እባክዎ ትክክለኛውን ደረሰኝ (screenshot) በድጋሚ ይላኩ ወይም መልእክትዎን ይጻፉልን 🙏");
        await saveSession(studentId, { ...(await getSession(studentId)), step: "awaiting_payment" });
        await answerCallbackQuery(cq.id, "❌ Rejected");
        await editMarkup(chatId, cq.message.message_id, { inline_keyboard: [[{ text: "❌ Rejected", callback_data: "noop" }]] });
      }
      res.status(200).send("ok");
      return;
    }

    if (!isAdminCq) {
      const usage = await checkAndIncrementUsage(chatId);
      if (!usage.allowed) {
        await answerCallbackQuery(cq.id, "⚠️ የዛሬው የአጠቃቀም ገደብዎ ደርሷል፣ እባክዎ ነገ ይሞክሩ 🙏", true);
        res.status(200).send("ok");
        return;
      }
    }

    let session = await getSession(chatId);

    if (data === "opt:how_to_start") {
      if (!isAdminCq) {
        const completions = await getCompletionCount(chatId);
        if (completions >= MAX_COMPLETIONS_PER_DAY) {
          await answerCallbackQuery(cq.id, `⚠️ የዛሬው ${MAX_COMPLETIONS_PER_DAY} ምዝገባ ገደብዎ ደርሷል፣ እባክዎ ነገ ይሞክሩ 🙏`, true);
          res.status(200).send("ok");
          return;
        }
      }
      await answerCallbackQuery(cq.id, "እሺ 🙏");
      await notifyAdmin(`📩 <b>${fullName || "ስም የለም"}</b> (${username}) ምዝገባ ጀምሯል።\nChat ID: <code>${chatId}</code>`);
      session = { step: "track", grades: [], unitsByGrade: {} };
      await saveSession(chatId, session);
      await sendMessage(chatId, "የትምህርት አይነት ምንድነው?", { reply_markup: trackKeyboard() });
      res.status(200).send("ok");
      return;
    }

    if (data.startsWith("track:")) {
      session.track = data.split(":")[1];
      session.step = "subject";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await sendMessage(chatId, "የትኛውን Subject ይፈልጋሉ?\n(አንድ subject ብቻ መምረጥ ይችላሉ፤ ሁሉንም ከፈለጉ <b>Select all</b> ይጫኑ፤ ከመረጡ በኋላ <b>ጨርሻለሁ</b> ይጫኑ 👇)", { reply_markup: subjectKeyboard(session.track) });
      res.status(200).send("ok");
      return;
    }

    if (data === "subj_done") {
      if (!session.subject) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ subject ይምረጡ 🙏", true);
        res.status(200).send("ok");
        return;
      }
      session.step = "grade";
      session.grades = [];
      session.unitsByGrade = {};
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await editMarkup(chatId, cq.message.message_id, { inline_keyboard: [[{ text: session.subject === "all" ? "✅ ሁሉም subject" : `✅ ${subjectLabel(session.track, session.subject)}`, callback_data: "noop" }]] });
      await sendMessage(chatId, "የስንተኛ ክፍል ነዎት? (ከ1 እስከ 4 grade መምረጥ ይችላሉ)\nከመረጡ በኋላ <b>ጨርሻለሁ</b> ይጫኑ።", { reply_markup: gradeKeyboard(session.grades) });
      res.status(200).send("ok");
      return;
    }

    if (data.startsWith("subj:")) {
      // አንድ subject ብቻ (ወይም ሁሉንም) ይመረጣል፤ እንደገና ሲነካ ይነሳል፣ ሌላ ሲነካ ይተካል
      const picked = data.split(":")[1];
      const already = session.subject === picked;
      session.subject = already ? "" : picked;
      session.step = "subject";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, already ? "ተነስቷል" : "ተመርጧል ✅");
      await editMarkup(chatId, cq.message.message_id, subjectKeyboard(session.track, session.subject));
      res.status(200).send("ok");
      return;
    }

    if (data.startsWith("grade:")) {
      const g = parseInt(data.split(":")[1], 10);
      if (!Array.isArray(session.grades)) session.grades = [];
      const already = session.grades.includes(g);
      if (already) {
        session.grades = session.grades.filter((x) => x !== g);
        if (session.unitsByGrade) delete session.unitsByGrade[g];
      } else {
        session.grades = [...session.grades, g];
      }
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, already ? "ተነስቷል" : "ተመርጧል ✅");
      await editMarkup(chatId, cq.message.message_id, gradeKeyboard(session.grades));
      res.status(200).send("ok");
      return;
    }

    if (data === "grades_all") {
      const everyGrade = [9, 10, 11, 12];
      const allSel = Array.isArray(session.grades) && everyGrade.every((g) => session.grades.includes(g));
      session.grades = allSel ? [] : [...everyGrade];
      if (allSel) session.unitsByGrade = {};
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, allSel ? "ተነስቷል" : "ሁሉም grade ተመርጧል ✅");
      await editMarkup(chatId, cq.message.message_id, gradeKeyboard(session.grades));
      res.status(200).send("ok");
      return;
    }

    if (data === "units_all_subjects") {
      if (session.subject !== "all" || !session.grades || session.grades.length === 0) {
        await answerCallbackQuery(cq.id, "🙏", true);
        res.status(200).send("ok");
        return;
      }
      session.unitsByGrade = {};
      session.grades.forEach((g) => {
        const max = getMaxUnits("all", g, session.track);
        session.unitsByGrade[g] = Array.from({ length: max }, (_, i) => i + 1);
      });
      session.step = "awaiting_first_name";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "ሁሉም unit ተመርጧል ✅");
      await editMarkup(chatId, cq.message.message_id, { inline_keyboard: [[{ text: "✅ ሁሉም unit ተመርጧል", callback_data: "noop" }]] });
      await sendMessage(chatId, namePromptText());
      res.status(200).send("ok");
      return;
    }

    if (data === "grades_done") {
      if (!session.grades || session.grades.length === 0) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ grade ይምረጡ 🙏", true);
        res.status(200).send("ok");
        return;
      }
      await answerCallbackQuery(cq.id, "እሺ");
      if (session.subject === "all") {
        const gs = [...session.grades].sort((a, b) => a - b);
        session.step = "confirm_all_units";
        session.unitsByGrade = {};
        await saveSession(chatId, session);
        await sendMessage(
          chatId,
          `📚 <b>ሁሉም subjects (4)</b> | ${gs.map((g) => `Grade ${g}`).join(", ")}\n\n` +
            `ለመረጧቸው ለሁሉም subject እና grade <b>ሁሉም unit ክፍት ይሆንልዎታል</b> ✅\n` +
            `ለመቀጠል ከታች ያለውን button ይጫኑ 👇`,
          { reply_markup: { inline_keyboard: [[{ text: "☑️ Select all units per grade & subject", callback_data: "units_all_subjects" }]] } }
        );
        res.status(200).send("ok");
        return;
      }
      session.step = "units";
      session.unitsByGrade = {};
      session.grades.forEach((g) => { session.unitsByGrade[g] = []; });

      const grades = [...session.grades].sort((a, b) => a - b);
      const subjLabel = session.subject === "all" ? "📚 ሁሉም subjects (4)" : subjectLabel(session.track, session.subject);
      const gradeStr = grades.map((g) => `Grade ${g}`).join(" and ");

      const sent = await sendMessage(chatId, `ከ ${subjLabel} ${gradeStr} የሚፈልጉትን የ unit quiz (ጥያቄ) ብዛት ይምረጡ? 🥰\n\nG = Grade, U = Unit`, { reply_markup: unitsKeyboard(session) });
      session.unitsMessageId = sent.result ? sent.result.message_id : null;
      await saveSession(chatId, session);
      res.status(200).send("ok");
      return;
    }

    if (data === "noop") {
      await answerCallbackQuery(cq.id);
      res.status(200).send("ok");
      return;
    }

    if (data.startsWith("unit:")) {
      const parts = data.split(":");
      const g = parseInt(parts[1], 10);
      const n = parseInt(parts[2], 10);
      if (!session.unitsByGrade) session.unitsByGrade = {};
      if (!Array.isArray(session.unitsByGrade[g])) session.unitsByGrade[g] = [];
      const maxUnits = getMaxUnits(session.subject, g, session.track);
      const subjLabelWarn = subjectLabel(session.track, session.subject);
      if (n > maxUnits) {
        await answerCallbackQuery(cq.id, `የ grade ${g} ${subjLabelWarn} ትምህርት ${maxUnits} unit ብቻ ነው ያለው 🙏`, true);
        res.status(200).send("ok");
        return;
      }
      const already = session.unitsByGrade[g].includes(n);
      if (!already && session.unitsByGrade[g].length >= maxUnits) {
        await answerCallbackQuery(cq.id, `የ grade ${g} ${subjLabelWarn} ትምህርት ${maxUnits} unit ብቻ ነው ያለው 🙏`, true);
        res.status(200).send("ok");
        return;
      }
      session.unitsByGrade[g] = already ? session.unitsByGrade[g].filter((u) => u !== n) : [...session.unitsByGrade[g], n];
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, already ? "ተነስቷል" : "ተመርጧል ✅");
      if (session.unitsMessageId) await editMarkup(chatId, session.unitsMessageId, unitsKeyboard(session));
      res.status(200).send("ok");
      return;
    }

    if (data === "units_all") {
      if (!session.unitsByGrade) session.unitsByGrade = {};
      const gradesSel = session.grades || [];
      const allSelectedNow = gradesSel.length > 0 && gradesSel.every((g) => {
        const max = getMaxUnits(session.subject, g, session.track);
        return Array.isArray(session.unitsByGrade[g]) && session.unitsByGrade[g].length >= max;
      });
      gradesSel.forEach((g) => {
        const max = getMaxUnits(session.subject, g, session.track);
        session.unitsByGrade[g] = allSelectedNow ? [] : Array.from({ length: max }, (_, i) => i + 1);
      });
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, allSelectedNow ? "ተነስቷል" : "ሁሉም unit ተመርጧል ✅");
      if (session.unitsMessageId) await editMarkup(chatId, session.unitsMessageId, unitsKeyboard(session));
      res.status(200).send("ok");
      return;
    }

    if (data === "units_done") {
      const unitsByGrade = session.unitsByGrade || {};
      let totalUnits = 0;
      (session.grades || []).forEach((g) => { totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0; });
      if (totalUnits === 0) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ unit ይምረጡ 🙏", true);
        res.status(200).send("ok");
        return;
      }
      await answerCallbackQuery(cq.id, "ተልኳል ✅");
      session.step = "awaiting_first_name";
      await saveSession(chatId, session);
      await sendMessage(chatId, namePromptText());
      res.status(200).send("ok");
      return;
    }

    if (data.startsWith("country:")) {
      const code = data.split(":")[1];
      const countryInfo = COUNTRIES.find((c) => c.code === code);
      session.countryCode = code === "other" ? "" : code;
      session.countryLength = countryInfo ? countryInfo.length : null;
      session.countryStartsWith = countryInfo ? countryInfo.startsWith || null : null;
      session.step = "awaiting_phone";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      if (code === "other") {
        await sendMessage(chatId, "📱 Phone number ያስገቡ ከ country code ጋር (ለምሳሌ +254712345678)፦");
      } else if (countryInfo && countryInfo.length) {
        const example = (countryInfo.startsWith || "9") + "5".repeat(Math.max(0, countryInfo.length - 1));
        await sendMessage(chatId, `📱 Phone number ያስገቡ (ያለ 0፣ ${countryInfo.length} አሃዝ ብቻ${countryInfo.startsWith ? `፣ በ${countryInfo.startsWith} መጀመር አለበት` : ""}, ለምሳሌ ${example})፦`);
      } else {
        await sendMessage(chatId, `📱 Phone number ያስገቡ (ያለ 0 ወይም + code)፦`);
      }
      res.status(200).send("ok");
      return;
    }

    await answerCallbackQuery(cq.id, "");
    res.status(200).send("ok");
    return;
  }

  // ---- MESSAGES ----
  const msg = update.message;
  if (!msg) { res.status(200).send("ok"); return; }

  const studentChatId = msg.chat.id;
  const { fullName, username } = personName(msg.from);
  const isAdmin = String(studentChatId) === String(ADMIN_CHAT_ID);

  if (!isAdmin) {
    const usage = await checkAndIncrementUsage(studentChatId);
    if (!usage.allowed) {
      await sendMessage(studentChatId, "⚠️ የዛሬው የአጠቃቀም ገደብዎ ደርሷል፣ እባክዎ ነገ ይሞክሩ 🙏");
      res.status(200).send("ok");
      return;
    }
  }

  if (msg.photo && msg.photo.length) {
    const largest = msg.photo[msg.photo.length - 1];
    // OCR.space ነጻ እቅድ 1MB ገደብ ስላለው ከ 1MB በታች ያለውን ትልቁን ይመርጣል
    const forOcr = [...msg.photo].reverse().find((p) => !p.file_size || p.file_size < 1000000) || msg.photo[0];
    const fileId = largest.file_id;
    const fileUniqueId = largest.file_unique_id;
    if (!isAdmin) {
      const session = await getSession(studentChatId);
      if (session.step !== "awaiting_payment") {
        await sendMessage(studentChatId, `ምን አርጉ ነው ምትለው አንበሳው?😉 ደደብ ነክ እንዴ🤭😁? ሲጀመር የተማረ የት ደረሰ የተማረ ሰባተኛ ሰማይ ነው😁 ለዛ አንተ አትማር ተምረክም አጠቅምም😁😁 instruction አታነብም እንዴ 😭 ወይንስ ማንበብ ሳትቺይ ነው highschool የገባሺው ጥቁሩ በዬ?😁 በቃ ከንደገና አንብበክ ሁሉን ነገር ጨርሰክ ተነስተክ ላክ screenshot/ ወይም ደረሰኝ😡`);
        res.status(200).send("ok");
        return;
      }

      // ተመሳሳይ ፎቶ ቀድሞ pending ከሆነ እንደገና አያስኬድም (Telegram retry መከላከያ)
      const prev = await dbGet(`bot_payments/${studentChatId}`);
      if (prev && prev.status === "pending" && prev.fileUniqueId === fileUniqueId) {
        res.status(200).send("ok");
        return;
      }

      const t = sessionTotals(session);
      const sp = splitPhone(session);
      const pay = {
        status: "pending",
        fileId,
        fileUniqueId,
        firstName: session.firstName || "",
        lastName: session.lastName || "",
        phone: session.phoneNumber || "",
        track: session.track || "",
        subject: session.subject || "",
        grades: t.grades,
        unitsByGrade: t.unitsByGrade,
        price: t.price,
        dial: sp.dial,
        digits: sp.digits,
        createdAt: Date.now(),
      };
      await dbPut(`bot_payments/${studentChatId}`, pay);
      await sendMessage(studentChatId, "ደረሰኙ ደርሶናል ✅ በመረጋገጥ ላይ ነው፣ በቅርቡ access ይሰጥዎታል 🙏");
      await incrementCompletionCount(studentChatId);

      // ---- OCR ----
      let verdict = "";
      let canAuto = false;
      const rejectReasons = [];
      try {
        const ocrText = await ocrImage(forOcr.file_id);
        if (ocrText === null) {
          verdict = OCR_KEY ? "\n\n🤖 OCR፦ ፎቶውን ማንበብ አልተቻለም ⚠️ በእጅ ይመልከቱ" : "";
        } else {
          const a = analyzeReceipt(ocrText, t.price);
          let txnLine = "❓ ቁጥር አልተነበበም";
          let txnFresh = false;
          if (a.txn) {
            const used = await dbGet(`bot_txns/${a.txn}`);
            const fileUsed = await dbGet(`bot_files/${fileUniqueId}`);
            if (used || (fileUsed && String(fileUsed.chatId) !== String(studentChatId))) {
              txnLine = `🚫 <code>${a.txn}</code> ቀድሞ ጥቅም ላይ ውሏል!`;
              rejectReasons.push("duplicate");
            } else {
              txnLine = `✅ <code>${a.txn}</code> አዲስ`;
              txnFresh = true;
            }
            pay.txn = a.txn;
          }
          await dbPut(`bot_files/${fileUniqueId}`, { chatId: String(studentChatId), at: Date.now() });

          // ደረሰኝ የሚመስል ጽሑፍ ከተነበበ ብቻ ነው በራስ-ሰር ውድቅ የሚያደርገው (ንባቡ ከተበላሸ በእጅ ይመለከታል)
          const looksLikeReceipt = String(ocrText).length >= 40 && (a.amounts.length > 0 || !!a.txn);
          if (looksLikeReceipt && a.amounts.length > 0 && !a.amountOk) rejectReasons.push("amount");
          if (looksLikeReceipt && !a.receiverOk) rejectReasons.push("receiver");

          pay.ocr = { amountOk: a.amountOk, receiverOk: a.receiverOk, txn: a.txn || "" };
          await dbPut(`bot_payments/${studentChatId}`, pay);
          canAuto = a.amountOk && a.receiverOk && txnFresh;
          verdict =
            `\n\n🤖 <b>OCR ውጤት</b>\n` +
            `${a.amountOk ? "✅" : "❌"} መጠን (${t.price} ብር ወይም ከዚያ በላይ)${a.amounts.length ? " — ተነበበ: " + a.amounts.join(", ") : ""}\n` +
            `${a.receiverOk ? "✅" : "❌"} ተቀባይ (account/ስም)\n` +
            `${txnLine}\n` +
            (canAuto ? "🟢 ሁሉም ተዛምዷል" : "🟡 በእጅ ይመልከቱ");
        }
      } catch (e) {
        verdict = "\n\n🤖 OCR ስህተት ⚠️ በእጅ ይመልከቱ";
      }

      // ---- ራስ-ሰር ውድቅ (ድጋሚ ደረሰኝ / የተሳሳተ መጠን / የተሳሳተ ተቀባይ) ----
      let autoRejected = false;
      if (AUTO_REJECT && rejectReasons.length) {
        const lines = [];
        if (rejectReasons.includes("duplicate")) lines.push("🚫 ይህ ደረሰኝ ቀድሞ አገልግሎት ላይ ውሏል። እባክዎ አዲስ ትክክለኛ ደረሰኝ ይላኩ።");
        if (rejectReasons.includes("amount")) lines.push(`💰 በደረሰኙ ላይ ያለው መጠን ትክክል አይደለም። መክፈል ያለብዎት <b>${t.price} ብር</b> ነው።`);
        if (rejectReasons.includes("receiver")) lines.push(`👤 ክፍያው ወደ ትክክለኛው ተቀባይ አልተላከም።\nስም፦ <b>${RECEIVER_DISPLAY}</b>\nAccount፦ <code>${ACCOUNT_NUMBER}</code>`);
        pay.status = "auto_rejected";
        pay.reason = rejectReasons.join(",");
        pay.decidedAt = Date.now();
        await dbPut(`bot_payments/${studentChatId}`, pay);
        await sendMessage(studentChatId, "❌ <b>ክፍያዎ አልተረጋገጠም</b>\n\n" + lines.join("\n\n") + "\n\nትክክለኛውን ክፍያ ፈጽመው ደረሰኙን (screenshot) እንደገና ይላኩ 🙏");
        autoRejected = true;
        verdict += `\n\n🤖❌ <b>ራስ-ሰር ውድቅ ተደርጓል</b> (${rejectReasons.join(", ")})`;
      }

      // ---- ራስ-ሰር approve (AUTO_APPROVE=true ሲሆን ብቻ) ----
      let autoDone = false;
      if (AUTO_APPROVE && canAuto && !autoRejected) {
        const r = await approvePayment(studentChatId, pay);
        autoDone = r.ok;
        if (!r.ok) verdict += `\n⚠️ ራስ-ሰር መክፈት አልተሳካም: ${r.reason}`;
      }
      if (autoDone) verdict += "\n\n🤖✅ <b>ራስ-ሰር Approved</b>";

      if (ADMIN_CHAT_ID) {
        await tg("sendPhoto", {
          chat_id: ADMIN_CHAT_ID,
          photo: fileId,
          caption: `🧾 <b>ደረሰኝ/Screenshot ደርሷል</b>\nከ: ${fullName || "ስም የለም"} (${username})\nChat ID: <code>${studentChatId}</code>\nApp First name: ${session.firstName || "-"}\nApp Last name: ${session.lastName || "-"}\nApp Phone: ${session.phoneNumber || "-"}\nSubject: ${session.subject || "-"} | ${t.price} ብር${msg.caption ? `\n\n${msg.caption}` : ""}${verdict}`.slice(0, 1020),
          parse_mode: "HTML",
          ...(autoDone ? {} : autoRejected
            ? (rejectReasons.includes("duplicate") ? {} : { reply_markup: { inline_keyboard: [[
                { text: "✅ ቢሆንም Approve አድርግ", callback_data: `pay:ok:${studentChatId}` },
              ]] } })
            : { reply_markup: { inline_keyboard: [[
                { text: "✅ Approve", callback_data: `pay:ok:${studentChatId}` },
                { text: "❌ Reject", callback_data: `pay:no:${studentChatId}` },
              ]] } }),
        });
      }
    }
    res.status(200).send("ok");
    return;
  }

  if (!msg.text) { res.status(200).send("ok"); return; }

  const text = msg.text.trim();

  if (isAdmin && text.startsWith("/reply")) {
    const parts = text.split(" ");
    const targetChatId = parts[1];
    const replyText = parts.slice(2).join(" ");
    if (targetChatId && replyText) {
      await sendMessage(targetChatId, `💬 <b>ከመምህሩ መልስ</b>፦\n${replyText}`);
      await sendMessage(ADMIN_CHAT_ID, "✅ ተልኳል።");
    } else {
      await sendMessage(ADMIN_CHAT_ID, "አጠቃቀም፦ /reply <chat_id> <መልእክት>");
    }
    res.status(200).send("ok");
    return;
  }

  if (text === "/start") {
    await saveSession(studentChatId, { step: "idle", grades: [], unitsByGrade: {} });
    await sendMessage(studentChatId, BN_HEADER + "ሰላም! 👋 ችግርህን/ሽን ወይም ጥያቄህን/ሽን በአጭሩ ጻፍልኝ/ፊሊኝ፣ ወይም ከታች ተጫን፣ ወደ መምህሩ በቀጥታ እልክለታለሁ። 🙏", {
      reply_markup: { inline_keyboard: [[{ text: "እንዴት መጀመር እችላለው?", callback_data: "opt:how_to_start" }]] },
    });
    res.status(200).send("ok");
    return;
  }

  if (!isAdmin) {
    const session = await getSession(studentChatId);

    if (session.step === "awaiting_first_name") {
      if (!isValidName(text)) {
        await sendMessage(studentChatId, "⚠️ እባክዎ ትክክለኛ ስምዎን በትክክል ያስገቡ 🙏");
        res.status(200).send("ok");
        return;
      }
      session.firstName = text;
      session.step = "awaiting_last_name";
      await saveSession(studentChatId, session);
      await sendMessage(studentChatId, "👉 <b>Last name</b> ያስገቡ፦");
      res.status(200).send("ok");
      return;
    }

    if (session.step === "awaiting_last_name") {
      if (!isValidName(text)) {
        await sendMessage(studentChatId, "⚠️ እባክዎ ትክክለኛ ስምዎን በትክክል ያስገቡ 🙏");
        res.status(200).send("ok");
        return;
      }
      session.lastName = text;
      session.step = "awaiting_country";
      await saveSession(studentChatId, session);
      await sendMessage(studentChatId, "📱 Phone number ላይ የፈለጉትን አገር ይምረጡ 👇", { reply_markup: countryKeyboard() });
      res.status(200).send("ok");
      return;
    }

    if (session.step === "awaiting_phone") {
      const raw = text.replace(/[^\d+]/g, "");
      let fullPhone;
      if (session.countryCode) {
        const local = raw.replace(/^0+/, "");
        const expectedLen = session.countryLength;
        const startsWith = session.countryStartsWith;
        if (expectedLen && local.length !== expectedLen) {
          await sendMessage(studentChatId, `⚠️ ትክክለኛ ${expectedLen} አሃዝ ስልክ ቁጥር ያስገቡ (ያለ 0 ወይም country code) 🙏`);
          res.status(200).send("ok");
          return;
        }
        if (!expectedLen && (local.length < 7 || local.length > 10)) {
          await sendMessage(studentChatId, "⚠️ ትክክለኛ phone number ያስገቡ (ያለ country code እና 0) 🙏");
          res.status(200).send("ok");
          return;
        }
        if (startsWith && !local.startsWith(startsWith)) {
          await sendMessage(studentChatId, `⚠️ ስልክ ቁጥሩ በ${startsWith} መጀመር አለበት፣ እባክዎ በድጋሚ ያስገቡ 🙏`);
          res.status(200).send("ok");
          return;
        }
        fullPhone = `+${session.countryCode}${local}`;
      } else {
        if (!raw.startsWith("+") || raw.length < 8) {
          await sendMessage(studentChatId, "⚠️ Phone number ከ country code ጋር ያስገቡ (ለምሳሌ +254712345678) 🙏");
          res.status(200).send("ok");
          return;
        }
        fullPhone = raw;
      }
      session.phoneNumber = fullPhone;
      session.step = "awaiting_payment";
      await saveSession(studentChatId, session);

      const grades = [...(session.grades || [])].sort((a, b) => a - b);
      const unitsByGrade = session.unitsByGrade || {};
      let totalUnits = 0;
      grades.forEach((g) => { totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0; });
      const price = computePrice(grades.length, totalUnits, session.subject, session);
      const subjLabel = session.subject === "all" ? "📚 ሁሉም subjects (4)" : subjectLabel(session.track, session.subject);
      let unitsSummary = "";
      grades.forEach((g) => {
        const units = (unitsByGrade[g] || []).sort((a, b) => a - b);
        unitsSummary += session.subject === "all"
          ? `  Grade ${g}: ሁሉም unit (ለአራቱም subject)\n`
          : `  Grade ${g}: ${units.length > 0 ? "Unit " + units.join(", ") : "—"}\n`;
      });
      await notifyAdmin(
        `🧾 <b>የምዝገባ ማጠቃለያ</b>\nከ: ${fullName || "ስም የለም"} (${username})\nChat ID: <code>${studentChatId}</code>\n` +
        `App First name: ${session.firstName}\nApp Last name: ${session.lastName}\nApp Phone: ${session.phoneNumber}\n` +
        `Track: ${session.track}\nSubject: ${subjLabel}\nGrades & Units:\n${unitsSummary}አጠቃላይ Units: ${totalUnits}\nየሚከፈል ዋጋ: <b>${price} ብር</b>`
      );
      await sendFinalInstructions(studentChatId, session);
      res.status(200).send("ok");
      return;
    }
  }

  if (ADMIN_CHAT_ID) {
    await sendMessage(ADMIN_CHAT_ID, `📩 <b>አዲስ መልእክት</b>\nከ: ${fullName || "ስም የለም"} (${username})\nChat ID: <code>${studentChatId}</code>\n\n${text}`);
  }
  await sendMessage(studentChatId, "መልእክትህ ደርሷል ✅ መምህሩ በቅርቡ ምላሽ ይሰጥሃል። አመሰግናለሁ 🙏");
  res.status(200).send("ok");
}
