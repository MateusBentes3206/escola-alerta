/* =====================================================================
   INTEGRAÇÃO DO LOGIN REAL NO PROTÓTIPO (escolaalerta-prototipo.html)
   São 3 passos. Nada além disso muda nesta sprint: as outras telas
   continuam usando os dados mock até a Sprint 2.
   ===================================================================== */


/* ---------------------------------------------------------------------
   PASSO 1 — No <head>, ANTES do <script type="text/babel">, adicione:

   <script>window.ESCOLAALERTA_API_URL = 'http://localhost:3333';</script>
   <script src="api.js"></script>

   (api.js precisa estar na mesma pasta do HTML)
--------------------------------------------------------------------- */


/* ---------------------------------------------------------------------
   PASSO 2 — Dentro de function App(), substitua as funções entrar() e
   sair() por estas, e adicione o useEffect logo abaixo delas.
   Também troque a 1ª linha do script:
     const { useState } = React;
   por:
     const { useState, useEffect } = React;
--------------------------------------------------------------------- */

  // O perfil agora vem da conta (API), não de um botão escolhido na tela.
  function entrar(usuario) {
    const perfilEscolhido = usuario.perfil === "ORIENTADOR" ? "orientador" : "responsavel";
    setPerfil(perfilEscolhido);
    if (perfilEscolhido === "orientador") {
      setTela("orientador-dashboard");
    } else {
      setAlunoSelecionado(ALUNO_DEMO_ID); // Sprint 2: vem de GET /me/alunos
      setTela("responsavel-painel");
    }
    mostrarToast(`Bem-vindo(a), ${usuario.nome.split(" ")[0]}.`);
  }

  function sair() {
    api.logout();
    setPerfil(null);
    setAlunoSelecionado(null);
    setTela("login");
  }

  // Se o token expirar no meio do uso, volta para o login com aviso.
  useEffect(() => {
    api.aoExpirarSessao(() => {
      sair();
      mostrarToast("Sua sessão expirou. Entre novamente.");
    });
    // Recarregou a página com sessão ativa: entra direto.
    if (api.sessao.token && api.sessao.usuario) entrar(api.sessao.usuario);
  }, []);


/* ---------------------------------------------------------------------
   PASSO 3 — Substitua o componente function Login(...) inteiro por este.
   Mudanças em relação ao protótipo:
   - e-mail/senha controlados e enviados para POST /auth/login
   - um único botão "Entrar" (perfil vem da conta)
   - estado de carregamento no botão  -> resolve a pendência H1 (Nielsen)
   - credenciais e texto "protótipo" removidos -> resolve a pendência H8
   - erro da API exibido com role="alert" (leitor de tela anuncia)
--------------------------------------------------------------------- */

function Login({ onEntrar, tema, onAlternarTema }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState("");
  const invalido = !email.trim() || !senha;

  async function enviar(e) {
    e.preventDefault();
    if (invalido || carregando) return;
    setErro("");
    setCarregando(true);
    try {
      const usuario = await api.login(email, senha);
      onEntrar(usuario);
    } catch (err) {
      setErro(err.message);
    } finally {
      setCarregando(false);
    }
  }

  return (
    <main id="main-content" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" }}>
      <button
        onClick={onAlternarTema} className="icon-btn"
        aria-label={tema === "claro" ? "Ativar modo escuro" : "Ativar modo claro"}
        style={{ position: "absolute", top: 20, right: 20, color: "var(--text-muted)", borderColor: "var(--border-strong)" }}
      >
        <Icon name={tema === "claro" ? "moon" : "sun"} size={15} />
      </button>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: "var(--accent)", color: "#fff",
            boxShadow: "0 8px 20px var(--accent-glow-strong)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Icon name="school" size={26} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, margin: 0 }}>EscolaAlerta</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Acompanhamento acadêmico e comportamental para famílias e escola, com alerta antecipado de risco.
          </p>
        </div>

        <form className="card" style={{ padding: 22 }} onSubmit={enviar} noValidate>
          <label className="field-label" htmlFor="login-email">E-mail</label>
          <input
            id="login-email" className="field" type="email" autoComplete="email" placeholder="voce@escola.com.br"
            value={email} onChange={(e) => setEmail(e.target.value)} disabled={carregando}
          />
          <label className="field-label" htmlFor="login-senha" style={{ marginTop: 14 }}>Senha</label>
          <input
            id="login-senha" className="field" type="password" autoComplete="current-password"
            value={senha} onChange={(e) => setSenha(e.target.value)} disabled={carregando}
          />

          {erro && (
            <p role="alert" style={{ fontSize: 13, color: "var(--danger)", margin: "12px 0 0" }}>
              <Icon name="circle-exclamation" size={13} style={{ marginRight: 6 }} />{erro}
            </p>
          )}

          <button
            type="submit" className="btn-primary"
            style={{ marginTop: 18, width: "100%", justifyContent: "center" }}
            disabled={invalido || carregando} aria-busy={carregando}
            aria-describedby={invalido ? "login-hint" : undefined}
          >
            {carregando
              ? <><Icon name="spinner" size={15} style={{ animation: "fa-spin 1s linear infinite" }} /> Entrando...</>
              : <><Icon name="right-to-bracket" size={15} /> Entrar</>}
          </button>
          {invalido && (
            <p id="login-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>
              Preencha e-mail e senha para entrar.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
