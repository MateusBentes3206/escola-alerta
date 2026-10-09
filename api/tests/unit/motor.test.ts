import { maiorSequenciaLetiva } from '../../src/motor/datas';
import { MotorDeRegras } from '../../src/motor/MotorDeRegras';
import { PARAMETROS_PADRAO } from '../../src/motor/parametros';
import { RegraDeRisco } from '../../src/motor/RegraDeRisco';
import { RegraFaltas } from '../../src/motor/regras/RegraFaltas';
import { RegraNotas } from '../../src/motor/regras/RegraNotas';
import { RegraOcorrencias } from '../../src/motor/regras/RegraOcorrencias';
import { RegraSaidas } from '../../src/motor/regras/RegraSaidas';
import { diasAntes, falta, faltasEspacadas, nota, ocorrencia, REF, saida } from '../helpers/indicadores';

// Cada estratégia é testada isolada, sem banco (benefício direto do padrão Strategy).

describe('UT01 - RegraNotas.avaliar()', () => {
  const regra = new RegraNotas();

  it('2 disciplinas abaixo de 6 -> risco alto (peso 3)', () => {
    const sinal = regra.avaliar([nota('Matemática', 5.2), nota('Português', 5.8)], REF);
    expect(sinal).toMatchObject({ causa: 'NOTAS', peso: 3, regra: 'RegraNotas' });
    expect(sinal!.evidencias.join(' ')).toContain('Matemática');
  });

  it('considera só a nota mais recente de cada disciplina (recuperou -> sem risco)', () => {
    const historico = [nota('Matemática', 4.0, '2º bimestre', diasAntes(60)), nota('Matemática', 7.5, '3º bimestre')];
    expect(regra.avaliar(historico, REF)).toBeNull();
  });

  it('1 disciplina abaixo e em queda forte -> peso 2', () => {
    const historico = [nota('Matemática', 7.5, '2º bimestre', diasAntes(60)), nota('Matemática', 5.5, '3º bimestre')];
    const sinal = regra.avaliar(historico, REF);
    expect(sinal!.peso).toBe(2);
    expect(sinal!.evidencias.some((e) => e.includes('caiu de 7,5 para 5,5'))).toBe(true);
  });

  it('1 disciplina com nota muito baixa (< 4) -> peso 2, mesmo sem queda', () => {
    expect(regra.avaliar([nota('Matemática', 3.0), nota('Português', 7.5)], REF)!.peso).toBe(2);
  });

  it('queda forte mesmo acima da média já é sinal de atenção (tendência)', () => {
    const historico = [nota('História', 9.0, '2º bimestre', diasAntes(60)), nota('História', 7.0, '3º bimestre')];
    expect(regra.avaliar(historico, REF)!.peso).toBe(1);
  });

  it('notas boas -> sem sinal', () => {
    expect(regra.avaliar([nota('Ciências', 8.4)], REF)).toBeNull();
  });
});

describe('UT02 - RegraFaltas.avaliar()', () => {
  const regra = new RegraFaltas();

  it('5 faltas sem justificativa na janela -> risco alto (peso 3)', () => {
    expect(regra.avaliar(faltasEspacadas(5), REF)!.peso).toBe(3);
  });

  it('3 faltas espaçadas -> moderado (peso 2)', () => {
    expect(regra.avaliar(faltasEspacadas(3), REF)!.peso).toBe(2);
  });

  it('3 dias letivos seguidos sem justificativa -> alto, mesmo com só 3 faltas', () => {
    // 2026-09-28 (seg), 29 (ter), 30 (qua)
    const sinal = regra.avaliar([falta('2026-09-28'), falta('2026-09-29'), falta('2026-09-30')], REF);
    expect(sinal!.peso).toBe(3);
    expect(sinal!.evidencias.join(' ')).toContain('3 dias letivos seguidos');
  });

  it('sexta + segunda contam como dias letivos seguidos (fim de semana não quebra a sequência)', () => {
    expect(maiorSequenciaLetiva(['2026-09-25', '2026-09-28', '2026-09-29'])).toBe(3);
  });

  it('faltas justificadas não contam', () => {
    const historico = [falta(diasAntes(1), true), falta(diasAntes(2), true), falta(diasAntes(3), true)];
    expect(regra.avaliar(historico, REF)).toBeNull();
  });

  it('correlação temporal: faltas fora da janela de 30 dias não contam', () => {
    const antigas = [falta(diasAntes(40)), falta(diasAntes(45)), falta(diasAntes(50)), falta(diasAntes(55)), falta(diasAntes(60))];
    expect(regra.avaliar(antigas, REF)).toBeNull();
  });
});

