import { CanalEmail } from './canais/CanalEmail';
import { CanalWhatsApp } from './canais/CanalWhatsApp';
import { pool } from './config/db';
import { AvisoExternoDeRiscoAlto } from './eventos/observadores/AvisoExternoDeRiscoAlto';
import { NotificarOrientador, NotificarResponsavel } from './eventos/observadores/NotificacaoObservers';
import { PublicadorDeAlertas } from './eventos/PublicadorDeAlertas';
import { GeradorDePlanoDeAcao } from './motor/GeradorDePlanoDeAcao';
import { MotorDeRegras } from './motor/MotorDeRegras';
import { PgAlertaRepository } from './repositories/AlertaRepository';
import { PgCadastroFamiliaRepository } from './repositories/CadastroFamiliaRepository';
import { PgAlunoRepository } from './repositories/AlunoRepository';
import { PgIndicadorRepository } from './repositories/IndicadorRepository';
import { PgMatrizRepository } from './repositories/MatrizRepository';
import { PgMensagemRepository } from './repositories/MensagemRepository';
import { PgNotificacaoRepository } from './repositories/NotificacaoRepository';
import { PgSolicitacaoRepository } from './repositories/SolicitacaoRepository';
import { PgUsuarioRepository } from './repositories/UsuarioRepository';
import { AlertaService } from './services/AlertaService';
import { AnaliseTurmaService } from './services/AnaliseTurmaService';
import { AlunoService } from './services/AlunoService';
import { AuthService } from './services/AuthService';
import { CadastroFamiliaService } from './services/CadastroFamiliaService';
import { IndicadorService } from './services/IndicadorService';
import { MatrizService } from './services/MatrizService';
import { ReavaliacaoPeriodica } from './services/ReavaliacaoPeriodica';
import { ServicoDeRisco } from './services/ServicoDeRisco';
import { SolicitacaoService } from './services/SolicitacaoService';

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
const solicitacoes = new PgSolicitacaoRepository(pool);
const matrizes = new PgMatrizRepository(pool);
export const mensagensExternas = new PgMensagemRepository(pool);

// Motor de correlação (Strategy) + plano de ação + Observer
export const motor = MotorDeRegras.padrao();
const gerador = new GeradorDePlanoDeAcao();
export const publicador = new PublicadorDeAlertas()
  .inscrever(new NotificarResponsavel(notificacoes))
  .inscrever(new NotificarOrientador(notificacoes))
  // Risco alto: avisa a família fora do app (sem credenciais, os canais ficam em simulação e só registram)
  .inscrever(new AvisoExternoDeRiscoAlto(new CanalWhatsApp(), usuarios, mensagensExternas))
  .inscrever(new AvisoExternoDeRiscoAlto(new CanalEmail(), usuarios, mensagensExternas));

// Services
export const matrizService = new MatrizService(matrizes);
export const servicoDeRisco = new ServicoDeRisco(alunos, indicadores, alertas, motor, gerador, publicador, matrizService);
export const authService = new AuthService(usuarios);
export const alunoService = new AlunoService(alunos, indicadores, alertas, usuarios, motor);
export const indicadorService = new IndicadorService(indicadores, alunoService, servicoDeRisco);
export const alertaService = new AlertaService(alertas, notificacoes, alunoService);
export const solicitacaoService = new SolicitacaoService(solicitacoes, alertas, notificacoes, alunoService);
export const analiseTurmaService = new AnaliseTurmaService(alunos, indicadores, alertas, motor, matrizService);
export const cadastroFamiliaService = new CadastroFamiliaService(new PgCadastroFamiliaRepository(pool), usuarios, alunos, notificacoes);
export const reavaliacaoPeriodica = new ReavaliacaoPeriodica(alunos, servicoDeRisco);
export { notificacoes as notificacaoRepository };
