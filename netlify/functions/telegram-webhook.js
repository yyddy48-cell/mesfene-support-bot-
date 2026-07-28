// ============================================
// Telegram Registration-Wizard Bot — Netlify Function
// ============================================

const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const ACCOUNT_NUMBER = "1000102646437";
const DB_URL = "https://chemistry-quiz-b0389-default-rtdb.firebaseio.com";

const MAX_UNITS_PER_GRADE = 6;

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

const SITE_LINKS = {};

function computePrice(gradesCount, totalUnits) {
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

function subjectKeyboard(track) {
  const letters = ["A", "B", "C", "D"];
  return {
    inline_keyboard: SUBJECTS[track].map((s, i) => [
      { text: `${letters[i]}. ${s.label}`, callback_data: `subj:${s.key}` },
    ]),
  };
}

function gradeKeyboard(selectedGrades) {
  const grades = [9, 10, 11, 12];
  const letters = ["A", "B", "C", "D"];
  return {
    inline_keyboard: [
      ...grades.map((g, i) => {
        const selected = selectedGrades.includes(g);
        return [
          {
            text: `${selected ? "✅ " : ""}${letters[i]}. Grade ${g}`,
            callback_data: `grade:${g}`,
          },
        ];
      }),
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
  const rows = [];
  for (let n = 1; n <= 10; n++) {
    const row = grades.map((g) => {
      const selected = Array.isArray(unitsByGrade[g]) && unitsByGrade[g].includes(n);
      return {
        text: `${selected ? "✅ " : ""}G${g}-U${n}`,
        callback_data: `unit:${g}:${n}`,
      };
    });
    rows.push(row);
  }
  rows.push([{ text: "✅ ጨርሻለሁ (Done)", callback_data: "units_done" }]);
  return { inline_keyboard: rows };
}

async function sendFinalInstructions(chatId, session) {
  const grades = [...session.grades].sort((a, b) => a - b);
  const unitsByGrade = session.unitsByGrade || {};
  let totalUnits = 0;
  grades.forEach((g) => {
    totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0;
  });
  const price = computePrice(grades.length, totalUnits);

  const text =
    `መጀመርያ በዚህ Account number <code>${ACCOUNT_NUMBER}</code>\n` +
    `<b>${price} ብር</b> ገቢ ካደረጉ በኋላ የመረጡትን ጥያቄዎች ሊንክ መምህሩ ክፍያዎን ካረጋገጠ በኋላ በቅርቡ ይልክልዎታል። ከዚያ ልክ መጀመሪያ ሊንኩን ነክተው ወደ website ሲገቡ training box የምትለዋን በመንካት አገልግሎቱን እንዴት መጠቀም እንዳለብዎት የሚያሳይ video ተዘጋጅቷል። video-ውን በማየት ብቻ አገልግሎቱን ያለምንም ችግር መጠቀም ይችላሉ🥰\n\n` +
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

  // ---- CALLBACK QUERIES ----
  if (update.callback_query) {
    const cq = update.callback_query;
    const chatId = cq.message.chat.id;
    const data = cq.data;
    const { fullName, username } = personName(cq.from);
    let session = await getSession(chatId);

    if (data === "opt:how_to_start") {
      await answerCallbackQuery(cq.id, "እሺ 🙏");
      await notifyAdmin(
        `📩 <b>${fullName || "ስም የለም"}</b> (${username}) ምዝገባ ጀምሯል።\nChat ID: <code>${chatId}</code>`
      );
      session = { step: "track", grades: [], unitsByGrade: {} };
      await saveSession(chatId, session);
      await sendMessage(chatId, "የትምህርት አይነት ምንድነው?", { reply_markup: trackKeyboard() });
      return { statusCode: 200, body: "ok" };
    }

    if (data.startsWith("track:")) {
      session.track = data.split(":")[1];
      session.step = "subject";
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await sendMessage(chatId, "የትኛውን Subject ይፈልጋሉ?", {
        reply_markup: subjectKeyboard(session.track),
      });
      return { statusCode: 200, body: "ok" };
    }

    if (data.startsWith("subj:")) {
      session.subject = data.split(":")[1];
      session.step = "grade";
      session.grades = [];
      session.unitsByGrade = {};
      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, "እሺ");
      await sendMessage(
        chatId,
        "የስንተኛ ክፍል ነዎት? (ከ1 እስከ 4 grade መምረጥ ይችላሉ)\nከመረጡ በኋላ <b>ጨርሻለሁ</b> ይጫኑ።",
        { reply_markup: gradeKeyboard(session.grades) }
      );
      return { statusCode: 200, body: "ok" };
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
      return { statusCode: 200, body: "ok" };
    }

    if (data === "grades_done") {
      if (!session.grades || session.grades.length === 0) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ grade ይምረጡ 🙏", true);
        return { statusCode: 200, body: "ok" };
      }
      await answerCallbackQuery(cq.id, "እሺ");
      session.step = "units";
      session.unitsByGrade = {};
      session.grades.forEach((g) => { session.unitsByGrade[g] = []; });

      const grades = [...session.grades].sort((a, b) => a - b);
      const subjLabel = subjectLabel(session.track, session.subject);
      const gradeStr = grades.map((g) => `Grade ${g}`).join(" and ");

      const sent = await sendMessage(
        chatId,
        `ከ ${subjLabel} ${gradeStr} የሚፈልጉትን የ unit quiz (ጥያቄ) ብዛት ይምረጡ? 🥰\n(በአንድ grade ውስጥ ከ${MAX_UNITS_PER_GRADE} unit በላይ መምረጥ አይቻልም)\n\nG = Grade, U = Unit`,
        { reply_markup: unitsKeyboard(session) }
      );
      session.unitsMessageId = sent.result ? sent.result.message_id : null;
      await saveSession(chatId, session);
      return { statusCode: 200, body: "ok" };
    }

    if (data.startsWith("unit:")) {
      const parts = data.split(":");
      const g = parseInt(parts[1], 10);
      const n = parseInt(parts[2], 10);

      if (!session.unitsByGrade) session.unitsByGrade = {};
      if (!Array.isArray(session.unitsByGrade[g])) session.unitsByGrade[g] = [];

      const already = session.unitsByGrade[g].includes(n);
      if (!already && session.unitsByGrade[g].length >= MAX_UNITS_PER_GRADE) {
        await answerCallbackQuery(
          cq.id,
          `Grade ${g} ውስጥ ከ${MAX_UNITS_PER_GRADE} unit በላይ መምረጥ አይቻልም 🙏`,
          true
        );
        return { statusCode: 200, body: "ok" };
      }

      session.unitsByGrade[g] = already
        ? session.unitsByGrade[g].filter((u) => u !== n)
        : [...session.unitsByGrade[g], n];

      await saveSession(chatId, session);
      await answerCallbackQuery(cq.id, already ? "ተነስቷል" : "ተመርጧል ✅");
      if (session.unitsMessageId) {
        await editMarkup(chatId, session.unitsMessageId, unitsKeyboard(session));
      }
      return { statusCode: 200, body: "ok" };
    }

    if (data === "units_done") {
      const unitsByGrade = session.unitsByGrade || {};
      let totalUnits = 0;
      (session.grades || []).forEach((g) => {
        totalUnits += Array.isArray(unitsByGrade[g]) ? unitsByGrade[g].length : 0;
      });

      if (totalUnits === 0) {
        await answerCallbackQuery(cq.id, "ቢያንስ አንድ unit ይምረጡ 🙏", true);
        return { statusCode: 200, body: "ok" };
      }

      await answerCallbackQuery(cq.id, "ተልኳል ✅");
      session.step = "awaiting_payment";
      await saveSession(chatId, session);

      const grades = [...(session.grades || [])].sort((a, b) => a - b);
      const price = computePrice(grades.length, totalUnits);
      const subjLabel = subjectLabel(session.track, session.subject);

      let unitsSummary = "";
      grades.forEach((g) => {
        const units = (unitsByGrade[g] || []).sort((a, b) => a - b);
        unitsSummary += `  Grade ${g}: ${units.length > 0 ? "Unit " + units.join(", ") : "—"}\n`;
      });

      await notifyAdmin(
        `🧾 <b>የምዝገባ ማጠቃለያ</b>\n` +
          `ከ: ${fullName || "ስም የለም"} (${username})\n` +
          `Chat ID: <code>${chatId}</code>\n` +
          `Track: ${session.track}\n` +
          `Subject: ${subjLabel}\n` +
          `Grades & Units:\n${unitsSummary}` +
          `አጠቃላይ Units: ${totalUnits}\n` +
          `የሚከፈል ዋጋ: <b>${price} ብር</b>`
      );

      await sendFinalInstructions(chatId, session);
      return { statusCode: 200, body: "ok" };
    }

    await answerCallbackQuery(cq.id, "");
    return { statusCode: 200, body: "ok" };
  }

  // ---- MESSAGES ----
  const msg = update.message;
  if (!msg) return { statusCode: 200, body: "ok" };

  const studentChatId = msg.chat.id;
  const { fullName, username } = personName(msg.from);
  const isAdmin = String(studentChatId) === String(ADMIN_CHAT_ID);

  // Photo forwarding
  if (msg.photo && msg.photo.length) {
    const fileId = msg.photo[msg.photo.length - 1].file_id;

    if (!isAdmin) {
      // Read only the step field directly from Firebase — faster and more reliable
      const sessionStep = await getSessionStep(studentChatId);

      if (sessionStep !== "awaiting_payment") {
        // Student sent receipt without completing registration — send funny message
        await sendMessage(
          studentChatId,
          `ምን አርጉ ነው ምትለው አንበሳው?😉 ደደብ ነክ እንዴ🤭😁? ሲጀመር የተማረ የት ደረሰ የተማረ ሰባተኛ ሰማይ ነው😁 ለዛ አንተ አትማር ተምረክም አጠቅምም😁😁`
        );
        return { statusCode: 200, body: "ok" };
      }

      // Student completed registration — forward receipt to admin
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
    }

    return { statusCode: 200, body: "ok" };
  }

  if (!msg.text) return { statusCode: 200, body: "ok" };

  const text = msg.text.trim();

  // Admin reply command
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
    return { statusCode: 200, body: "ok" };
  }

  // /start command
  if (text === "/start") {
    await saveSession(studentChatId, { step: "idle", grades: [], unitsByGrade: {} });
    await sendMessage(
      studentChatId,
      "ሰላም! 👋 ችግርህን/ሽን ወይም ጥያቄህን/ሽን በአጭሩ ጻፍልኝ/ፊሊኝ፣ ወይም ከታች ተጫን፣ ወደ መምህሩ በቀጥታ እልክለታለሁ። 🙏",
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: "እንዴት መጀመር እችላለው?", callback_data: "opt:how_to_start" }],
          ],
        },
      }
    );
    return { statusCode: 200, body: "ok" };
  }

  // Forward any other message to admin
  if (ADMIN_CHAT_ID) {
    await sendMessage(
      ADMIN_CHAT_ID,
      `📩 <b>አዲስ መልእክት</b>\nከ: ${fullName || "ስም የለም"} (${username})\nChat ID: <code>${studentChatId}</code>\n\n${text}`
    );
  }
  await sendMessage(studentChatId, "መልእክትህ ደርሷል ✅ መምህሩ በቅርቡ ምላሽ ይሰጥሃል። አመሰግናለሁ 🙏");

  return { statusCode: 200, body: "ok" };
};
