// npm run testar:avisos
// Manda uma mensagem de TESTE por e-mail e WhatsApp para os contatos de api/contatos-demo.local.json
// e mostra se saiu de verdade. Serve para conferir o .env antes da demonstração, sem mexer em alunos.
//   npm run testar:avisos -- --hello-world   usa o modelo "hello_world" da Meta (não precisa do "oi" antes)
//   npm run testar:avisos -- --para alguem@gmail.com   manda só para esse e-mail (ou --para 92991234567 para um WhatsApp)
import fs from 'node:fs';
import path from 'node:path';
import { CanalEmail } from '../src/canais/CanalEmail';
import { CanalWhatsApp } from '../src/canais/CanalWhatsApp';
import { env } from '../src/config/env';

const iPara = process.argv.indexOf('--para');
const para = iPara > -1 ? process.argv[iPara + 1] : undefined;
if (iPara > -1 && !para) {
  console.error('Informe o destino: npm run testar:avisos -- --para alguem@gmail.com');
  process.exit(1);
}

const arquivo = path.resolve(__dirname, '../contatos-demo.local.json');
if (!para && !fs.existsSync(arquivo)) {
  console.error('Arquivo api/contatos-demo.local.json não encontrado. Use --para alguem@gmail.com');
  process.exit(1);
}
const helloWorld = process.argv.includes('--hello-world');

const email = new CanalEmail();
const whatsapp = new CanalWhatsApp(helloWorld ? { ...env.whatsapp, template: 'hello_world', idioma: 'en_US' } : env.whatsapp);

console.log(`\nE-mail:   ${email.configurado ? `SMTP ${env.smtp.host}:${env.smtp.port}` : 'NÃO configurado (SMTP_HOST vazio): vai simular'}`);
if (env.smtp.host === 'localhost') console.log('          atenção: localhost é o Mailpit (caixa de teste); não chega ao Gmail/Hotmail');
console.log(`WhatsApp: ${whatsapp.configurado ? `Meta, número ${env.whatsapp.phoneNumberId}${helloWorld ? ' (modelo hello_world)' : ' (texto livre: exige o "oi" do destinatário nas últimas 24h)'}` : 'NÃO configurado (sem WHATSAPP_TOKEN/WHATSAPP_PHONE_NUMBER_ID): vai simular'}\n`);

/** Destinos do teste: só o --para, ou os contatos do arquivo local. */
function destinos(): { nome: string; email?: string; telefone?: string }[] {
  if (para) {
    if (para.includes('@')) return [{ nome: 'Teste', email: para }];
    const d = para.replace(/\D/g, '').replace(/^55/, '');
    return [{ nome: 'Teste', telefone: `+55${d}` }];
  }
  return JSON.parse(fs.readFileSync(arquivo, 'utf8')).responsaveis;
}

(async () => {
  for (const c of destinos()) {
    const msg = {
      nomeDestinatario: c.nome, assunto: 'EscolaAlerta: mensagem de teste', variaveis: [],
      texto: `Olá, ${c.nome.split(' ')[0]}. Esta é uma mensagem de TESTE do EscolaAlerta: se você recebeu, o canal está funcionando.`,
    };
    for (const [nome, canal, destino] of [['E-mail', email, c.email], ['WhatsApp', whatsapp, c.telefone]] as const) {
      if (!destino) continue;
      try {
        const r = await canal.enviar({ ...msg, destino });
        console.log(`  ${nome.padEnd(8)} ${destino.padEnd(28)} ${r === 'ENVIADA' ? '✔ ENVIADA' : '· SIMULADA (não saiu)'}`);
      } catch (err) {
        console.log(`  ${nome.padEnd(8)} ${destino.padEnd(28)} ✘ FALHOU: ${(err as Error).message}`);
      }
    }
  }
  console.log();
})();
