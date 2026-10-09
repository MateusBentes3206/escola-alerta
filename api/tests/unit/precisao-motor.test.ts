import { avaliarMotor } from '../../avaliacao/avaliar';
import { CENARIOS } from '../../avaliacao/cenarios';
import { MotorDeRegras } from '../../src/motor/MotorDeRegras';

// RNF04: motor de regras avaliado frente a cenários simulados (meta: 80% de acerto).
// Relatório completo: npm run avaliar:motor
describe('RNF04 - precisão do motor nos cenários simulados', () => {
  const r = avaliarMotor(MotorDeRegras.padrao(), CENARIOS);

  it('acurácia de pelo menos 80%', () => {
    expect(r.acuracia).toBeGreaterThanOrEqual(0.8);
  });

  it('nenhum aluno de risco ALTO é classificado como BAIXO (o erro mais grave)', () => {
    expect(r.matriz.ALTO.BAIXO).toBe(0);
  });

  it('todos os cenários têm id único', () => {
    expect(new Set(CENARIOS.map((c) => c.id)).size).toBe(CENARIOS.length);
  });
});
