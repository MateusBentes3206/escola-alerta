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
};
