// LGPD: telas mostram contatos só parcialmente (o suficiente para a escola conferir).

/** "+5592900000001" -> "(92) 9****-0001" */
export function mascararTelefone(t: string): string {
  const d = t.replace(/\D/g, '').replace(/^55/, '');
  return `(${d.slice(0, 2)}) ${d.slice(2, 3)}****-${d.slice(-4)}`;
}

/** "beatriz.lima@email.com" -> "b***********@email.com" */
export function mascararEmail(e: string): string {
  const [usuario, dominio] = e.split('@');
  return `${usuario[0]}${'*'.repeat(Math.max(usuario.length - 1, 3))}@${dominio}`;
}

export function mascararContato(contato: string | null): string | null {
  if (!contato) return null;
  return contato.includes('@') ? mascararEmail(contato) : mascararTelefone(contato);
}
