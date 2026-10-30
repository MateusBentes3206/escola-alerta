import { Aluno } from '../domain/aluno';
import { CausaRaiz, Classificacao, NivelRisco } from '../domain/risco';
import { TokenPayload } from '../domain/usuario';
import { MotorDeRegras } from '../motor/MotorDeRegras';
import { recomendarParaFoco } from '../motor/RecomendacoesDeEnsino';
import { IAlertaRepository, StatusPlano } from '../repositories/AlertaRepository';
import { IAlunoRepository } from '../repositories/AlunoRepository';
import { IIndicadorRepository } from '../repositories/IndicadorRepository';
import { MatrizService } from './MatrizService';

const ORDEM_CAUSAS: CausaRaiz[] = ['FALTAS', 'NOTAS', 'OCORRENCIAS', 'SAIDAS'];
const CAUSA_TEXTO: Record<CausaRaiz, string> = { FALTAS: 'Frequência', NOTAS: 'Notas', OCORRENCIAS: 'Ocorrências', SAIDAS: 'Saídas antecipadas' };
const GRUPO_ATENCAO = 'ATENCAO';
const GRUPO_SEM_SINAIS = 'SEM_SINAIS';

interface AlunoAvaliado {
  aluno: Aluno;
  c: Classificacao;
  planoStatus: StatusPlano | null;
}

const fmt = (n: number) => n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const contarNiveis = (lista: AlunoAvaliado[]) => {
  const n: Record<NivelRisco, number> = { ALTO: 0, MODERADO: 0, BAIXO: 0 };
  for (const a of lista) n[a.c.nivel]++;
  return n;
};
const resumoAluno = ({ aluno, c, planoStatus }: AlunoAvaliado) => ({
  id: aluno.id, nome: aluno.nome, turma: aluno.turma, nivel: c.nivel, resumo: c.resumo, correlacao: c.correlacao, planoStatus,
});
const sinal = (c: Classificacao, causa: CausaRaiz) => c.sinais.find((s) => s.causa === causa);

/** Plural simples: pl(1, 'falta') = '1 falta'; pl(3, 'falta') = '3 faltas'. */
const pl = (n: number, singular: string, plural = `${singular}s`) => `${n} ${n === 1 ? singular : plural}`;

/** Começo de frase com a proporção: "Todos", "2 de 4" (grupos de um aluno não usam proporção). */
const quantos = (k: number, n: number) => (k === n ? 'Todos' : `${k} de ${n}`);

/**
 * Perfil de risco = conjunto de causas com sinal moderado ou alto (peso >= 2).
 * Alunos com o mesmo perfil vão para o mesmo grupo: costumam pedir a mesma intervenção.
 * Quem só tem sinais fracos fica em "atenção"; quem não tem sinal nenhum, em "sem sinais".
 */
function perfilDe(c: Classificacao): string {
  const causas = ORDEM_CAUSAS.filter((causa) => (sinal(c, causa)?.peso ?? 0) >= 2);
  if (causas.length > 0) return causas.join('+');
  return c.sinais.length > 0 ? GRUPO_ATENCAO : GRUPO_SEM_SINAIS;
}

