import { z } from 'zod';
import { Aluno } from '../domain/aluno';
import { TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { organizarPlano } from '../motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from '../motor/MotorDeRegras';
import { recomendarParaFoco } from '../motor/RecomendacoesDeEnsino';
import { IAlertaRepository } from '../repositories/AlertaRepository';
import { IAlunoRepository } from '../repositories/AlunoRepository';
import { IIndicadorRepository } from '../repositories/IndicadorRepository';
import { IUsuarioRepository } from '../repositories/UsuarioRepository';

export const cadastroAlunoSchema = z.object({
  nome: z.string({ error: 'Informe o nome completo do aluno.' }).trim().min(3, 'Informe o nome completo do aluno.').max(120),
  turma: z.string({ error: 'Informe a turma.' }).trim().min(2, 'Informe a turma.').max(40),
  responsavelId: z.string().uuid('Responsável inválido.').nullish(),
});

const uuid = z.string().uuid();

function paraDto(a: Aluno) {
  return {
    id: a.id,
    nome: a.nome,
    turma: a.turma,
    responsavel: a.responsavelId ? { id: a.responsavelId, nome: a.responsavelNome } : null,
  };
}

export class AlunoService {
  constructor(
    private readonly alunos: IAlunoRepository,
    private readonly indicadores: IIndicadorRepository,
    private readonly alertas: IAlertaRepository,
    private readonly usuarios: IUsuarioRepository,
    private readonly motor: MotorDeRegras,
  ) {}

  /**
   * Controle de acesso por registro (ST04 / LGPD): orientador só vê os alunos que cadastrou,
   * responsável só vê os próprios filhos. Responde 404 (e não 403) para não revelar
   * se o aluno de outra conta existe.
   */
  async obterComAcesso(usuario: TokenPayload, alunoId: string): Promise<Aluno> {
    const aluno = uuid.safeParse(alunoId).success ? await this.alunos.buscarPorId(alunoId) : null;
    const temAcesso =
      aluno &&
      ((usuario.perfil === 'ORIENTADOR' && aluno.orientadorId === usuario.sub) ||
        (usuario.perfil === 'RESPONSAVEL' && aluno.responsavelId === usuario.sub));
    if (!aluno || !temAcesso) throw new AppError(404, 'Aluno não encontrado.');
    return aluno;
  }

  /** Lista com o risco calculado na hora (o motor é barato: roda em memória sobre o histórico). */
  async listar(usuario: TokenPayload) {
    const alunos =
      usuario.perfil === 'ORIENTADOR'
        ? await this.alunos.listarPorOrientador(usuario.sub)
        : await this.alunos.listarPorResponsavel(usuario.sub);

    return Promise.all(
      alunos.map(async (a) => {
        const { nivel, causaRaiz, correlacao, resumo } = this.motor.classificar(await this.indicadores.listarPorAluno(a.id));
        const ultimo = await this.alertas.ultimoDoAluno(a.id);
        const plano = ultimo ? await this.alertas.statusDoPlano(ultimo.id) : null;
        // Lista de atenção: risco moderado/alto cujo plano ainda não foi resolvido pela escola.
        const atencao = nivel !== 'BAIXO' && plano?.status !== 'RESOLVIDO';
        return { ...paraDto(a), risco: { nivel, causaRaiz, correlacao, resumo }, planoStatus: plano?.status ?? null, atencao };
      }),
    );
  }

  /** Tudo o que as telas do aluno precisam numa chamada só. */
  async detalhe(usuario: TokenPayload, alunoId: string) {
    const aluno = await this.obterComAcesso(usuario, alunoId);
    const [indicadores, evolucao, feedbacks] = await Promise.all([
      this.indicadores.listarPorAluno(aluno.id),
      this.alertas.listarPorAluno(aluno.id),
      this.alertas.feedbacksDoAluno(aluno.id),
    ]);

    const risco = this.motor.classificar(indicadores);
    const ultimo = evolucao[evolucao.length - 1];
    let planoAtual = null;
    if (ultimo && ultimo.nivel !== 'BAIXO') {
      const { acoes, reforcos } = organizarPlano(await this.alertas.sugestoesDoAlerta(ultimo.id));
      planoAtual = {
        ...(await this.alertas.statusDoPlano(ultimo.id)),
        alertaId: ultimo.id,
        nivel: ultimo.nivel,
        causaRaiz: ultimo.causaRaiz,
        regraOrigem: ultimo.regraOrigem,
        criadoEm: ultimo.criadoEm,
        sugestoes: acoes,  // ações gerais da matriz pedagógica
        reforcos,          // o que reforçar, por disciplina/assunto, com recomendações de ensino
      };
    }

    // Reforço calculado na hora a partir das notas atuais: a escola vê o que reforçar
    // mesmo quando o risco geral ainda é baixo (o plano gravado só existe a partir de moderado).
    const focos = risco.sinais.find((s) => s.causa === 'NOTAS')?.focos ?? [];
    const reforcosAtuais = focos.map((f) => ({ disciplina: f.disciplina, assunto: f.assunto, ...recomendarParaFoco(f) }));

    return {
      ...paraDto(aluno),
      indicadores,
      risco,
      reforcosAtuais,
      planoAtual,
      feedbacks,
      evolucao: evolucao.map(({ id, nivel, causaRaiz, regraOrigem, correlacao, criadoEm }) => ({ id, nivel, causaRaiz, regraOrigem, correlacao, criadoEm })),
    };
  }

  /** RF02: valida antes de qualquer acesso ao banco (UT06). */
  async criar(usuario: TokenPayload, body: unknown) {
    const dados = cadastroAlunoSchema.parse(body);

    if (dados.responsavelId) {
      const responsavel = await this.usuarios.buscarPorId(dados.responsavelId);
      if (!responsavel || responsavel.perfil !== 'RESPONSAVEL') throw new AppError(400, 'Responsável não encontrado.');
    }

    const aluno = await this.alunos.criar({
      nome: dados.nome,
      turma: dados.turma,
      orientadorId: usuario.sub,
      responsavelId: dados.responsavelId ?? null,
    });
    return paraDto(aluno);
  }

  async listarResponsaveis() {
    const lista = await this.usuarios.listarPorPerfil('RESPONSAVEL');
    return lista.map(({ id, nome, email }) => ({ id, nome, email }));
  }
}
