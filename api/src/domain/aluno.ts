export interface Aluno {
  id: string;
  nome: string;
  turma: string;
  orientadorId: string;
  responsavelId: string | null;
  responsavelNome: string | null;
  vinculoConfirmado: boolean; // false = cadastrado pela família, aguardando o orientador confirmar
}
