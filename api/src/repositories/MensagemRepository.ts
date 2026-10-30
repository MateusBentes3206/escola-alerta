import { Pool } from 'pg';
import { TipoCanal } from '../canais/CanalExterno';

export type StatusMensagem = 'ENVIADA' | 'SIMULADA' | 'FALHOU' | 'SEM_CONTATO';

export interface RegistroMensagem {
  id: string;
  canal: TipoCanal;
  destino: string | null;
  assunto: string | null;
  conteudo: string;
  status: StatusMensagem;
  erro: string | null;
  criadoEm: string;
}

export interface IMensagemRepository {
  registrar(d: { usuarioId: string; alunoId: string; alertaId: string | null; canal: TipoCanal; destino: string | null; assunto: string | null; conteudo: string; status: StatusMensagem; erro?: string | null }): Promise<void>;
  listarPorAluno(alunoId: string): Promise<RegistroMensagem[]>;
}

export class PgMensagemRepository implements IMensagemRepository {
  constructor(private readonly pool: Pool) {}

  async registrar(d: Parameters<IMensagemRepository['registrar']>[0]) {
    await this.pool.query(
      `INSERT INTO mensagens_externas (usuario_id, aluno_id, alerta_id, canal, destino, assunto, conteudo, status, erro)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [d.usuarioId, d.alunoId, d.alertaId, d.canal, d.destino, d.assunto, d.conteudo, d.status, d.erro ?? null],
    );
  }

  async listarPorAluno(alunoId: string) {
    const { rows } = await this.pool.query<{
      id: string; canal: TipoCanal; destino: string | null; assunto: string | null; conteudo: string; status: StatusMensagem; erro: string | null; criado_em: Date;
    }>('SELECT id, canal, destino, assunto, conteudo, status, erro, criado_em FROM mensagens_externas WHERE aluno_id = $1 ORDER BY criado_em DESC', [alunoId]);
    return rows.map((r) => ({ id: r.id, canal: r.canal, destino: r.destino, assunto: r.assunto, conteudo: r.conteudo, status: r.status, erro: r.erro, criadoEm: r.criado_em.toISOString() }));
  }
}
