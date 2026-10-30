import { z } from 'zod';
import { paraPublico } from '../domain/usuario';
import { AppError } from '../errors/AppError';
import { IAlunoRepository } from '../repositories/AlunoRepository';
import { ICadastroFamiliaRepository } from '../repositories/CadastroFamiliaRepository';
import { INotificacaoRepository } from '../repositories/NotificacaoRepository';
import { IUsuarioRepository } from '../repositories/UsuarioRepository';
import { gerarHashSenha } from './senha';
import { gerarToken } from './token';

/** Celular brasileiro com DDD -> E.164 (+55DDDNÚMERO). Aceita "(92) 99123-4567", "92991234567", "+55 92 ...". */
export function normalizarCelular(entrada: string): string | null {
  let d = entrada.replace(/\D/g, '');
  if (d.length === 13 && d.startsWith('55')) d = d.slice(2);
  // DDD de 11 a 99 + celular de 9 dígitos começando com 9 (WhatsApp precisa de celular)
  if (!/^[1-9][1-9]9\d{8}$/.test(d)) return null;
  return `+55${d}`;
}

const MSG_CELULAR = 'Informe um celular com DDD, por exemplo (92) 99123-4567.';

export const cadastroFamiliaSchema = z.object({
  nome: z.string({ error: 'Informe seu nome completo.' }).trim().min(3, 'Informe seu nome completo.').max(120),
  email: z.string({ error: 'Informe um e-mail válido.' }).trim().toLowerCase().email('Informe um e-mail válido.'),
  senha: z.string({ error: 'Crie uma senha.' }).min(8, 'A senha precisa ter pelo menos 8 caracteres.').max(72),
  telefone: z.string({ error: MSG_CELULAR }).transform((t, ctx) => {
    const n = normalizarCelular(t);
    if (!n) ctx.addIssue({ code: 'custom', message: MSG_CELULAR });
    return n ?? '';
  }),
  filhos: z.array(z.object({
    nome: z.string({ error: 'Informe o nome completo do filho.' }).trim().min(3, 'Informe o nome completo do filho.').max(120),
    turma: z.string({ error: 'Informe a turma do filho.' }).trim().min(2, 'Informe a turma do filho.').max(40),
    orientadorId: z.string({ error: 'Escolha o orientador escolar.' }).uuid('Escolha o orientador escolar.'),
  }), { error: 'Cadastre pelo menos um filho.' }).min(1, 'Cadastre pelo menos um filho.').max(10, 'No máximo 10 filhos por cadastro.'),
});

/**
 * Cadastro do responsável pela própria família, já com os filhos. Cada filho fica ligado ao orientador
 * escolhido, mas entra "aguardando confirmação": o orientador recebe um aviso e confirma (ou recusa)
 * o vínculo. Assim, ninguém vira responsável de um aluno só por se cadastrar.
 */
export class CadastroFamiliaService {
  constructor(
    private readonly cadastro: ICadastroFamiliaRepository,
    private readonly usuarios: IUsuarioRepository,
    private readonly alunos: IAlunoRepository,
    private readonly notificacoes: INotificacaoRepository,
  ) {}

  listarOrientadores() {
    return this.cadastro.orientadores();
  }

  async cadastrar(body: unknown) {
    const dados = cadastroFamiliaSchema.parse(body);

    const orientadores = new Set((await this.cadastro.orientadores()).map((o) => o.id));
    if (dados.filhos.some((f) => !orientadores.has(f.orientadorId))) throw new AppError(400, 'Escolha um orientador escolar da lista.');
    if (await this.cadastro.emailEmUso(dados.email)) throw new AppError(409, 'Já existe uma conta com este e-mail. Use "Entrar" ou fale com a escola.');

    const { responsavelId } = await this.cadastro.criar({
      nome: dados.nome,
      email: dados.email,
      senhaHash: await gerarHashSenha(dados.senha),
      telefone: dados.telefone,
      filhos: dados.filhos,
    });

    // Aviso para cada orientador: há um vínculo novo para confirmar.
    for (const filho of dados.filhos) {
      await this.notificacoes.criar({
        usuarioId: filho.orientadorId,
        alertaId: null,
        mensagem: `${dados.nome} cadastrou ${filho.nome} (${filho.turma}) como filho(a). Confirme o vínculo na ficha do aluno.`,
      });
    }

    // Já entra logado, como no login.
    const usuario = (await this.usuarios.buscarPorId(responsavelId))!;
    return { token: gerarToken({ sub: usuario.id, perfil: usuario.perfil }), usuario: paraPublico(usuario) };
  }

  /** O orientador confirma que o aluno é dele, ou recusa (o cadastro do filho é desfeito). */
  async decidirVinculo(orientadorId: string, alunoId: string, confirmar: boolean) {
    const aluno = /^[0-9a-f-]{36}$/i.test(alunoId) ? await this.alunos.buscarPorId(alunoId) : null;
    if (!aluno || aluno.orientadorId !== orientadorId) throw new AppError(404, 'Aluno não encontrado.');
    if (aluno.vinculoConfirmado) throw new AppError(409, 'O vínculo deste aluno já está confirmado.');

    if (confirmar) await this.alunos.confirmarVinculo(aluno.id);
    else await this.alunos.excluir(aluno.id);

    if (aluno.responsavelId) {
      await this.notificacoes.criar({
        usuarioId: aluno.responsavelId,
        alertaId: null,
        mensagem: confirmar
          ? `A orientação escolar confirmou o cadastro de ${aluno.nome}. Agora você acompanha o desenvolvimento por aqui.`
          : `A orientação escolar não reconheceu ${aluno.nome} (${aluno.turma}) entre seus alunos. Confira os dados e procure a escola.`,
      });
    }
    return { confirmado: confirmar };
  }
}
