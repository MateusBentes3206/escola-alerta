import { NivelRisco } from '../src/domain/risco';
import { MotorDeRegras } from '../src/motor/MotorDeRegras';
import { Cenario } from './cenarios';

export const NIVEIS: NivelRisco[] = ['BAIXO', 'MODERADO', 'ALTO'];

export interface ResultadoAvaliacao {
  total: number;
  acertos: number;
  acuracia: number;
  /** matriz[esperado][obtido] = quantidade */
  matriz: Record<NivelRisco, Record<NivelRisco, number>>;
  porClasse: Record<NivelRisco, { precisao: number; recall: number }>;
  erros: { id: string; descricao: string; esperado: NivelRisco; obtido: NivelRisco }[];
}

/** Roda o motor em cada cenário e compara com o nível esperado (matriz de confusão). */
export function avaliarMotor(motor: MotorDeRegras, cenarios: Cenario[], dataReferencia = '2026-09-30'): ResultadoAvaliacao {
  const matriz = Object.fromEntries(NIVEIS.map((e) => [e, Object.fromEntries(NIVEIS.map((o) => [o, 0]))])) as ResultadoAvaliacao['matriz'];
  const erros: ResultadoAvaliacao['erros'] = [];

  for (const c of cenarios) {
    const obtido = motor.classificar(c.historico, dataReferencia).nivel;
    matriz[c.esperado][obtido]++;
    if (obtido !== c.esperado) erros.push({ id: c.id, descricao: c.descricao, esperado: c.esperado, obtido });
  }

  const acertos = NIVEIS.reduce((s, n) => s + matriz[n][n], 0);
  const porClasse = Object.fromEntries(
    NIVEIS.map((n) => {
      const previstos = NIVEIS.reduce((s, e) => s + matriz[e][n], 0);
      const reais = NIVEIS.reduce((s, o) => s + matriz[n][o], 0);
      return [n, { precisao: previstos ? matriz[n][n] / previstos : 0, recall: reais ? matriz[n][n] / reais : 0 }];
    }),
  ) as ResultadoAvaliacao['porClasse'];

  return { total: cenarios.length, acertos, acuracia: acertos / cenarios.length, matriz, porClasse, erros };
}