/** O que os alunos do grupo têm em comum, em frases curtas para o orientador. */
function emComum(lista: AlunoAvaliado[], causas: CausaRaiz[]): string[] {
  const n = lista.length;
  const grupo = n > 1;
  const frases: string[] = [];

  const porTurma = new Map<string, number>();
  for (const { aluno } of lista) porTurma.set(aluno.turma, (porTurma.get(aluno.turma) ?? 0) + 1);
  const [turma, naTurma] = [...porTurma.entries()].sort((a, b) => b[1] - a[1])[0];
  if (grupo && naTurma >= 2) frases.push(`${quantos(naTurma, n)} são do ${turma}`);

  if (causas.includes('FALTAS')) {
    const faltas = lista.map(({ c }) => sinal(c, 'FALTAS')?.metricas?.faltas ?? 0);
    const seguidas = lista.filter(({ c }) => (sinal(c, 'FALTAS')?.metricas?.sequencia ?? 0) >= 3).length;
    frases.push(grupo
      ? `Média de ${fmt(faltas.reduce((s, x) => s + x, 0) / n)} faltas sem justificativa nos últimos 30 dias`
      : `${pl(faltas[0], 'falta')} sem justificativa nos últimos 30 dias`);
    if (seguidas > 0) frases.push(`${grupo ? `${quantos(seguidas, n)} com` : 'Com'} 3 ou mais dias letivos seguidos de falta`);
  }

  if (causas.includes('NOTAS')) {
    const porDisciplina = new Map<string, number>();
    const porAssunto = new Map<string, { disciplina: string; assunto: string; alunos: number }>();
    for (const { c } of lista) {
      for (const f of sinal(c, 'NOTAS')?.focos ?? []) {
        if (f.abaixoDoLimite) porDisciplina.set(f.disciplina, (porDisciplina.get(f.disciplina) ?? 0) + 1);
        if (f.assunto) {
          const chave = `${f.disciplina}|${f.assunto}`.toLowerCase();
          const atual = porAssunto.get(chave) ?? { disciplina: f.disciplina, assunto: f.assunto, alunos: 0 };
          atual.alunos++;
          porAssunto.set(chave, atual);
        }
      }
    }
    for (const [disciplina, k] of [...porDisciplina.entries()].sort((a, b) => b[1] - a[1])) {
      if (!grupo) frases.push(`${disciplina} abaixo de 6`);
      else if (k >= 2) frases.push(`${disciplina} abaixo de 6: ${k === n ? 'todos os alunos' : `${k} de ${n} alunos`}`);
    }
    for (const a of porAssunto.values()) {
      if (a.alunos >= 2) frases.push(`Mesmo assunto em baixa: ${a.assunto} (${a.disciplina}), ${a.alunos} alunos`);
    }
  }

  if (causas.includes('OCORRENCIAS')) {
    const total = lista.reduce((s, { c }) => s + (sinal(c, 'OCORRENCIAS')?.metricas?.ocorrencias ?? 0), 0);
    const graves = lista.reduce((s, { c }) => s + (sinal(c, 'OCORRENCIAS')?.metricas?.graves ?? 0), 0);
    frases.push(`${pl(total, 'ocorrência', 'ocorrências')} nos últimos 30 dias${graves > 0 ? `, ${graves} ${graves === 1 ? 'grave' : 'graves'}` : ''}`);
  }

  if (causas.includes('SAIDAS')) {
    const total = lista.reduce((s, { c }) => s + (sinal(c, 'SAIDAS')?.metricas?.saidas ?? 0), 0);
    frases.push(`${pl(total, 'saída antecipada', 'saídas antecipadas')} nos últimos 30 dias`);
  }

  const correlacao = lista.filter(({ c }) => c.correlacao).length;
  if (correlacao > 0) frases.push(`${grupo ? `${quantos(correlacao, n)} com` : 'Com'} sinais combinados (correlação), o que elevou o risco`);

  const abertos = lista.filter(({ planoStatus }) => planoStatus === 'ABERTO').length;
  if (abertos > 0) frases.push(`${grupo ? `${quantos(abertos, n)} com` : 'Com'} plano de ação ainda aberto`);

  return frases;
}

/**
 * Visão da turma para o orientador (painel): por turma, por grupos de perfil parecido e
 * assuntos que vários alunos precisam reforçar. Cada grupo traz as ações da matriz da escola
 * para as causas do grupo, para o orientador comparar e escolher o que usar com cada aluno.
 * Só leitura: o fluxo de alertas e planos continua o mesmo.
 */
export class AnaliseTurmaService {
  constructor(
    private readonly alunos: IAlunoRepository,
    private readonly indicadores: IIndicadorRepository,
    private readonly alertas: IAlertaRepository,
    private readonly motor: MotorDeRegras,
    private readonly matrizes: MatrizService,
  ) {}

