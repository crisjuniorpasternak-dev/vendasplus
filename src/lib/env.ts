/** Leitura centralizada das variáveis de ambiente. Nada de credencial no código. */
export const env = {
  appUrl: process.env.APP_URL ?? "http://localhost:3000",
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
  uploadDir: process.env.UPLOAD_DIR ?? "./uploads",
  evolution: {
    url: (process.env.EVOLUTION_API_URL ?? "").replace(/\/+$/, ""),
    apiKey: process.env.EVOLUTION_API_KEY ?? "",
    instance: process.env.EVOLUTION_INSTANCE ?? "",
  },
  cloud: {
    token: process.env.WHATSAPP_CLOUD_TOKEN ?? "",
    phoneNumberId: process.env.WHATSAPP_CLOUD_PHONE_NUMBER_ID ?? "",
    verifyToken: process.env.WHATSAPP_CLOUD_VERIFY_TOKEN ?? "",
    appSecret: process.env.WHATSAPP_CLOUD_APP_SECRET ?? "",
    apiVersion: process.env.WHATSAPP_CLOUD_API_VERSION ?? "v21.0",
  },
};
