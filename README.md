# ZapDesk · Multiatendimento WhatsApp

Sistema web de multiatendimento, CRM simples e disparo de campanhas pelo WhatsApp, integrado à **Evolution API** e preparado para a **WhatsApp Cloud API oficial** (Meta).

## O que tem

- **Multiatendimento** (`/chat`): lista de conversas com busca, filtros (conexão, tag, atendente) e abas (Todos, Aguardando, Em atendimento, Minhas, Não lidas, Finalizadas); chat com texto, emojis, anexos (imagem, vídeo, PDF), gravação de áudio, respostas rápidas (`/atalho`), assinatura do atendente, reenvio de mensagens com falha, status de entrega (✓ ✓✓ lido); botões *Atender*, *Marcar como lida*, *Finalizar/Reabrir*, transferir atendente e devolver para a fila.
- **Painel do contato**: tags, listas, perfil editável (nome, e-mail, site, documento, nascimento), notas internas, endereço, campos adicionais, **negócio** (valor, etapa do funil, ganho/perdido) e **histórico** do contato.
- **Negócios** (`/negocios`): funil em kanban com arrastar e soltar.
- **Contatos e listas** (`/contatos`): cadastro, importação CSV, listas, seleção em massa.
- **Campanhas** (`/campanhas`): disparo para uma lista com intervalo aleatório entre envios, pausa a cada N mensagens, janela de horário, agendamento, variação de texto (spintax `{Oi|Olá}`), variáveis `{{nome}}`/`{{primeiro_nome}}`, anexo, pausar/retomar/cancelar, reenviar falhas. Quem responde **SAIR/PARAR** vira opt-out e é excluído dos próximos disparos.
- **Conexões** (`/conexoes`): vários números; status, QR Code/código de pareamento e configuração automática do webhook na Evolution.
- **Configurações**: atendentes (admin/atendente), respostas rápidas e tags.

## Stack

Next.js 15 (App Router) + TypeScript + Tailwind CSS 4 · PostgreSQL + Prisma · SWR (atualização a cada 3–4 s).

## Rodando localmente

Pré-requisitos: Node 20+ e PostgreSQL 14+.

```bash
cp .env.example .env        # preencha DATABASE_URL, AUTH_SECRET, WEBHOOK_SECRET e a Evolution
npm install
npm run setup               # cria as tabelas e o usuário admin (ADMIN_EMAIL / ADMIN_PASSWORD)
npm run dev                 # http://localhost:3000
```

Com Docker (sobe Postgres + app):

```bash
cp .env.example .env
docker compose up -d --build
```

## Deploy na Vercel

1. Na Vercel: **Add New → Project** e importe o repositório `vendasplus`.
2. Em **Storage**, crie e conecte ao projeto:
   - um banco **Postgres (Neon)**: ele cria `DATABASE_URL` e `DATABASE_URL_UNPOOLED`;
   - um **Blob Store**: ele cria `BLOB_READ_WRITE_TOKEN` (as mídias ficam privadas no Blob, porque o disco da Vercel é apagado a cada execução).
3. Em **Settings → Environment Variables**, adicione: `APP_URL` (ex.: `https://vendasplus.vercel.app`), `AUTH_SECRET`, `WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_NAME`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`, `TZ=America/Sao_Paulo`. **Não** defina `CAMPAIGN_WORKER_INLINE` (na Vercel não existe processo contínuo).
4. Faça o deploy. O build (`npm run vercel-build`) aplica as migrations e cria o usuário admin.
5. **Campanhas:** a rota `/api/cron/campaigns` precisa ser chamada a cada minuto. No plano Hobby a Vercel recusa crons de menos de 1x/dia (o build falha), por isso o `vercel.json` não agenda nada: use um agendador externo gratuito (ex.: cron-job.org) chamando a cada minuto (no plano Pro dá para adicionar `"crons": [{ "path": "/api/cron/campaigns", "schedule": "* * * * *" }]` ao `vercel.json`):
   `https://SEU-DOMINIO/api/cron/campaigns?secret=CRON_SECRET`
   Cada chamada envia durante ~50 s respeitando o intervalo de cada campanha.

