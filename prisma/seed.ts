import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/auth-hash";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL ?? "admin@zapdesk.local").toLowerCase();
  const password = process.env.ADMIN_PASSWORD ?? "admin123";
  if (!(await prisma.user.findUnique({ where: { email } }))) {
    await prisma.user.create({ data: { name: process.env.ADMIN_NAME ?? "Administrador", email, role: "ADMIN", passwordHash: hashPassword(password) } });
    console.log(`Usuário admin criado: ${email} / ${password}  (troque a senha depois!)`);
  }
  if ((await prisma.pipelineStage.count()) === 0) {
    const stages = ["Novo lead", "Em contato", "Proposta enviada", "Negociação", "Fechamento"];
    const colors = ["#94a3b8", "#3b82f6", "#8b5cf6", "#f59e0b", "#22c55e"];
    await prisma.pipelineStage.createMany({ data: stages.map((name, order) => ({ name, order, color: colors[order] })) });
  }
  if ((await prisma.tag.count()) === 0) {
    await prisma.tag.createMany({ data: [
      { name: "Lead quente", color: "#ef4444" },
      { name: "Cliente", color: "#22c55e" },
      { name: "Aguardando retorno", color: "#f59e0b" },
    ] });
  }
  if ((await prisma.quickReply.count()) === 0) {
    await prisma.quickReply.createMany({ data: [
      { shortcut: "ola", body: "Olá! 👋 Tudo bem? Como posso te ajudar?" },
      { shortcut: "horario", body: "Nosso horário de atendimento é de segunda a sexta, das 8h às 18h." },
      { shortcut: "obrigado", body: "Obrigado pelo contato! Qualquer dúvida é só chamar. ✅" },
    ] });
  }
  const instance = process.env.EVOLUTION_INSTANCE;
  if (instance && !(await prisma.connection.findFirst({ where: { instanceName: instance } }))) {
    await prisma.connection.create({ data: { name: instance, instanceName: instance, provider: "EVOLUTION", isDefault: (await prisma.connection.count()) === 0 } });
  }
}

main().finally(() => prisma.$disconnect());