describe('UT03 - RegraOcorrencias.avaliar()', () => {
  const regra = new RegraOcorrencias();

  it('3 ocorrências leves no mês -> risco alto (peso 3)', () => {
    expect(regra.avaliar([ocorrencia('leve'), ocorrencia('leve'), ocorrencia('leve')], REF)!.peso).toBe(3);
  });

  it('1 ocorrência grave equivale a 3 leves -> peso 3', () => {
    expect(regra.avaliar([ocorrencia('grave')], REF)!.peso).toBe(3);
  });

  it('1 moderada -> peso 2; 1 leve -> peso 1', () => {
    expect(regra.avaliar([ocorrencia('moderada')], REF)!.peso).toBe(2);
    expect(regra.avaliar([ocorrencia('leve')], REF)!.peso).toBe(1);
  });

  it('ocorrências de mais de 30 dias atrás não contam', () => {
    expect(regra.avaliar([ocorrencia('grave', diasAntes(31))], REF)).toBeNull();
  });
});

describe('RegraSaidas.avaliar() (RF06)', () => {
  const regra = new RegraSaidas();

  it('1 saída não é sinal; 2 = atenção; 4 = moderado; nunca alto sozinha', () => {
    expect(regra.avaliar([saida(diasAntes(1))], REF)).toBeNull();
    expect(regra.avaliar([saida(diasAntes(1)), saida(diasAntes(2))], REF)!.peso).toBe(1);
    const seis = Array.from({ length: 6 }, (_, i) => saida(diasAntes(i + 1)));
    expect(regra.avaliar(seis, REF)!.peso).toBe(2);
  });
});

describe('UT04 - MotorDeRegras.classificar() com múltiplos sinais', () => {
  const motor = MotorDeRegras.padrao();

  it('caso Rafael (protótipo): notas peso 3 + faltas peso 2 + 1 ocorrência -> ALTO, causa NOTAS', () => {
    const c = motor.classificar([nota('Matemática', 5.2), nota('Português', 5.8), ...faltasEspacadas(3), ocorrencia('leve')], REF);
    expect(c).toMatchObject({ nivel: 'ALTO', causaRaiz: 'NOTAS', regraOrigem: 'RegraNotas', correlacao: true });
    expect(c.sinais).toHaveLength(3);
  });

  it('correlação: dois sinais moderados juntos (faltas 2 + ocorrência 2) viram ALTO', () => {
    const c = motor.classificar([...faltasEspacadas(3), ocorrencia('moderada')], REF);
    expect(c.nivel).toBe('ALTO');
    expect(c.correlacao).toBe(true);
  });

  it('correlação fraca: três sinais de peso 1 juntos viram MODERADO', () => {
    const c = motor.classificar([nota('Matemática', 5.5), falta(diasAntes(2)), ocorrencia('leve')], REF);
    expect(c.nivel).toBe('MODERADO');
    expect(c.correlacao).toBe(true);
  });

  it('um sinal moderado sozinho -> MODERADO, sem correlação', () => {
    const c = motor.classificar(faltasEspacadas(3), REF);
    expect(c).toMatchObject({ nivel: 'MODERADO', causaRaiz: 'FALTAS', correlacao: false });
  });

  it('empate de peso: vale a ordem das regras (ocorrências antes de faltas), como no protótipo', () => {
    const c = motor.classificar([falta(diasAntes(2)), ocorrencia('leve')], REF);
    expect(c.causaRaiz).toBe('OCORRENCIAS');
  });

  it('explicabilidade (RNF07): cada sinal traz a regra e evidências legíveis', () => {
    const c = motor.classificar(faltasEspacadas(5), REF);
    expect(c.sinais[0].regra).toBe('RegraFaltas');
    expect(c.sinais[0].evidencias[0]).toMatch(/5 falta\(s\) sem justificativa/);
  });

  it('extensível: o motor aceita uma regra nova sem nenhuma alteração (Strategy)', () => {
    const regraNova: RegraDeRisco = {
      nome: 'RegraTeste', causa: 'SAIDAS',
      avaliar: () => ({ regra: 'RegraTeste', causa: 'SAIDAS', peso: 3, evidencias: ['regra injetada'] }),
    };
    const c = new MotorDeRegras([regraNova]).classificar([], REF);
    expect(c).toMatchObject({ nivel: 'ALTO', regraOrigem: 'RegraTeste' });
  });

  it('parâmetros configuráveis: com limite de faltas menor, 2 faltas já são moderado', () => {
    const p = { ...PARAMETROS_PADRAO, faltas: { ...PARAMETROS_PADRAO.faltas, moderado: 2 } };
    expect(MotorDeRegras.padrao(p).classificar(faltasEspacadas(2), REF).nivel).toBe('MODERADO');
  });
});

describe('UT05 - MotorDeRegras.classificar() sem sinais', () => {
  it('histórico vazio -> BAIXO, sem causa', () => {
    expect(MotorDeRegras.padrao().classificar([], REF)).toMatchObject({ nivel: 'BAIXO', causaRaiz: null, sinais: [] });
  });

  it('só indicadores positivos -> BAIXO', () => {
    const c = MotorDeRegras.padrao().classificar([nota('Ciências', 8.4), falta(diasAntes(1), true), saida(diasAntes(2))], REF);
    expect(c.nivel).toBe('BAIXO');
    expect(c.causaRaiz).toBeNull();
  });
});
