import { mascararEmail, mascararTelefone } from '../../src/domain/mascara';
import { normalizarCelular } from '../../src/services/CadastroFamiliaService';

describe('Celular do responsável (WhatsApp)', () => {
  it.each([
    ['(92) 99123-4567', '+5592991234567'],
    ['92991234567', '+5592991234567'],
    ['+55 92 99123-4567', '+5592991234567'],
    ['11 98765-4321', '+5511987654321'],
  ])('%s -> %s', (entrada, esperado) => {
    expect(normalizarCelular(entrada)).toBe(esperado);
  });

  it.each(['3232-1234', '(92) 3232-1234', '(01) 99123-4567', '99123-4567', 'abc'])('recusa %s (fixo, sem DDD ou inválido)', (entrada) => {
    expect(normalizarCelular(entrada)).toBeNull();
  });
});

describe('Máscara de contato (LGPD)', () => {
  it('telefone mostra só DDD e final', () => {
    expect(mascararTelefone('+5592900000001')).toBe('(92) 9****-0001');
  });
  it('e-mail mostra só a primeira letra e o domínio', () => {
    expect(mascararEmail('beatriz.lima@email.com')).toBe('b***********@email.com');
  });
});

import { textoParaFamilia } from '../../src/domain/mensagemFamilia';

describe('Mensagem para a família', () => {
  const base = { responsavelNome: 'Beatriz Lima', alunoNome: 'Rafael Costa Lima', turma: '8º ano B', link: 'http://escola' };

  it('risco alto ou moderado: nível, motivo e link, sem notas (LGPD)', () => {
    const t = textoParaFamilia({ ...base, nivel: 'ALTO', causa: 'NOTAS' });
    expect(t).toMatch(/^Olá, Beatriz\./);
    expect(t).toMatch(/Rafael \(8º ano B\) está com risco ALTO no acompanhamento escolar\. Principal motivo: notas\./);
    expect(t).toContain('http://escola');
    expect(textoParaFamilia({ ...base, nivel: 'MODERADO', causa: 'FALTAS' })).toMatch(/risco MODERADO.*frequência/s);
  });

  it('sem risco: convite geral para conversar', () => {
    expect(textoParaFamilia({ ...base, nivel: 'BAIXO', causa: null })).toMatch(/Gostaríamos de conversar sobre o acompanhamento de Rafael/);
  });
});
