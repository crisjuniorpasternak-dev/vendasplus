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
cp .env.example .env        # preencha DATABASE_URL (o resto é opcional)
npm install
npm run setup               # cria as tabelas (o admin é criado no primeiro acesso)
npm run dev                 # http://localhost:3000
```

Com Docker (sobe Postgres + app):

```bash
cp .env.example .env
docker compose up -d --build
```

## Deploy na Vercel

1. Importe o repositório na Vercel e conecte em **Storage** um banco **Postgres (Neon)** e um **Blob Store**. Nenhuma outra variável é obrigatória.
2. O build (`npm run vercel-build`) aplica as migrations no schema `vendasplus` do banco (não mexe em tabelas que já existam em `public`; mude com `DB_SCHEMA`).
3. No primeiro acesso ao site aparece a tela **Criar conta de administrador**.
4. Em **Conexões**: informe URL e API key da Evolution (ficam no banco; se `EVOLUTION_API_URL`/`EVOLUTION_API_KEY` existirem no ambiente, eles têm prioridade), cadastre a instância, conecte pelo QR e clique em *Configurar webhook*. O segredo do webhook é gerado automaticamente.
5. **Campanhas:** a mesma tela mostra a URL do agendador (`/api/cron/campaigns?secret=...`, segredo gerado automaticamente). Cadastre-a para rodar a cada minuto em um agendador externo gratuito (ex.: cron-job.org). No plano Hobby a Vercel não permite cron a cada minuto; no Pro dá para usar `crons` no `vercel.json`.

Variáveis opcionais: `APP_URL` (senão usa o domínio de produção da Vercel), `WEBHOOK_SECRET`, `CRON_SECRET`, `ADMIN_EMAIL`/`ADMIN_PASSWORD` (cria o admin no build), `APP_TIMEZONE` (padrão `America/Sao_Paulo`, usado na janela de envio).

Limites da Vercel: anexos até ~4,5 MB por requisição; a interface atualiza por consulta periódica (3–4 s).

## Conectando a Evolution API

1. Informe URL e API key na tela **Conexões** (ou no `.env`: `EVOLUTION_API_URL`, `EVOLUTION_API_KEY`, `EVOLUTION_INSTANCE`). Nunca no código.
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
