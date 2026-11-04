// npm run testar:avisos
// Manda um e-mail de TESTE para os contatos de api/contatos-demo.local.json e mostra se saiu de verdade.
// Serve para conferir o SMTP do .env antes da demonstração, sem mexer em alunos.
//   npm run testar:avisos -- --para alguem@gmail.com   manda só para esse e-mail
import fs from 'node:fs';
import path from 'node:path';
import { CanalEmail } from '../src/canais/CanalEmail';
import { env } from '../src/config/env';

const iPara = process.argv.indexOf('--para');
const para = iPara > -1 ? process.argv[iPara + 1] : undefined;
if (iPara > -1 && !para?.includes('@')) {
  console.error('Informe o e-mail: npm run testar:avisos -- --para alguem@gmail.com');
  process.exit(1);
}

const arquivo = path.resolve(__dirname, '../contatos-demo.local.json');
if (!para && !fs.existsSync(arquivo)) {
  console.error('Arquivo api/contatos-demo.local.json não encontrado. Use --para alguem@gmail.com');
  process.exit(1);
}
const destinos: { nome: string; email: string }[] = para
  ? [{ nome: 'Teste', email: para }]
  : JSON.parse(fs.readFileSync(arquivo, 'utf8')).responsaveis;

const email = new CanalEmail();
console.log(`\nE-mail: ${email.configurado ? `SMTP ${env.smtp.host}:${env.smtp.port}` : 'NÃO configurado (SMTP_HOST vazio): vai simular'}`);
if (env.smtp.host === 'localhost') console.log('        atenção: localhost é o Mailpit (caixa de teste em http://localhost:8025); não chega ao Gmail/Hotmail');
console.log();

(async () => {
  for (const d of destinos) {
    try {
      const r = await email.enviar({
        destino: d.email, nomeDestinatario: d.nome, assunto: 'EscolaAlerta: e-mail de teste',
        texto: `Olá, ${d.nome.split(' ')[0]}. Este é um e-mail de TESTE do EscolaAlerta: se você recebeu, o envio está funcionando.`,
      });
      console.log(`  ${d.email.padEnd(32)} ${r === 'ENVIADA' ? '✔ ENVIADA' : '· SIMULADA (não saiu)'}`);
    } catch (err) {
      console.log(`  ${d.email.padEnd(32)} ✘ FALHOU: ${(err as Error).message}`);
    }
  }
  console.log();
})();
