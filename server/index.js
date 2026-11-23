const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { spawn } = require('child_process');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    if (req.path.startsWith('/api')) {
      console.log(`[HTTP] ${req.method} ${req.originalUrl} -> ${res.statusCode} (${Date.now() - start}ms)`);
    }
  });
  next();
});

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
app.use('/uploads', express.static(uploadsDir));

require('./database');
const { authMiddleware, requireAdmin, requireRole, selfParam } = require('./auth');

const meRoutes = require('./routes/me');
const adminRoutes = require('./routes/admin');
const courierRoutes = require('./routes/courier');
const sellerRoutes = require('./routes/seller');
const customerRoutes = require('./routes/customer');
const uploadRoutes = require('./routes/upload');
const messageRoutes = require('./routes/messages');
const accessRequestRoutes = require('./routes/accessRequests');

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Hamma /api uchun Telegram imzosi majburiy
app.use('/api', authMiddleware);

app.use('/api/me', meRoutes);
app.use('/api/access-requests', accessRequestRoutes);

// Xabarlar (sotuvchi/kuryer/mijoz -> Admin va Admin -> hamma): eski mijoz yo'li ham ishlaydi
app.use('/api/admin/messages', messageRoutes);

// /api/admin: faqat Admin ID (check-access har kimga o'z holatini aytadi)
app.use('/api/admin', (req, res, next) => {
  if (req.path.startsWith('/check-access')) return next();
  return requireAdmin(req, res, next);
});
app.use('/api/admin', adminRoutes);

// Har bir panel API si faqat o'z roli uchun (admin - faqat kuzatuvchi)
for (const [base, role, router] of [
  ['/api/courier', 'courier', courierRoutes],
  ['/api/seller', 'seller', sellerRoutes],
  ['/api/customer', 'customer', customerRoutes]
]) {
  app.use(base, requireRole(role));
  router.param('telegramId', selfParam);
  app.use(base, router);
}
app.use('/api/messages', messageRoutes);
app.use('/api/upload', uploadRoutes);

const clientDist = path.join(__dirname, '..', 'client', 'dist');
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist));
  app.get('*', (req, res) => {
    if (!req.path.startsWith('/api') && !req.path.startsWith('/uploads')) {
      res.sendFile(path.join(clientDist, 'index.html'));
    }
  });
}

// Xatoliklar (masalan multer: noto'g'ri fayl turi / katta fayl)
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.code === 'LIMIT_FILE_SIZE' ? 413 : (err.name === 'MulterError' || /rasm/i.test(err.message) ? 400 : 500);
  res.status(status).json({ error: err.message });
});

app.listen(PORT, () => {
  console.log(`🚀 Backend Server running on http://localhost:${PORT}`);
});

let botModule = null;
if (process.env.DISABLE_BOT !== '1') {
  try {
    botModule = require('./bot');
    console.log('🤖 Telegram Bot running with polling');
  } catch (e) {
    console.error('❌ Bot start error:', e.message);
  }
}

// Render yoki tashqi HTTPS URL bo'lsa cloudflared siz to'g'ridan-to'g'ri ulaymiz va 24/7 uyg'oq saqlaymiz
const externalHttpsUrl = process.env.RENDER_EXTERNAL_URL || (process.env.MINI_APP_URL && /^https:\/\//i.test(process.env.MINI_APP_URL) ? process.env.MINI_APP_URL : '');
if ((process.env.RENDER || externalHttpsUrl) && botModule) {
  if (externalHttpsUrl) {
    const cleanUrl = externalHttpsUrl.replace(/\/+$/, '');
    botModule.setMiniAppUrl(cleanUrl);
    setTimeout(() => botModule.setMiniAppUrl(cleanUrl), 15000);
    setInterval(() => {
      botModule.setMiniAppUrl(cleanUrl);
      fetch(`${cleanUrl}/health`).catch(() => {});
    }, 10 * 60 * 1000);
  }
} else if ((process.env.AUTO_TUNNEL === '1' || !process.env.RENDER) && botModule) {
  let exe = path.join(__dirname, '..', 'cloudflared.exe');
  if (!fs.existsSync(exe)) {
    if (fs.existsSync('/usr/local/bin/cloudflared')) {
      exe = '/usr/local/bin/cloudflared';
    } else if (fs.existsSync('/usr/bin/cloudflared')) {
      exe = '/usr/bin/cloudflared';
    } else {
      exe = 'cloudflared';
    }
  }
  {
    let currentCf = null;
    const startTunnel = () => {
      if (currentCf) {
        try { currentCf.kill(); } catch (e) {}
      }
      const cf = spawn(exe, ['tunnel', '--url', `http://127.0.0.1:${PORT}`], { windowsHide: true });
      currentCf = cf;
      let found = false;
      const onData = (buf) => {
        const m = String(buf).match(/https:\/\/[a-zA-Z0-9-]+\.trycloudflare\.com/);
        if (m && !found) {
          found = true;
          console.log('🌐 Mini App HTTPS URL:', m[0]);
          botModule.setMiniAppUrl(m[0]);
        }
      };
      cf.stdout.on('data', onData);
      cf.stderr.on('data', onData);
      cf.on('exit', (code) => {
        if (!currentCf) return; // intended stop
        console.error(`⚠️ cloudflared to'xtadi (kod ${code}), 5 soniyadan so'ng qayta ishga tushadi...`);
        setTimeout(startTunnel, 5000);
      });
    };
    const killTunnel = () => {
      if (currentCf) {
        try { currentCf.kill(); } catch (e) {}
        currentCf = null;
      }
    };
    process.once('exit', killTunnel);
    process.once('SIGINT', killTunnel);
    process.once('SIGTERM', killTunnel);
    startTunnel();
  }
}

process.on('unhandledRejection', (e) => console.error('unhandledRejection:', e?.message || e));
