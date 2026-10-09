export interface Aluno {
  id: string;
  nome: string;
  turma: string;
  orientadorId: string;
  responsavelId: string | null;
  responsavelNome: string | null;
}
