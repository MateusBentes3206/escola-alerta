import { ZodError } from 'zod';
import { Classificacao } from '../../src/domain/risco';
import { TokenPayload } from '../../src/domain/usuario';
import { AlertaGerado, ObservadorDeAlerta, PublicadorDeAlertas } from '../../src/eventos/PublicadorDeAlertas';
import { GeradorDePlanoDeAcao, MATRIZ_DE_SUGESTOES, SUGESTAO_PRAZO_ALTO } from '../../src/motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from '../../src/motor/MotorDeRegras';
import { IAlunoRepository } from '../../src/repositories/AlunoRepository';
import { AlunoService } from '../../src/services/AlunoService';

const classificacao = (c: Partial<Classificacao>): Classificacao => ({
  nivel: 'MODERADO', causaRaiz: 'FALTAS', regraOrigem: 'RegraFaltas', correlacao: false, sinais: [], resumo: '', dataReferencia: '2026-09-30', ...c,
});

describe('UT08 - GeradorDePlanoDeAcao', () => {
  const gerador = new GeradorDePlanoDeAcao();

  it('causa raiz FALTAS -> sugestões de frequência da matriz pedagógica', () => {
    const plano = gerador.gerar(classificacao({ causaRaiz: 'FALTAS' }));
    expect(plano!.causaRaiz).toBe('FALTAS');
    expect(plano!.sugestoes.map((s) => s.texto)).toEqual(MATRIZ_DE_SUGESTOES.FALTAS);
    expect(plano!.sugestoes.every((s) => s.causa === 'FALTAS')).toBe(true); // rastreável (RNF07)
  });

  it('risco alto acrescenta prazo de retorno da escola', () => {
    const plano = gerador.gerar(classificacao({ nivel: 'ALTO', causaRaiz: 'NOTAS' }));
    expect(plano!.sugestoes.at(-1)!.texto).toBe(SUGESTAO_PRAZO_ALTO);
  });

  it('com correlação, o plano cobre também o segundo sinal moderado', () => {
    const plano = gerador.gerar(classificacao({
      nivel: 'ALTO', causaRaiz: 'NOTAS', correlacao: true,
      sinais: [
        { regra: 'RegraNotas', causa: 'NOTAS', regraNegocio: null, peso: 3, evidencias: [], resumo: '' },
        { regra: 'RegraFaltas', causa: 'FALTAS', regraNegocio: null, peso: 2, evidencias: [], resumo: '' },
        { regra: 'RegraOcorrencias', causa: 'OCORRENCIAS', regraNegocio: null, peso: 1, evidencias: [], resumo: '' },
      ],
    }));
    const causas = plano!.sugestoes.map((s) => s.causa);
    expect(causas).toContain('FALTAS');
    expect(causas).not.toContain('OCORRENCIAS'); // sinal fraco não entra
    expect(plano!.sugestoes.map((s) => s.ordem)).toEqual(plano!.sugestoes.map((_, i) => i + 1));
  });

  it('risco baixo não gera plano', () => {
    expect(gerador.gerar(classificacao({ nivel: 'BAIXO' }))).toBeNull();
  });
});

describe('UT06 - Validação do cadastro de aluno', () => {
  const orientador: TokenPayload = { sub: '00000000-0000-4000-8000-000000000001', perfil: 'ORIENTADOR' };
  const criar = jest.fn();
  const repoFalso = { criar } as unknown as IAlunoRepository;
  const service = new AlunoService(repoFalso, {} as never, {} as never, {} as never, MotorDeRegras.padrao());

  beforeEach(() => criar.mockReset());

  it.each([
    ['sem nome', { turma: '7º ano A' }],
    ['nome curto demais', { nome: 'Jo', turma: '7º ano A' }],
    ['sem turma', { nome: 'João da Silva' }],
    ['responsável com id inválido', { nome: 'João da Silva', turma: '7º A', responsavelId: '123' }],
  ])('%s -> erro de validação (400) sem chamar o Repository', async (_caso, body) => {
    await expect(service.criar(orientador, body)).rejects.toBeInstanceOf(ZodError);
    expect(criar).not.toHaveBeenCalled();
  });
});

describe('PublicadorDeAlertas (Observer)', () => {
  const evento = { alerta: { nivel: 'ALTO' } } as AlertaGerado;

  it('notifica todos os observadores inscritos', async () => {
    const chamados: string[] = [];
    const obs = (nome: string): ObservadorDeAlerta => ({ nome, notificar: async () => { chamados.push(nome); } });
    await new PublicadorDeAlertas().inscrever(obs('familia')).inscrever(obs('escola')).publicar(evento);
    expect(chamados).toEqual(['familia', 'escola']);
  });

  it('a falha de um observador não impede os demais', async () => {
    const erro = jest.spyOn(console, 'error').mockImplementation(() => {});
    const ok = jest.fn().mockResolvedValue(undefined);
    await new PublicadorDeAlertas()
      .inscrever({ nome: 'quebrado', notificar: async () => { throw new Error('canal fora do ar'); } })
      .inscrever({ nome: 'ok', notificar: ok })
      .publicar(evento);
    expect(ok).toHaveBeenCalled();
    erro.mockRestore();
  });
});
