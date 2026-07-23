// ============================================
// Telegram Registration-Wizard Bot — Netlify Function
// ============================================
//
// Flow:
//   /start -> greeting + "እንዴት መጀመር እችላለው?" button
//   tap it -> bot asks: track (Social/Natural) -> grade (9-12) ->
//             subject (depends on track) -> which units (multi-select,
//             max 6) -> bot computes the price and sends payment +
//             registration instructions automatically.
//   A summary of what they picked is also sent to YOU (the admin) so
//   you know what to grant access to once you get their payment
//   screenshot.
//   Payment screenshots/photos the student sends are forwarded to you
//   automatically too.
//   You reply to a student any time with, in this same chat:
//       /reply <chat_id> <your message>
//
// Required environment variables (Netlify -> Environment variables):
//   TELEGRAM_BOT_TOKEN  -> the token @BotFather gave you
//   ADMIN_CHAT_ID       -> YOUR personal Telegram numeric chat id
//
// Session (which step each student is on) is stored in Netlify Blobs,
// so it survives between messages even though each webhook call is a
// fresh, stateless function run. Requires the @netlify/blobs package
// (see package.json) — Netlify installs it automatically on deploy.
//
// After deploying, set the webhook once by visiting in a browser:
//   https://api.telegram.org/bot<TELEGRAM_BOT_TOKEN>/setWebhook?url=<YOUR_NETLIFY_SITE>/.netlify/functions/telegram-webhook
//

const { getStore } = require("@netlify/blobs");

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ACCOUNT_NUMBER = "1000102646437";

// ---- Price by number of units selected (1-6) ----
const PRICE_TABLE = { 1: 50, 2: 80, 3: 125, 4: 160, 5: 210, 6: 260 };
const MAX_UNITS = 6;

// ---- Subjects offered per track ----
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

const GRADES = ["9", "10", "11", "12"];

// ---- Site links per "grade|subject" combo ----
// Fill these in as you build each quiz site — e.g.
//   "10|chemistry": "https://mesfene-chemistry-grade10-unit1.netlify.app/...",
// Any combo not listed here falls back to a generic line telling the
// student you'll send the exact link after their payment is confirmed.
const SITE_LINKS = {
  // "10|chemistry": "https://mesfene-chemistry-grade10-unit1.netlify.app/Chemistry_Reactions_Stoichiometry_VIP_Quiz.html",
  // "9|biology": "https://mesfene-biology-grade9-unit2.netlify.app/Biology_Grade9_Unit2_VIP_Quiz.html",
};

function sessionStore() {
  return getStore("bot-sessions");
}

async function getSession(chatId) {
  const store = sessionStore();
  const s = await store.get(String(chatId), { type: "json" });
  return s || { step: "idle", units: [] };
}

async function saveSession(chatId, session) {
  const store = sessionStore();
  await store.setJSON(String(chatId), session);
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

// ---- Step 1: track ----
function trackKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "A. Social subject", callback_data: "track:social" }],
      [{ text: "B. Natural subject", callback_data: "track:natural" }],
    ],
  };
}

// ---- Step 2: grade ----
function gradeKeyboard() {
  return {
    inline_keyboard: [
      [{ text: "A. Grade 9", callback_data: "grade:9" }],
      [{ text: "B. Grade 10", callback_data: "grade:10" }],
      [{ text: "C. Grade 11", callback_data: "grade:11" }],
      [{ text: "D. Grade 12", callback_data: "grade:12" }],
    ],
  };
}

// ---- Step 3: subject ----
function subjectKeyboard(track) {
  const letters = ["A", "B", "C", "D"];
  return {
    inline_keyboard: SUBJECTS[track].map((s, i) => [
      { text: `${letters[i]}. ${s.label}`, callback_data: `subj:${s.key}` },
    ]),
  };
}

// ---- Step 4: unit multi-select ----
function unitLabel(n, session, selected) {
  const tag = `${session.grade ? "Grade " + session.grade : "?"}/${
    subjectLabel(session.track, session.subject) || "?"
  }`;
  const mark = selected ? "✅ " : "";
  return `${mark}Unit ${n} [${tag}]`;
}

function subjectLabel(track, key) {
  const list = SUBJECTS[track] || [];
  const found = list.find((s) => s.key === key);
  return found ? found.label : key;
}

function unitsKeyboard(session) {
  const rows = [];
  for (let n = 1; n <= 10; n++) {
    const selected = session.units.includes(n);
    rows.push([{ text: unitLabel(n, session, selected), callback_data: `unit:${n}` }]);
  }
  rows.push([{ text: "✅ ጨርሻለሁ (Done)", callback_data: "units_done" }]);
  return { inline_keyboard: rows };
}