Limites da Vercel: uploads de anexo até ~4,5 MB por requisição; a lista de conversas atualiza por consulta periódica (3–4 s), o que funciona bem em serverless.

## Conectando a Evolution API

1. No `.env`: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY` e `EVOLUTION_INSTANCE` (nunca no código).
2. `APP_URL` precisa ser uma URL que a Evolution consiga acessar (domínio público ou túnel, ex.: `cloudflared`/`ngrok` em testes).
3. Em **Conexões**: *Conectar (QR)* → escaneie no celular → *Configurar webhook*. O webhook fica
   `APP_URL/api/webhooks/evolution?token=WEBHOOK_SECRET` com os eventos `MESSAGES_UPSERT`, `MESSAGES_UPDATE`, `MESSAGES_DELETE`, `CONNECTION_UPDATE`, `QRCODE_UPDATED`, `SEND_MESSAGE` e `webhookBase64: true`.

> Atenção: a Evolution em modo **Baileys** não é a API oficial do WhatsApp; números usados para disparo em massa correm risco de bloqueio. Use os intervalos e pausas das campanhas e prefira listas com opt-in.

## Usando a Cloud API oficial

1. Preencha `WHATSAPP_CLOUD_TOKEN`, `WHATSAPP_CLOUD_PHONE_NUMBER_ID`, `WHATSAPP_CLOUD_VERIFY_TOKEN` e (recomendado) `WHATSAPP_CLOUD_APP_SECRET`.
2. No painel da Meta, webhook: `APP_URL/api/webhooks/cloud`, verify token = `WHATSAPP_CLOUD_VERIFY_TOKEN`, assinatura do campo `messages`.
3. Em **Conexões → Nova conexão**, provedor *Cloud API* e o `phone_number_id`.
4. Campanhas para quem não falou com você nas últimas 24 h exigem **template aprovado** (campo aparece no formulário quando a conexão é Cloud API).
   Áudio gravado no navegador em `webm` não é aceito pela Cloud API; no Firefox a gravação já sai em `ogg/opus`.

Alternativa: a própria Evolution v2 tem a integração `WHATSAPP-BUSINESS` (Cloud API via Evolution). Nesse caso continue usando o provedor *Evolution*; o envio de template usa `/message/sendTemplate`.

## Arquitetura

```
src/lib/whatsapp/
  types.ts       contrato WhatsAppProvider + eventos normalizados
  evolution.ts   cliente Evolution v2 + parser do webhook
  cloud.ts       cliente Cloud API (Graph) + parser do webhook + verificação de assinatura
  index.ts       getProvider(conexão)
src/lib/messaging.ts       envio (salva no banco → envia → atualiza status)
src/lib/inbound.ts         processa webhooks (contato, conversa, mídia, status, opt-out)
src/lib/campaign-runner.ts worker das campanhas (trava otimista, seguro com vários processos)
src/app/api/...            rotas REST
src/app/(app)/...          telas
```

Para adicionar outro provedor (ex.: Z-API, WPPConnect), implemente `WhatsAppProvider`, um parser de webhook e registre em `getProvider`.

### Worker de campanhas

Por padrão (`CAMPAIGN_WORKER_INLINE=true`) ele roda dentro do servidor Next.js. Em produção com mais de uma instância web, defina `false` e rode `npm run worker` em um processo dedicado.

## Scripts

| comando | o que faz |
|---|---|
| `npm run dev` | desenvolvimento |
| `npm run build && npm start` | produção |
| `npm run setup` | migrations + seed (admin, etapas do funil, tags, respostas rápidas) |
| `npm run worker` | worker de campanhas separado |
