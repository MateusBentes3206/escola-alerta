import { FocoDeReforco } from '../../src/domain/risco';
import { GeradorDePlanoDeAcao, organizarPlano, SUGESTAO_PRAZO_ALTO } from '../../src/motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from '../../src/motor/MotorDeRegras';
import { areaDaDisciplina, recomendarParaFoco } from '../../src/motor/RecomendacoesDeEnsino';
import { RegraNotas } from '../../src/motor/regras/RegraNotas';
import { diasAntes, nota, REF } from '../helpers/indicadores';

const foco = (f: Partial<FocoDeReforco>): FocoDeReforco => ({
  disciplina: 'Matemática', assunto: 'Frações', nota: 5, periodo: '3º bimestre', notaAnterior: null, abaixoDoLimite: true, ...f,
});

describe('RegraNotas aponta o que reforçar', () => {
  it('cada disciplina abaixo de 6 ou em queda vira um foco com o assunto avaliado, pior nota primeiro', () => {
    const sinal = new RegraNotas().avaliar([
      nota('Português', 5.8, '3º bimestre', diasAntes(5), 'Concordância verbal'),
      nota('Matemática', 7.0, '2º bimestre', diasAntes(60), 'Frações'),
      nota('Matemática', 5.2, '3º bimestre', diasAntes(5), 'Equações do 1º grau'),
      nota('Ciências', 9.0, '3º bimestre', diasAntes(5), 'Células'),
    ], REF)!;
    expect(sinal.focos!.map((f) => [f.disciplina, f.assunto, f.notaAnterior])).toEqual([
      ['Matemática', 'Equações do 1º grau', 7.0],
      ['Português', 'Concordância verbal', null],
    ]);
    expect(sinal.evidencias).toContain('Matemática (Equações do 1º grau): nota 5,2 no 3º bimestre (abaixo de 6)');
  });
});

describe('Recomendações de ensino por disciplina e assunto', () => {
  it.each([
    ['Matemática', 'MATEMATICA'], ['Língua Portuguesa', 'LINGUAGENS'], ['Inglês', 'LINGUAGENS'],
    ['Ciências', 'CIENCIAS'], ['História', 'HUMANAS'], ['Geografia', 'HUMANAS'], ['Robótica', 'GERAL'],
  ])('%s -> área %s', (disciplina, area) => {
    expect(areaDaDisciplina(disciplina)).toBe(area);
  });

  it('usa o assunto avaliado no texto das recomendações', () => {
    const r = recomendarParaFoco(foco({ assunto: 'Frações' }));
    expect(r.resumo).toBe('Reforçar Frações em Matemática (nota 5,0 no 3º bimestre).');
    expect(r.ensino).toEqual([
      'Retomar Frações com exemplos resolvidos passo a passo antes de propor novos exercícios.',
      'Aplicar uma lista graduada sobre Frações, do mais simples ao mais complexo, com correção comentada.',
    ]);
    expect(r.familia[0]).toMatch(/revisar Frações/);
  });

  it('nota muito baixa (< 4) recomenda primeiro verificar os pré-requisitos', () => {
    expect(recomendarParaFoco(foco({ nota: 3 })).ensino[0]).toMatch(/pré-requisitos de Frações/);
  });

  it('queda entre bimestres recomenda comparar com a avaliação anterior', () => {
    const r = recomendarParaFoco(foco({ nota: 5.2, notaAnterior: 7 }));
    expect(r.resumo).toContain('caiu de 7,0 para 5,2');
    expect(r.ensino[0]).toMatch(/Comparar com a avaliação anterior/);
  });

  it('nota antiga sem assunto registrado ainda gera recomendação', () => {
    expect(recomendarParaFoco(foco({ assunto: null })).resumo).toBe('Reforçar o conteúdo do 3º bimestre em Matemática (nota 5,0 no 3º bimestre).');
  });
});

describe('Plano de ação com reforço por assunto', () => {
  const motor = MotorDeRegras.padrao();
  const gerador = new GeradorDePlanoDeAcao();
  const historico = [
    nota('Matemática', 5.2, '3º bimestre', diasAntes(5), 'Equações do 1º grau'),
    nota('História', 4.5, '3º bimestre', diasAntes(5), 'Brasil Colônia'),
  ];

  it('inclui, para cada assunto, o reforço, as recomendações de ensino e a orientação à família', () => {
    const plano = gerador.gerar(motor.classificar(historico, REF))!;
    const { acoes, reforcos } = organizarPlano(plano.sugestoes);

    expect(acoes.map((a) => a.texto)).toContain(SUGESTAO_PRAZO_ALTO);
    expect(reforcos.map((r) => r.assunto)).toEqual(['Brasil Colônia', 'Equações do 1º grau']);
    expect(reforcos[0].ensino.join(' ')).toMatch(/linha do tempo/);     // Humanas
    expect(reforcos[1].ensino.join(' ')).toMatch(/exemplos resolvidos/); // Matemática
    expect(reforcos.every((r) => r.familia.length === 1)).toBe(true);
  });

  it('o prazo de risco alto continua sendo o último item do plano', () => {
    const plano = gerador.gerar(motor.classificar(historico, REF))!;
    expect(plano.sugestoes.at(-1)!.texto).toBe(SUGESTAO_PRAZO_ALTO);
  });
});