function siteLinkFor(grade, subjectKey) {
  return SITE_LINKS[`${grade}|${subjectKey}`] || null;
}

async function sendFinalInstructions(chatId, session) {
  const count = session.units.length;
  const price = PRICE_TABLE[count];
  const link = siteLinkFor(session.grade, session.subject);
  const linkLine = link
    ? `ወደዚህ ሊንክ ይግቡ፦ ${link}`
    : `ወደ website ልክ ሊንኩን መምህሩ ክፍያዎን ካረጋገጠ በኋላ በቅርቡ ይልክልዎታል።`;

  const text =
    `መጀመርያ በዚህ Account number <code>${ACCOUNT_NUMBER}</code>\n` +
    `<b>${price} ብር</b> ገቢ ካደረጉ በኋላ ${linkLine} ሊንኩን ነክተው ሲገቡ training box የምትለዋን በመንካት አገልግሎቱን እንዴት መጠቀም እንዳለብዎት የሚያሳይ video ተዘጋጅቷል። video-ውን በማየት ብቻ አገልግሎቱን ያለምንም ችግር መጠቀም ይችላሉ🥰\n\n` +
    `ከዚያ የሚጠይቅዎትን የይለፍ ቃል (password) ይህንን በመሙላት፦ <code>mesfene123</code>\n\n` +
    `ቀጥሎ በሚመጣው page ላይ፦\n` +
    `First name:-\nLast name:-\nYour phone number:-\n\n` +
    `በማስገባት ከተመዘገቡ በኋላ የከፈሉበትን ደረሰኝ ወይም screenshot ወደዚህ ወደዚሁ chat በመላክ ሙሉ አገልግሎቱን ማስጀመር ይችላሉ🙏🙏🙏🥰🥰`;

  await sendMessage(chatId, text);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 200, body: "ok" };
  }

  let update;
  try {
    update = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 200, body: "ok" };
  }

  // ================= Button taps =================
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message.chat.id;
    const messageId = cq.message.message_id;
    const data = cq.data;
    const { fullName, username } = personName(cq.from);
    let session = await getSession(chatId);

    // ---- start the wizard ----
    if (data === "opt:how_to_start") {
      await answerCallbackQuery(cq.id, "እሺ 🙏");
      await notifyAdmin(
        `📩 <b>${fullName || "ስም የለም"}</b> (${username}) ምዝገባ ጀምሯል።\nChat ID: <code>${chatId}</code>`
      );
      session = { step: "track", units: [] };
      await saveSession(chatId, session);
      await sendMessage(chatId, "የትምህርት አይነት ምንድነው?", { reply_markup: trackKeyboard() });
      return { statusCode: 200, body: "ok" };
    }

    // ---- track chosen ----
    if (data.startsWith("track:")) {
      session.track = data.split(":")[1];
      session.step = "grade";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await sendMessage(chatId, "የስንተኛ ክፍል ነዎት?", { reply_markup: gradeKeyboard() });
      return { statusCode: 200, body: "ok" };
    }

    // ---- grade chosen ----
    if (data.startsWith("grade:")) {
      session.grade = data.split(":")[1];
      session.step = "subject";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await sendMessage(chatId, "የትኛውን Subject ይፈልጋሉ?", {
        reply_markup: subjectKeyboard(session.track),
      });
      return { statusCode: 200, body: "ok" };
    }

    // ---- subject chosen -> show unit multi-select ----
    if (data.startsWith("subj:")) {
      session.subject = data.split(":")[1];
      session.step = "units";
      session.units = [];
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      const sent = await sendMessage(chatId, "የሚፈልጉት የ unit quiz ብዛት ስንት ነው? 🥰 (ከ6 በላይ መምረጥ አይቻልም)", {
        reply_markup: unitsKeyboard(session),
      });
      session.unitsMessageId = sent.result ? sent.result.message_id : null;
      await saveSession(chatId, session);
      return { statusCode: 200, body: "ok" };
    }

    // ---- toggle a unit ----
    if (data.startsWith("unit:")) {
      const n = parseInt(data.split(":")[1], 10);
      const already = session.units.includes(n);
      if (!already && session.units.length >= MAX_UNITS) {
        await answerCallbackQuery(cq.id, `ከ${MAX_UNITS} በላይ unit መምረጥ አይቻልም 🙏`, true);
        return { statusCode: 200, body: "ok" };
      }
      session.units = already
        ? session.units.filter((u) => u !== n)
        : [...session.units, n];
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, already ? "ተነስቷል" : "ተመርጧል ✅");
      if (session.unitsMessageId) {
        await editMarkup(chatId, session.unitsMessageId, unitsKeyboard(session));
      }
      return { statusCode: 200, body: "ok" };
    }

    // ---- done selecting units ----
    if (data === "units_done") {
      if (session.units.length === 0) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ unit ይምረጡ 🙏", true);
        return { statusCode: 200, body: "ok" };
      }
      await answerCallbackQuery(cq.id, "ተልኳል ✅");
      session.step = "awaiting_payment";
      await saveSession(chatId, session);

      const price = PRICE_TABLE[session.units.length];
      const subjLabel = subjectLabel(session.track, session.subject);
      const unitsList = session.units.sort((a, b) => a - b).join(", ");

      await notifyAdmin(
        `🧾 <b>የምዝገባ ማጠቃለያ</b>\n` +
          `ከ: ${fullName || "ስም የለም"} (${username})\n` +
          `Chat ID: <code>${chatId}</code>\n` +
          `Grade: ${session.grade}\n` +
          `Subject: ${subjLabel}\n` +
          `Units: ${unitsList}\n` +
          `የሚከፈል ዋጋ: <b>${price} ብር</b>`
      );

      await sendFinalInstructions(chatId, session);
      return { statusCode: 200, body: "ok" };
    }

    await answerCallbackQuery(cq.id, "");
    return { statusCode: 200, body: "ok" };
  }

  // ================= Regular messages =================
  const msg = update.message;
  if (!msg) {
    return { statusCode: 200, body: "ok" };
  }

  const studentChatId = msg.chat.id;
  const { fullName, username } = personName(msg.from);

  // ---- a photo (e.g. payment receipt) ----
  if (msg.photo && msg.photo.length) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;
    if (ADMIN_CHAT_ID) {
      await tg("sendPhoto", {
        chat_id: ADMIN_CHAT_ID,
        photo: fileId,
        caption:
          `🧾 <b>ደረሰኝ/Screenshot ደርሷል</b>\n` +
          `ከ: ${fullName || "ስም የለም"} (${username})\n` +
          `Chat ID: <code>${studentChatId}</code>${msg.caption ? `\n\n${msg.caption}` : ""}`,
        parse_mode: "HTML",
      });
    }
    await sendMessage(studentChatId, "ደረሰኙ ደርሶናል ✅ መምህሩ አረጋግጦ በቅርቡ access ይሰጥዎታል 🙏");
    return { statusCode: 200, body: "ok" };
  }

  if (!msg.text) {
    return { statusCode: 200, body: "ok" };
  }

  const text = msg.text.trim();

  // ---- Admin replying to a student ----
  if (String(studentChatId) === String(ADMIN_CHAT_ID) && text.startsWith("/reply")) {
    const parts = text.split(" ");
    const targetChatId = parts[1];
    const replyText = parts.slice(2).join(" ");
    if (targetChatId && replyText) {
      await sendMessage(targetChatId, `💬 <b>ከመምህሩ መልስ</b>፦\n${replyText}`);
      await sendMessage(ADMIN_CHAT_ID, "✅ ተልኳል።");
    } else {
      await sendMessage(ADMIN_CHAT_ID, "አጠቃቀም፦ /reply <chat_id> <መልእክት>");
    }
    return { statusCode: 200, body: "ok" };
  }

  if (text === "/start") {
    await saveSession(studentChatId, { step: "idle", units: [] });
    await sendMessage(
      studentChatId,
      "ሰላም! 👋 ችግርህን/ሽን ወይም ጥያቄህን/ሽን በአጭሩ ጻፍልኝ/ፊሊኝ፣ ወይም ከታች ተጫን፣ ወደ መምህሩ በቀጥታ እልክለታለሁ። 🙏",
      {
        reply_markup: {
          inline_keyboard: [[{ text: "እንዴት መጀመር እችላለው?", callback_data: "opt:how_to_start" }]],
        },
      }
    );
    return { statusCode: 200, body: "ok" };
  }

  // Any other free text: forward to the admin, then confirm to the student.
  if (ADMIN_CHAT_ID) {
    await sendMessage(
      ADMIN_CHAT_ID,
      `📩 <b>አዲስ መልእክት</b>\n` +
        `ከ: ${fullName || "ስም የለም"} (${username})\n` +
        `Chat ID: <code>${studentChatId}</code>\n\n${text}`
    );
  }
  await sendMessage(studentChatId, "መልእክትህ ደርሷል ✅ መምህሩ በቅርቡ ምላሽ ይሰጥሃል። አመሰግናለሁ 🙏");

  return { statusCode: 200, body: "ok" };
};
