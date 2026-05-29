# Imagem oficial do Puppeteer: já vem com o Google Chrome instalado e todas
# as bibliotecas do sistema necessárias para rodar headless. Evita o trabalho
# de instalar dezenas de pacotes apt manualmente.
FROM ghcr.io/puppeteer/puppeteer:25.1.0

# O Chrome da imagem fica neste caminho; usamos ele em vez de baixar outro.
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    NODE_ENV=production

# Instala como root para evitar erros de permissão (EACCES) ao criar node_modules
USER root
WORKDIR /usr/src/app

# Instala dependências primeiro (melhor cache de build)
COPY package*.json ./
RUN npm install --omit=dev

# Copia o restante do código e devolve a pasta ao usuário sem privilégios
COPY . .
RUN chown -R pptruser:pptruser /usr/src/app

# Roda como usuário sem privilégios (o Chrome usa --no-sandbox no código)
USER pptruser

# Railway injeta a porta via $PORT; expomos 3000 como padrão local
EXPOSE 3000

CMD ["node", "server.js"]
