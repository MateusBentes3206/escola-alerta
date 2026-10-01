/* ---------------------------------------------------------
   EscolaAlerta — cliente HTTP da API
   Único lugar do front que sabe a URL da API e como enviar o token.
   As telas chamam api.login(), api.get('/alunos') etc., nunca fetch direto.
--------------------------------------------------------- */
(function () {
  const API_URL = window.ESCOLAALERTA_API_URL || 'http://localhost:3333';
  const CHAVE_TOKEN = 'escolaalerta.token';
  const CHAVE_USUARIO = 'escolaalerta.usuario';

  // sessionStorage: a sessão some ao fechar a aba (mais seguro em computador compartilhado da escola).
  const sessao = {
    get token() { try { return sessionStorage.getItem(CHAVE_TOKEN); } catch { return null; } },
    get usuario() {
      try { return JSON.parse(sessionStorage.getItem(CHAVE_USUARIO) || 'null'); } catch { return null; }
    },
    salvar(token, usuario) {
      try { sessionStorage.setItem(CHAVE_TOKEN, token); sessionStorage.setItem(CHAVE_USUARIO, JSON.stringify(usuario)); } catch {}
    },
    limpar() {
      try { sessionStorage.removeItem(CHAVE_TOKEN); sessionStorage.removeItem(CHAVE_USUARIO); } catch {}
    },
  };

  /** Erro com a mensagem amigável que a API devolve em { erro }. */
  class ApiError extends Error {
    constructor(status, mensagem, detalhes) {
      super(mensagem);
      this.status = status;
      this.detalhes = detalhes;
    }
  }

  // Chamado quando o token expira; o App registra aqui o "voltar para o login".
  let aoExpirarSessao = () => {};

  async function requisicao(metodo, caminho, corpo) {
    const headers = { 'Content-Type': 'application/json' };
    if (sessao.token) headers.Authorization = `Bearer ${sessao.token}`;

    let res;
    try {
      res = await fetch(`${API_URL}${caminho}`, {
        method: metodo,
        headers,
        body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
      });
    } catch {
      throw new ApiError(0, 'Não foi possível conectar ao servidor. Verifique se a API está rodando.');
    }

    const dados = res.status === 204 ? null : await res.json().catch(() => null);

    if (!res.ok) {
      // 401 fora do login = sessão expirada: limpa e volta para a tela inicial
      if (res.status === 401 && caminho !== '/auth/login') {
        sessao.limpar();
        aoExpirarSessao();
      }
      throw new ApiError(res.status, (dados && dados.erro) || `Erro ${res.status}`, dados && dados.detalhes);
    }
    return dados;
  }

  window.api = {
    ApiError,
    sessao,
    aoExpirarSessao(fn) { aoExpirarSessao = fn; },

    get: (caminho) => requisicao('GET', caminho),
    post: (caminho, corpo) => requisicao('POST', caminho, corpo),
    patch: (caminho, corpo) => requisicao('PATCH', caminho, corpo),
    del: (caminho) => requisicao('DELETE', caminho),

    async login(email, senha) {
      const { token, usuario } = await requisicao('POST', '/auth/login', { email, senha });
      sessao.salvar(token, usuario);
      return usuario;
    },
    logout() { sessao.limpar(); },
  };
})();
