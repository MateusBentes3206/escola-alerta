import { pool } from './config/db';
import { NotificarOrientador, NotificarResponsavel } from './eventos/observadores/NotificacaoObservers';
import { PublicadorDeAlertas } from './eventos/PublicadorDeAlertas';
import { GeradorDePlanoDeAcao } from './motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from './motor/MotorDeRegras';
import { PgAlertaRepository } from './repositories/AlertaRepository';
import { PgAlunoRepository } from './repositories/AlunoRepository';
import { PgIndicadorRepository } from './repositories/IndicadorRepository';
import { PgNotificacaoRepository } from './repositories/NotificacaoRepository';
import { PgUsuarioRepository } from './repositories/UsuarioRepository';
import { AlertaService } from './services/AlertaService';
import { AlunoService } from './services/AlunoService';
import { AuthService } from './services/AuthService';
import { IndicadorService } from './services/IndicadorService';
import { ReavaliacaoPeriodica } from './services/ReavaliacaoPeriodica';
import { ServicoDeRisco } from './services/ServicoDeRisco';

/**
 * Raiz de composição: o único lugar que decide QUAL implementação cada camada recebe
 * (injeção de dependência manual). Services e controllers só conhecem interfaces.
 */

// Repositories
const usuarios = new PgUsuarioRepository(pool);
const alunos = new PgAlunoRepository(pool);
const indicadores = new PgIndicadorRepository(pool);
const alertas = new PgAlertaRepository(pool);
const notificacoes = new PgNotificacaoRepository(pool);

// Motor de correlação (Strategy) + plano de ação + Observer
export const motor = MotorDeRegras.padrao();
const gerador = new GeradorDePlanoDeAcao();
export const publicador = new PublicadorDeAlertas()
  .inscrever(new NotificarResponsavel(notificacoes))
  .inscrever(new NotificarOrientador(notificacoes));

// Services
export const servicoDeRisco = new ServicoDeRisco(alunos, indicadores, alertas, motor, gerador, publicador);
export const authService = new AuthService(usuarios);
export const alunoService = new AlunoService(alunos, indicadores, alertas, usuarios, motor);
export const indicadorService = new IndicadorService(indicadores, alunoService, servicoDeRisco);
export const alertaService = new AlertaService(alertas, notificacoes, alunoService);
export const reavaliacaoPeriodica = new ReavaliacaoPeriodica(alunos, servicoDeRisco);
export { notificacoes as notificacaoRepository };
