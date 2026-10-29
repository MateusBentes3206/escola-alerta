// Calendário de dias úteis para o agendamento de conversas família-escola.
// Dia útil = segunda a sexta, exceto feriados nacionais (Lei 662/1949 e alterações).
// Feriados estaduais e municipais não entram: variam por escola.

/** Domingo de Páscoa (algoritmo de Meeus/Jones/Butcher), em UTC. */
function pascoa(ano: number): Date {
  const a = ano % 19;
  const b = Math.floor(ano / 100);
  const c = ano % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mes = Math.floor((h + l - 7 * m + 114) / 31);
  const dia = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(ano, mes - 1, dia));
}

const FIXOS: [string, string][] = [
  ['01-01', 'Confraternização Universal'],
  ['04-21', 'Tiradentes'],
  ['05-01', 'Dia do Trabalho'],
  ['09-07', 'Independência do Brasil'],
  ['10-12', 'Nossa Senhora Aparecida'],
  ['11-02', 'Finados'],
  ['11-15', 'Proclamação da República'],
  ['11-20', 'Dia Nacional de Zumbi e da Consciência Negra'],
  ['12-25', 'Natal'],
];

/** Feriados nacionais do ano: 'AAAA-MM-DD' -> nome. */
export function feriadosNacionais(ano: number): Map<string, string> {
  const mapa = new Map(FIXOS.map(([md, nome]) => [`${ano}-${md}`, nome]));
  const sextaSanta = pascoa(ano);
  sextaSanta.setUTCDate(sextaSanta.getUTCDate() - 2);
  mapa.set(sextaSanta.toISOString().slice(0, 10), 'Sexta-feira Santa');
  return mapa;
}

/** Por que a data não é dia útil, ou null se for. Aceita 'AAAA-MM-DD' ou 'AAAA-MM-DDTHH:MM'. */
export function motivoNaoUtil(dataOuHorario: string): string | null {
  const data = dataOuHorario.slice(0, 10);
  const [a, m, d] = data.split('-').map(Number);
  const diaSemana = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  if (diaSemana === 0) return 'domingo';
  if (diaSemana === 6) return 'sábado';
  const feriado = feriadosNacionais(a).get(data);
  return feriado ? `feriado (${feriado})` : null;
}

export const ehDiaUtil = (dataOuHorario: string) => motivoNaoUtil(dataOuHorario) === null;

/** Janela de atendimento da escola para início das conversas (inclusive). Ajuste aqui se a escola usar outro horário. */
export const HORARIO_ATENDIMENTO = { inicio: '07:00', fim: '17:00' };

/** Mensagem de erro se o horário ('AAAA-MM-DDTHH:MM') estiver fora do atendimento, ou null. */
export function foraDoHorario(horario: string): string | null {
  const hora = horario.slice(11, 16);
  const { inicio, fim } = HORARIO_ATENDIMENTO;
  return hora < inicio || hora > fim ? `Escolha um horário entre ${inicio} e ${fim}.` : null;
}
