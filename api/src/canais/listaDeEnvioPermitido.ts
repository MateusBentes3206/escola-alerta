import fs from 'node:fs';
import path from 'node:path';

/**
 * Trava de segurança da demonstração: os responsáveis fictícios do seed usam domínios reais
 * (ex.: @email.com), então com um SMTP de verdade o aviso poderia chegar a um desconhecido.
 * Se existir api/contatos-demo.local.json (só na máquina da demonstração), e-mail de verdade sai
 * apenas para os endereços desse arquivo e os de EMAIL_SOMENTE_PARA; os demais ficam "simulados".
 * Em produção (sem o arquivo e sem a variável), não há restrição.
 */
export function enderecosPermitidos(): Set<string> | null {
  const lista = new Set<string>();
  for (const e of (process.env.EMAIL_SOMENTE_PARA ?? '').split(',')) if (e.trim()) lista.add(e.trim().toLowerCase());

  const arquivo = path.resolve(__dirname, '../../contatos-demo.local.json');
  if (fs.existsSync(arquivo)) {
    const { responsaveis = [] } = JSON.parse(fs.readFileSync(arquivo, 'utf8')) as { responsaveis?: { email: string }[] };
    for (const r of responsaveis) lista.add(r.email.toLowerCase());
  }
  return lista.size > 0 ? lista : null;
}
