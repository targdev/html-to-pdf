# html-to-pdf-api

API simples e gratuita para converter **um link (URL)** ou **HTML cru** em **PDF**, usando [Puppeteer](https://pptr.dev/) (Chrome headless). Pronta para hospedar no **Railway** a partir de um repositório no GitHub.

## Endpoints

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET`  | `/` | Health check / ajuda |
| `GET`  | `/pdf?url=...` | Converte a página do link em PDF |
| `POST` | `/pdf` | Converte `url` **ou** `html` (no corpo JSON) em PDF |

### Exemplos

**Link → PDF (o caso principal):**
```
GET https://SEU-APP.up.railway.app/pdf?url=https://example.com
```
Abra no navegador e o PDF é exibido/baixado direto.

Opções via query: `format` (A4, A3, Letter…), `landscape=true`.
```
GET /pdf?url=https://example.com&format=A4&landscape=true
```

**Via POST (link):**
```bash
curl -X POST https://SEU-APP.up.railway.app/pdf \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com"}' \
  --output saida.pdf
```

**Via POST (HTML cru):**
```bash
curl -X POST https://SEU-APP.up.railway.app/pdf \
  -H "Content-Type: application/json" \
  -d '{"html":"<h1>Olá mundo</h1><p>Gerado em PDF.</p>"}' \
  --output saida.pdf
```

**Opções aceitas no POST:**
```json
{
  "url": "https://example.com",
  "options": {
    "format": "A4",
    "landscape": false,
    "printBackground": true,
    "output": "base64",
    "filename": "relatorio.pdf",
    "download": false,
    "margin": { "top": "16mm", "bottom": "16mm", "left": "12mm", "right": "12mm" }
  }
}
```

### Formato de saída

Por padrão a API devolve o **PDF binário** (`Content-Type: application/pdf`). Para consumir em outra API/integração, use `output: "base64"`, que retorna **JSON**:

```bash
# GET
curl "https://SEU-APP.up.railway.app/pdf?url=https://example.com&output=base64"

# POST
curl -X POST https://SEU-APP.up.railway.app/pdf \
  -H "Content-Type: application/json" \
  -d '{"url":"https://example.com","options":{"output":"base64"}}'
```

Resposta:
```json
{
  "filename": "document.pdf",
  "mimeType": "application/pdf",
  "size": 22526,
  "base64": "JVBERi0xLjQ..."
}
```

Para reconstruir o arquivo a partir do base64: `Buffer.from(base64, "base64")` (Node) ou `base64_decode($base64)` (PHP).

> Outras opções de saída: `download=true` (query) ou `"download": true` (POST) força o navegador a baixar o arquivo (`Content-Disposition: attachment`) em vez de exibir; `filename` define o nome do arquivo.

## Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `PORT` | `3000` | Porta do servidor (o Railway injeta automaticamente) |
| `API_KEY` | *(vazio)* | Se definida, exige o header `x-api-key` em todas as requisições de PDF |
| `NAV_TIMEOUT` | `30000` | Tempo máx. (ms) para carregar a página |

## Deploy no Railway

1. Suba esta pasta para um repositório no GitHub.
2. No [Railway](https://railway.app): **New Project → Deploy from GitHub repo** e selecione o repositório.
3. O Railway detecta o `Dockerfile` automaticamente e faz o build. Não precisa configurar nada.
4. (Opcional) Em **Variables**, adicione `API_KEY` para proteger a API.
5. Em **Settings → Networking**, gere um domínio público. Pronto.

> O `Dockerfile` usa a imagem oficial do Puppeteer (já com Chrome instalado), então o deploy é confiável e não precisa instalar dependências de sistema manualmente.

## Rodar localmente

Requer Node 20+. O `npm install` baixa o Chromium do Puppeteer automaticamente.

```bash
npm install
npm start
# acesse http://localhost:3000/pdf?url=https://example.com
```

Para rodar via Docker localmente:
```bash
docker build -t html-to-pdf-api .
docker run -p 3000:3000 html-to-pdf-api
```
