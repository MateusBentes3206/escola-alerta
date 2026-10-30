import { z } from 'zod';
import { TokenPayload } from '../domain/usuario';
import { MATRIZ_DE_SUGESTOES } from '../motor/GeradorDePlanoDeAcao';
import { IMatrizRepository, Matriz } from '../repositories/MatrizRepository';

export const MAX_SUGESTOES_POR_CAUSA = 6;

const sugestao = z.string({ error: 'Cada sugestão deve ser um texto.' }).trim()
  .min(5, 'Cada sugestão precisa ter pelo menos 5 caracteres.')
  .max(300, 'Cada sugestão pode ter no máximo 300 caracteres.');

// Toda causa precisa de pelo menos uma sugestão: o plano usa a 1ª de cada causa na correlação.
const lista = (nome: string) => z
  .array(sugestao, { error: `Informe as sugestões de ${nome}.` })
  .min(1, `Mantenha pelo menos uma sugestão em ${nome}.`)
  .max(MAX_SUGESTOES_POR_CAUSA, `No máximo ${MAX_SUGESTOES_POR_CAUSA} sugestões em ${nome}.`)
  .refine((l) => new Set(l.map((t) => t.toLowerCase())).size === l.length, `Há sugestões repetidas em ${nome}.`);

export const matrizSchema = z.object({
  NOTAS: lista('Notas'),
  FALTAS: lista('Frequência'),
  OCORRENCIAS: lista('Ocorrências'),
  SAIDAS: lista('Saídas antecipadas'),
});

/** A escola adapta as ações sugeridas no plano à própria realidade. Vale só para planos novos. */
export class MatrizService {
  constructor(private readonly matrizes: IMatrizRepository) {}

  /** Matriz que o motor usa para os alunos deste orientador. */
  async matrizDoOrientador(orientadorId: string): Promise<Matriz> {
    return (await this.matrizes.obter(orientadorId))?.matriz ?? MATRIZ_DE_SUGESTOES;
  }

  async obter(usuario: TokenPayload) {
    const personalizada = await this.matrizes.obter(usuario.sub);
    return {
      matriz: personalizada?.matriz ?? MATRIZ_DE_SUGESTOES,
      personalizada: personalizada !== null,
      atualizadoEm: personalizada?.atualizadoEm ?? null,
      padrao: MATRIZ_DE_SUGESTOES,
    };
  }

  async salvar(usuario: TokenPayload, body: unknown) {
    await this.matrizes.salvar(usuario.sub, matrizSchema.parse(body));
    return this.obter(usuario);
  }

  async restaurarPadrao(usuario: TokenPayload) {
    await this.matrizes.limpar(usuario.sub);
    return this.obter(usuario);
  }
}
