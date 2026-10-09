import { z } from 'zod';
import { DadosIndicador, Indicador, TipoIndicador } from '../domain/indicador';
import { TokenPayload } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { hojeIso } from '../motor/datas';
import { IIndicadorRepository } from '../repositories/IndicadorRepository';
import { AlunoService } from './AlunoService';
import { ServicoDeRisco } from './ServicoDeRisco';

const dataIso = z
  .string({ error: 'Informe a data.' })
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Data no formato AAAA-MM-DD.')
  .refine((d) => !Number.isNaN(Date.parse(d)), 'Data inválida.')
  .refine((d) => d <= hojeIso(), 'A data não pode estar no futuro.');

// Campo de texto com a mesma mensagem para "não enviado" e "vazio".
const texto = (max: number) => z.string().trim().max(max);
const obrigatorio = (max: number, mensagem: string) => z.string({ error: mensagem }).trim().min(1, mensagem).max(max);

// Um schema por tipo de indicador; o campo "tipo" escolhe qual validar (RF03 a RF06).
export const indicadorSchema = z.discriminatedUnion('tipo', [
  z.object({
    tipo: z.literal('NOTA'),
    disciplina: obrigatorio(80, 'Informe a disciplina.'),
    valor: z.number({ error: 'Informe a nota.' }).min(0, 'A nota deve estar entre 0 e 10.').max(10, 'A nota deve estar entre 0 e 10.'),
    periodo: texto(20).nullish(),
    assunto: obrigatorio(160, 'Informe o assunto avaliado.'),
    data: dataIso.optional(),
  }),
  z.object({
    tipo: z.literal('FALTA'),
    data: dataIso,
    justificada: z.boolean().default(false),
    descricao: texto(500).nullish(), // comprovante / observação
  }),
  z.object({
    tipo: z.literal('OCORRENCIA'),
    descricao: obrigatorio(1000, 'Descreva a ocorrência.'),
    gravidade: z.enum(['leve', 'moderada', 'grave'], { error: 'Gravidade inválida.' }),
    data: dataIso.optional(),
  }),
  z.object({
    tipo: z.literal('SAIDA'),
    data: dataIso,
    horario: z.string().regex(/^\d{2}:\d{2}$/, 'Horário no formato HH:MM.').nullish(),
    descricao: obrigatorio(500, 'Informe o motivo da saída.'),
  }),
], { error: 'Tipo de indicador inválido.' });

/** Converte a entrada validada para o formato completo, com null nos campos que não são do tipo. */
function normalizar(entrada: z.infer<typeof indicadorSchema>): DadosIndicador {
  const base: DadosIndicador = {
    tipo: entrada.tipo, data: entrada.data ?? hojeIso(),
    disciplina: null, valor: null, periodo: null, assunto: null, justificada: null, gravidade: null, horario: null, descricao: null,
  };
  switch (entrada.tipo) {
    case 'NOTA': return { ...base, disciplina: entrada.disciplina, valor: entrada.valor, periodo: entrada.periodo ?? null, assunto: entrada.assunto };
    case 'FALTA': return { ...base, justificada: entrada.justificada, descricao: entrada.descricao || null };
    case 'OCORRENCIA': return { ...base, descricao: entrada.descricao, gravidade: entrada.gravidade };
    case 'SAIDA': return { ...base, horario: entrada.horario || null, descricao: entrada.descricao };
  }
}

const uuid = z.string().uuid();
const TIPOS: TipoIndicador[] = ['NOTA', 'FALTA', 'OCORRENCIA', 'SAIDA'];

/** Todo registro, edição ou exclusão dispara a reavaliação do risco do aluno. */
export class IndicadorService {
  constructor(
    private readonly indicadores: IIndicadorRepository,
    private readonly alunos: AlunoService,
    private readonly risco: ServicoDeRisco,
  ) {}

  async listar(usuario: TokenPayload, alunoId: string, tipo?: string) {
    const aluno = await this.alunos.obterComAcesso(usuario, alunoId);
    const filtro = tipo?.toUpperCase() as TipoIndicador | undefined;
    if (filtro && !TIPOS.includes(filtro)) throw new AppError(400, 'Tipo de indicador inválido.');
    return this.indicadores.listarPorAluno(aluno.id, filtro);
  }

  async registrar(usuario: TokenPayload, alunoId: string, body: unknown) {
    const aluno = await this.alunos.obterComAcesso(usuario, alunoId);
    const indicador = await this.indicadores.criar(aluno.id, normalizar(indicadorSchema.parse(body)), usuario.sub);
    return { indicador, ...(await this.resultadoDoRisco(aluno.id)) };
  }

  async atualizar(usuario: TokenPayload, indicadorId: string, body: unknown) {
    const atual = await this.obterComAcesso(usuario, indicadorId);
    const dados = normalizar(indicadorSchema.parse(body));
    if (dados.tipo !== atual.tipo) throw new AppError(400, 'Não é possível mudar o tipo de um indicador. Exclua e registre de novo.');
    const indicador = await this.indicadores.atualizar(atual.id, dados);
    return { indicador, ...(await this.resultadoDoRisco(atual.alunoId)) };
  }

  async excluir(usuario: TokenPayload, indicadorId: string) {
    const atual = await this.obterComAcesso(usuario, indicadorId);
    await this.indicadores.excluir(atual.id);
    return this.resultadoDoRisco(atual.alunoId);
  }

  private async obterComAcesso(usuario: TokenPayload, indicadorId: string): Promise<Indicador> {
    const indicador = uuid.safeParse(indicadorId).success ? await this.indicadores.buscarPorId(indicadorId) : null;
    if (!indicador) throw new AppError(404, 'Indicador não encontrado.');
    await this.alunos.obterComAcesso(usuario, indicador.alunoId); // 404 se o aluno não for deste usuário
    return indicador;
  }

  private async resultadoDoRisco(alunoId: string) {
    const { classificacao, alerta } = await this.risco.reavaliar(alunoId);
    return { risco: classificacao, alertaGerado: alerta };
  }
}
