import {
  makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  delay
} from '@whiskeysockets/baileys';
import pino from 'pino';
import qrcode from 'qrcode-terminal';
import fs from 'fs';
import path from 'path';
import { createSticker } from './lib/sticker.js';
import { BOT_NAME, OWNER_NUMBER, PREFIX } from './config.js';

const sessionPath = './session';
const logger = pino({ level: 'silent' });

async function startAxceellBotz() {
  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath);
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: true,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    logger
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason === DisconnectReason.loggedOut) {
        console.log("Logged out, restarting...");
        startAxceellBotz();
      } else {
        console.log("Connection closed. Reconnecting...");
        startAxceellBotz();
      }
    } else if (connection === 'open') {
      console.log(`${BOT_NAME} is now connected!`);
    }
  });

  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    const msg = messages[0];
    if (!msg.message || msg.key.fromMe) return;

    const from = msg.key.remoteJid;
    const text = msg.message.conversation || msg.message.extendedTextMessage?.text || "";
    const sender = msg.key.participant || msg.key.remoteJid;

    if (msg.message.imageMessage && text === "") {
      const mediaBuffer = await sock.downloadMediaMessage(msg);
      const mimeType = msg.message.imageMessage.mimetype;
      const stickerBuffer = await createSticker(mediaBuffer, mimeType);

      if (stickerBuffer) {
        await sock.sendMessage(from, { sticker: stickerBuffer }, { quoted: msg });
      }
    }

    if (text.startsWith(PREFIX)) {
      const command = text.slice(PREFIX.length).trim().toLowerCase();

      switch (command) {
        case "menu":
          await sock.sendMessage(from, {
            text: `👋 Hai! Ini ${BOT_NAME}

Fitur:
1. Buat stiker dari gambar
2. Auto Respon
3. Anti-Link (segera)

Ketik /menu untuk melihat ini lagi.`
          }, { quoted: msg });
          break;

        case "owner":
          await sock.sendMessage(from, { text: `👑 Owner: wa.me/${OWNER_NUMBER}` }, { quoted: msg });
          break;

        default:
          await sock.sendMessage(from, { text: `❓ Perintah *${command}* tidak dikenali.` }, { quoted: msg });
      }
    }

    if (text.includes("chat.whatsapp.com")) {
      if (!from.includes("@g.us")) return;
      await sock.sendMessage(from, {
        text: "⚠️ Link grup terdeteksi! Fitur anti-link aktif.",
      }, { quoted: msg });
    }
  });
}

startAxceellBotz();