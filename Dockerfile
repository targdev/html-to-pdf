# Imagem oficial do Puppeteer: já traz todas as bibliotecas de sistema
# necessárias para rodar o Chrome headless. Instalamos o navegador num
# diretório de cache controlado para não depender do caminho interno da imagem.
FROM ghcr.io/puppeteer/puppeteer:25.1.0

# Cache do navegador dentro da pasta da app (a que damos chown ao pptruser).
# NÃO fixamos PUPPETEER_EXECUTABLE_PATH: o Puppeteer localiza o Chrome sozinho
# por este cache, evitando o erro "Browser was not found at ...".
ENV NODE_ENV=production \
    PUPPETEER_CACHE_DIR=/usr/src/app/.cache/puppeteer

# Instala como root para evitar erros de permissão (EACCES)
USER root
WORKDIR /usr/src/app

# Instala dependências primeiro (melhor cache de build)
COPY package*.json ./
RUN npm install --omit=dev

# Baixa o Chrome compatível com a versão do Puppeteer para o cache acima
RUN npx puppeteer browsers install chrome

# Copia o restante do código e devolve a pasta ao usuário sem privilégios
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app

# Roda como usuário sem privilégios (o Chrome usa --no-sandbox no código)
USER pptruser

# Railway injeta a porta via $PORT; expomos 3000 como padrão local
EXPOSE 3000

CMD ["node", "server.js"]
