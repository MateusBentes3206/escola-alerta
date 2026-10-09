// npm run avaliar:motor -> imprime a matriz de confusão do motor sobre os cenários simulados (RNF04).
import { MotorDeRegras } from '../src/motor/MotorDeRegras';
import { avaliarMotor, NIVEIS } from './avaliar';
import { CENARIOS } from './cenarios';

const r = avaliarMotor(MotorDeRegras.padrao(), CENARIOS);
const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
const col = (s: string | number) => String(s).padStart(10);

console.log(`\nAvaliação do motor de correlação (RNF04): ${r.total} cenários simulados\n`);
console.log('Matriz de confusão (linhas = esperado, colunas = obtido pelo motor)');
console.log(col('') + NIVEIS.map(col).join(''));
for (const e of NIVEIS) console.log(col(e) + NIVEIS.map((o) => col(r.matriz[e][o])).join(''));

console.log('\nPor nível:');
for (const n of NIVEIS) console.log(`  ${n.padEnd(9)} precisão ${pct(r.porClasse[n].precisao).padStart(6)}   recall ${pct(r.porClasse[n].recall).padStart(6)}`);

console.log(`\nAcurácia: ${r.acertos}/${r.total} = ${pct(r.acuracia)}  (meta RNF04: 80%) ${r.acuracia >= 0.8 ? '✔ atingida' : '✘ NÃO atingida'}`);

if (r.erros.length) {
  console.log('\nDivergências (limitações conhecidas das regras atuais):');
  for (const e of r.erros) console.log(`  ${e.id} ${e.descricao}: esperado ${e.esperado}, motor ${e.obtido}`);
}
console.log();
