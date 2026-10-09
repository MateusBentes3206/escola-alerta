// Datas tratadas como texto 'AAAA-MM-DD' e calculadas em UTC: sem surpresas de fuso horário.

const DIA_MS = 24 * 60 * 60 * 1000;

function paraUTC(iso: string): number {
  const [a, m, d] = iso.split('-').map(Number);
  return Date.UTC(a, m - 1, d);
}

export function paraIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

/** Data de hoje no fuso local, em 'AAAA-MM-DD'. */
export function hojeIso(): string {
  const agora = new Date();
  return paraIso(Date.UTC(agora.getFullYear(), agora.getMonth(), agora.getDate()));
}

export function somarDias(iso: string, dias: number): string {
  return paraIso(paraUTC(iso) + dias * DIA_MS);
}

/** true se a data está entre (referência - janela) e a referência, inclusive. */
export function dentroDaJanela(iso: string, referencia: string, janelaDias: number): boolean {
  const diff = (paraUTC(referencia) - paraUTC(iso)) / DIA_MS;
  return diff >= 0 && diff < janelaDias;
}

/** Próximo dia letivo (pula sábado e domingo). */
export function proximoDiaLetivo(iso: string): string {
  let ms = paraUTC(iso) + DIA_MS;
  while ([0, 6].includes(new Date(ms).getUTCDay())) ms += DIA_MS;
  return paraIso(ms);
}

/** Maior sequência de dias letivos consecutivos presentes na lista. */
export function maiorSequenciaLetiva(datas: string[]): number {
  const unicas = [...new Set(datas)].sort();
  let maior = 0;
  let atual = 0;
  for (let i = 0; i < unicas.length; i++) {
    atual = i > 0 && proximoDiaLetivo(unicas[i - 1]) === unicas[i] ? atual + 1 : 1;
    maior = Math.max(maior, atual);
  }
  return maior;
}

export function formatarDataBr(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${d}/${m}`;
}
