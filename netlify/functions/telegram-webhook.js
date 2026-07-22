const TELEGRAM_API = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;

async function sendMessage(chatId, text) {
  await fetch(`${TELEGRAM_API}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML" }),
  });
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

  const msg = update.message;
  if (!msg || !msg.text) {
    return { statusCode: 200, body: "ok" };
  }

  const studentChatId = msg.chat.id;
  const text = msg.text.trim();
  const first = msg.from.first_name || "";
  const last = msg.from.last_name || "";
  const username = msg.from.username ? `@${msg.from.username}` : "(username የለውም)";
  const fullName = `${first} ${last}`.trim();

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
    await sendMessage(
      studentChatId,
      "ሰላም! 👋 ችግርህን ወይም ጥያቄህን በአጭሩ ጻፍልኝ፣ ወደ መምህሩ በቀጥታ እልክላታለሁ። 🙏"
    );
    return { statusCode: 200, body: "ok" };
  }

  if (ADMIN_CHAT_ID) {
    const forward =
      `📩 <b>አዲስ መልእክት</b>\n` +
      `ከ: ${fullName || "ስም የለም"} (${username})\n` +
      `Chat ID: <code>${studentChatId}</code>\n\n` +
      `${text}`;
    await sendMessage(ADMIN_CHAT_ID, forward);
  }

  await sendMessage(
    studentChatId,
    "መልእክትህ ደርሷል ✅ መምህሩ በቅርቡ ምላሽ ይሰጥሃል። አመሰግናለሁ 🙏"
  );

  return { statusCode: 200, body: "ok" };
};
