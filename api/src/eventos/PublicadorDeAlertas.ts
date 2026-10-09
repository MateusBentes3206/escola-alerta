import { Aluno } from '../domain/aluno';
import { Alerta, NivelRisco, PlanoDeAcao } from '../domain/risco';

/** Evento publicado sempre que o motor gera um alerta novo (mudança de nível ou de causa). */
export interface AlertaGerado {
  alerta: Alerta;
  aluno: Aluno;
  plano: PlanoDeAcao | null;
  nivelAnterior: NivelRisco | null;
}

/** Observador do padrão Observer (Eixo 2 §3.3): reage ao alerta sem o motor conhecê-lo. */
export interface ObservadorDeAlerta {
  readonly nome: string;
  notificar(evento: AlertaGerado): Promise<void>;
}

/**
 * Sujeito observável. O ServicoDeRisco só chama publicar(); quem reage (família, escola,
 * e-mail no futuro) se inscreve aqui. Um canal novo = uma classe nova + inscrever().
 * A falha de um observador não impede os outros nem desfaz o alerta já gravado.
 */
export class PublicadorDeAlertas {
  private readonly observadores: ObservadorDeAlerta[] = [];

  inscrever(observador: ObservadorDeAlerta): this {
    this.observadores.push(observador);
    return this;
  }

  get inscritos(): string[] {
    return this.observadores.map((o) => o.nome);
  }

  async publicar(evento: AlertaGerado): Promise<void> {
    const resultados = await Promise.allSettled(this.observadores.map((o) => o.notificar(evento)));
    resultados.forEach((r, i) => {
      if (r.status === 'rejected') console.error(`Observador ${this.observadores[i].nome} falhou:`, r.reason);
    });
  }
}
