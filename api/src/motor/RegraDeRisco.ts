import { Indicador } from '../domain/indicador';
import { CausaRaiz, SinalDeRisco } from '../domain/risco';

/**
 * Interface comum das estratégias do motor (padrão Strategy, Eixo 2 §3.1).
 * Cada critério de risco é uma classe que implementa avaliar(); o MotorDeRegras
 * só conhece esta interface. Criar uma regra nova não exige mexer no motor nem nas outras regras.
 */
export interface RegraDeRisco {
  readonly nome: string;
  readonly causa: CausaRaiz;
  /** Devolve o sinal encontrado no histórico, ou null se não houver risco por este critério. */
  avaliar(historico: Indicador[], dataReferencia: string): SinalDeRisco | null;
}
