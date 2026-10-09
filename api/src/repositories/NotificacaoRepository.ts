import { Pool } from 'pg';

export interface Notificacao {
  id: string;
  alertaId: string | null;
  mensagem: string;
  lida: boolean;
  criadoEm: string;
}

export interface INotificacaoRepository {
  criar(dados: { usuarioId: string; alertaId: string | null; mensagem: string }): Promise<void>;
  listarPorUsuario(usuarioId: string): Promise<Notificacao[]>;
  /** Marca como lida só se pertencer ao usuário; devolve false se não encontrou. */
  marcarLida(id: string, usuarioId: string): Promise<boolean>;
}

interface NotificacaoRow {
  id: string;
  alerta_id: string | null;
  mensagem: string;
  lida: boolean;
  criado_em: Date;
}

export class PgNotificacaoRepository implements INotificacaoRepository {
  constructor(private readonly pool: Pool) {}

  async criar(d: { usuarioId: string; alertaId: string | null; mensagem: string }) {
    await this.pool.query('INSERT INTO notificacoes (usuario_id, alerta_id, mensagem) VALUES ($1, $2, $3)', [d.usuarioId, d.alertaId, d.mensagem]);
  }

  async listarPorUsuario(usuarioId: string) {
    const { rows } = await this.pool.query<NotificacaoRow>(
      `SELECT id, alerta_id, mensagem, lida, criado_em FROM notificacoes
       WHERE usuario_id = $1 ORDER BY criado_em DESC LIMIT 50`,
      [usuarioId],
    );
    return rows.map((r) => ({ id: r.id, alertaId: r.alerta_id, mensagem: r.mensagem, lida: r.lida, criadoEm: r.criado_em.toISOString() }));
  }

  async marcarLida(id: string, usuarioId: string) {
    const { rowCount } = await this.pool.query('UPDATE notificacoes SET lida = true WHERE id = $1 AND usuario_id = $2', [id, usuarioId]);
    return (rowCount ?? 0) > 0;
  }
}
