import 'dotenv/config';

function obrigatoria(nome: string): string {
  const valor = process.env[nome];
  if (!valor) throw new Error(`Variável de ambiente ${nome} não definida. Copie .env.example para .env.`);
  return valor;
}

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  isTest,
  port: Number(process.env.PORT ?? 3333),
  // Em teste usa sempre o banco isolado: nunca apaga dados do banco de desenvolvimento.
  databaseUrl: isTest ? obrigatoria('DATABASE_URL_TEST') : obrigatoria('DATABASE_URL'),
  jwtSecret: obrigatoria('JWT_SECRET'),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '8h',
  frontUrls: (process.env.FRONT_URL ?? '').split(',').map((s) => s.trim()).filter(Boolean),
  // Link do sistema usado nas mensagens externas (e-mail, WhatsApp).
  appUrl: process.env.APP_URL ?? 'http://localhost:5500',

  // E-mail: sem SMTP_HOST, os e-mails são só registrados (modo simulação). Em teste, sempre simulação.
  smtp: {
    host: isTest ? '' : (process.env.SMTP_HOST ?? ''),
    port: Number(process.env.SMTP_PORT ?? 1025),
    user: process.env.SMTP_USER ?? '',
    pass: process.env.SMTP_PASS ?? '',
    remetente: process.env.EMAIL_REMETENTE ?? 'EscolaAlerta <avisos@escolaalerta.local>',
  },

  // WhatsApp Business (API oficial da Meta). Sem token, as mensagens são só registradas (simulação).
  whatsapp: {
    token: isTest ? '' : (process.env.WHATSAPP_TOKEN ?? ''),
    phoneNumberId: process.env.WHATSAPP_PHONE_NUMBER_ID ?? '',
    template: process.env.WHATSAPP_TEMPLATE ?? '',      // nome do modelo aprovado pela Meta (vazio = texto simples)
    idioma: process.env.WHATSAPP_TEMPLATE_LANG ?? 'pt_BR',
    apiVersion: process.env.WHATSAPP_API_VERSION ?? 'v21.0',
  },
};