  async analisar(usuario: TokenPayload) {
    const [lista, matriz] = await Promise.all([
      this.alunos.listarPorOrientador(usuario.sub),
      this.matrizes.matrizDoOrientador(usuario.sub),
    ]);

    const avaliados: AlunoAvaliado[] = await Promise.all(lista.map(async (aluno) => {
      const c = this.motor.classificar(await this.indicadores.listarPorAluno(aluno.id));
      const ultimo = await this.alertas.ultimoDoAluno(aluno.id);
      const plano = ultimo ? await this.alertas.statusDoPlano(ultimo.id) : null;
      return { aluno, c, planoStatus: plano?.status ?? null };
    }));

    // 1. Por turma
    const porTurma = new Map<string, AlunoAvaliado[]>();
    for (const a of avaliados) porTurma.set(a.aluno.turma, [...(porTurma.get(a.aluno.turma) ?? []), a]);
    const turmas = [...porTurma.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'pt-BR', { numeric: true }))
      .map(([turma, membros]) => ({
        turma,
        total: membros.length,
        niveis: contarNiveis(membros),
        alunos: membros.map(resumoAluno),
      }));

    // 2. Grupos de perfil parecido
    const porPerfil = new Map<string, AlunoAvaliado[]>();
    for (const a of avaliados) porPerfil.set(perfilDe(a.c), [...(porPerfil.get(perfilDe(a.c)) ?? []), a]);
    const grupos = [...porPerfil.entries()].map(([chave, membros]) => {
      const especial = chave === GRUPO_ATENCAO || chave === GRUPO_SEM_SINAIS;
      const causas = especial
        ? ORDEM_CAUSAS.filter((causa) => membros.some(({ c }) => sinal(c, causa)))
        : (chave.split('+') as CausaRaiz[]);
      return {
        chave,
        causas,
        titulo: chave === GRUPO_ATENCAO ? 'Sinais leves de atenção'
          : chave === GRUPO_SEM_SINAIS ? 'Sem sinais de risco'
          : causas.map((c) => CAUSA_TEXTO[c]).join(' + '),
        total: membros.length,
        niveis: contarNiveis(membros),
        emComum: chave === GRUPO_SEM_SINAIS ? [] : emComum(membros, causas),
        acoesDaMatriz: chave === GRUPO_SEM_SINAIS ? [] : causas.map((causa) => ({ causa, titulo: CAUSA_TEXTO[causa], sugestoes: matriz[causa] })),
        alunos: membros.sort((a, b) => a.aluno.nome.localeCompare(b.aluno.nome)).map(resumoAluno),
      };
    }).sort((a, b) => {
      const especial = (g: { chave: string }) => (g.chave === GRUPO_SEM_SINAIS ? 2 : g.chave === GRUPO_ATENCAO ? 1 : 0);
      return especial(a) - especial(b) || b.niveis.ALTO - a.niveis.ALTO || b.total - a.total;
    });

    // 3. Assuntos que dois ou mais alunos precisam reforçar: dá para trabalhar em grupo
    const porAssunto = new Map<string, { disciplina: string; assunto: string; alunos: { id: string; nome: string; turma: string; nota: number }[]; ensino: string[] }>();
    for (const { aluno, c } of avaliados) {
      for (const f of sinal(c, 'NOTAS')?.focos ?? []) {
        if (!f.assunto) continue;
        const chave = `${f.disciplina}|${f.assunto}`.toLowerCase();
        const atual = porAssunto.get(chave) ?? { disciplina: f.disciplina, assunto: f.assunto, alunos: [], ensino: recomendarParaFoco({ ...f, notaAnterior: null }).ensino };
        atual.alunos.push({ id: aluno.id, nome: aluno.nome, turma: aluno.turma, nota: Math.round(f.nota * 10) / 10 });
        porAssunto.set(chave, atual);
      }
    }
    const reforcosEmGrupo = [...porAssunto.values()]
      .filter((r) => r.alunos.length >= 2)
      .map((r) => ({ ...r, alunos: r.alunos.sort((a, b) => a.nota - b.nota) }))
      .sort((a, b) => b.alunos.length - a.alunos.length);

    return { totalAlunos: avaliados.length, niveis: contarNiveis(avaliados), turmas, grupos, reforcosEmGrupo };
  }
}
