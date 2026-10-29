import { ehDiaUtil, feriadosNacionais, foraDoHorario, motivoNaoUtil } from '../../src/domain/calendario';

// Agendamento só em dias úteis: segunda a sexta, exceto feriados nacionais.
describe('Calendário de dias úteis', () => {
  it('segunda a sexta comuns são dias úteis', () => {
    expect(ehDiaUtil('2026-10-26')).toBe(true); // segunda
    expect(ehDiaUtil('2026-10-30T09:30')).toBe(true); // sexta, com horário
  });

  it('sábado e domingo não são', () => {
    expect(motivoNaoUtil('2026-10-31T10:00')).toBe('sábado');
    expect(motivoNaoUtil('2026-11-01')).toBe('domingo');
  });

  it('feriados nacionais fixos não são, mesmo caindo em dia de semana', () => {
    expect(motivoNaoUtil('2026-11-02')).toBe('feriado (Finados)'); // segunda
    expect(motivoNaoUtil('2026-09-07')).toBe('feriado (Independência do Brasil)');
    expect(motivoNaoUtil('2026-11-20')).toBe('feriado (Dia Nacional de Zumbi e da Consciência Negra)');
  });

  it('Sexta-feira Santa é calculada pela Páscoa de cada ano', () => {
    expect(feriadosNacionais(2026).get('2026-04-03')).toBe('Sexta-feira Santa'); // Páscoa 05/04/2026
    expect(feriadosNacionais(2027).get('2027-03-26')).toBe('Sexta-feira Santa'); // Páscoa 28/03/2027
    expect(ehDiaUtil('2026-04-03')).toBe(false);
  });

  it('horário de atendimento: das 07:00 às 17:00, inclusive', () => {
    expect(foraDoHorario('2026-10-26T07:00')).toBeNull();
    expect(foraDoHorario('2026-10-26T17:00')).toBeNull();
    expect(foraDoHorario('2026-10-26T06:59')).toBe('Escolha um horário entre 07:00 e 17:00.');
    expect(foraDoHorario('2026-10-26T17:01')).toBe('Escolha um horário entre 07:00 e 17:00.');
  });
});
