import express from "express";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;

// API key opcional: se definir API_KEY no ambiente, exige o header "x-api-key".
const API_KEY = process.env.API_KEY || null;

// Timeout (ms) para carregar a página antes de gerar o PDF.
const NAV_TIMEOUT = Number(process.env.NAV_TIMEOUT || 30000);

app.use(express.json({ limit: "5mb" }));

// ---------------------------------------------------------------------------
// Navegador compartilhado: abrir o Chromium é caro, então reaproveitamos uma
// instância entre requisições e religamos caso ela caia.
// ---------------------------------------------------------------------------
let browserPromise = null;

async function getBrowser() {
  if (browserPromise) {
    const browser = await browserPromise;
    if (browser.connected) return browser;
    browserPromise = null; // caiu: força relançar
  }

  browserPromise = puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    // Se PUPPETEER_EXECUTABLE_PATH estiver definida, usa esse binário; senão
    // (caso padrão no Docker) o Puppeteer localiza o Chrome pelo cache.
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
  });

  return browserPromise;
}

// ---------------------------------------------------------------------------
// Geração do PDF
// ---------------------------------------------------------------------------
async function generatePdf({ url, html, options = {} }) {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    if (url) {
      await page.goto(url, { waitUntil: "networkidle2", timeout: NAV_TIMEOUT });
    } else {
      await page.setContent(html, {
        waitUntil: "networkidle0",
        timeout: NAV_TIMEOUT,
      });
    }

    const pdf = await page.pdf({
      format: options.format || "A4",
      landscape: Boolean(options.landscape),
      printBackground: options.printBackground !== false, // padrão: true
      margin: options.margin || {
        top: "16mm",
        bottom: "16mm",
        left: "12mm",
        right: "12mm",
      },
    });

    // page.pdf() retorna Uint8Array no Puppeteer 25+; convertemos para Buffer
    // para que .toString("base64") e o envio binário funcionem corretamente.
    return Buffer.from(pdf);
  } finally {
    await page.close();
  }
}

// ---------------------------------------------------------------------------
// Middlewares
// ---------------------------------------------------------------------------
function checkApiKey(req, res, next) {
  if (!API_KEY) return next();
  if (req.get("x-api-key") === API_KEY) return next();
  return res.status(401).json({ error: "API key inválida ou ausente (header x-api-key)." });
}

function isValidHttpUrl(value) {
  try {
    const u = new URL(value);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch {
    return false;
  }
}

// Envia o resultado no formato escolhido:
//   output = "base64"  -> JSON { filename, mimeType, size, base64 }
//   output = "binary"  -> bytes crus do PDF (padrão)
// Para binário, disposition = "attachment" força o download no navegador.
function sendResult(res, pdf, { output = "binary", filename = "document.pdf", disposition = "inline" } = {}) {
  if (output === "base64") {
    return res.json({
      filename,
      mimeType: "application/pdf",
      size: pdf.length,
      base64: pdf.toString("base64"),
    });
  }

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `${disposition}; filename="${filename}"`,
    "Content-Length": pdf.length,
  });
  res.end(pdf);
}

// ---------------------------------------------------------------------------
// Rotas
// ---------------------------------------------------------------------------

// Health check
app.get("/", (_req, res) => {
  res.json({
    status: "ok",
    service: "html-to-pdf-api",
    usage: {
      "GET /pdf?url=...": "Converte a página do link em PDF",
      "POST /pdf { url }": "Converte a página do link em PDF",
      "POST /pdf { html }": "Converte um HTML cru em PDF",
    },
  });
});

// GET /pdf?url=https://exemplo.com&landscape=true&format=A4&output=base64
app.get("/pdf", checkApiKey, async (req, res) => {
  const { url, format, landscape, output, download, filename } = req.query;

  if (!url || !isValidHttpUrl(url)) {
    return res.status(400).json({ error: "Parâmetro 'url' ausente ou inválido (use http/https)." });
  }

  try {
    const pdf = await generatePdf({
      url,
      options: { format, landscape: landscape === "true" },
    });
    sendResult(res, pdf, {
      output: output === "base64" ? "base64" : "binary",
      filename: filename || "document.pdf",
      disposition: download === "true" ? "attachment" : "inline",
    });
  } catch (err) {
    console.error("Erro ao gerar PDF (GET):", err);
    res.status(500).json({ error: "Falha ao gerar o PDF.", detail: err.message });
  }
});

// POST /pdf  body: { url } ou { html }  + options
app.post("/pdf", checkApiKey, async (req, res) => {
  const { url, html, options } = req.body || {};

  if (!url && !html) {
    return res.status(400).json({ error: "Envie 'url' ou 'html' no corpo da requisição." });
  }
  if (url && !isValidHttpUrl(url)) {
    return res.status(400).json({ error: "'url' inválida (use http/https)." });
  }

  try {
    const pdf = await generatePdf({ url, html, options });
    const opts = options || {};
    sendResult(res, pdf, {
      output: opts.output === "base64" ? "base64" : "binary",
      filename: opts.filename || "document.pdf",
      disposition: opts.download ? "attachment" : "inline",
    });
  } catch (err) {
    console.error("Erro ao gerar PDF (POST):", err);
    res.status(500).json({ error: "Falha ao gerar o PDF.", detail: err.message });
  }
});

// ---------------------------------------------------------------------------
// Start + shutdown gracioso
// ---------------------------------------------------------------------------
const server = app.listen(PORT, () => {
  console.log(`html-to-pdf-api ouvindo na porta ${PORT}`);
});

async function shutdown() {
  console.log("Encerrando...");
  server.close();
  if (browserPromise) {
    try {
      const browser = await browserPromise;
      await browser.close();
    } catch {
      /* ignore */
    }
  }
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
