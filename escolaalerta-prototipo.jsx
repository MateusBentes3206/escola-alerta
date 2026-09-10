import { useState } from "react";
import {
  LogIn, School, Users, Plus, ArrowLeft, AlertTriangle, CheckCircle2,
  BookOpen, CalendarX, MessageSquareWarning, DoorOpen, ChevronRight,
  ClipboardList, Lightbulb, History, LogOut, X, Info, Trash2, Pencil, Sun, Moon
} from "lucide-react";

/* ---------------------------------------------------------
   EscolaAlerta — Protótipo de front-end (MVP)
   Sem conexão real com back-end: estado local simula a API
   e o motor de regras (correlação temporal) descrito no
   pré-projeto do TCC.
--------------------------------------------------------- */

const TABS = {
  nota: { label: "Notas", color: "#2F6193", icon: BookOpen },
  falta: { label: "Frequência", color: "#96681C", icon: CalendarX },
  ocorrencia: { label: "Ocorrências", color: "#C44536", icon: MessageSquareWarning },
  saida: { label: "Saídas", color: "#436E42", icon: DoorOpen },
};

const SUGESTOES = {
  faltas: [
    "Agendar conversa com a família sobre a rotina de frequência.",
    "Verificar se há barreiras de transporte, saúde ou apoio em casa.",
  ],
  notas: [
    "Encaminhar para reforço escolar na disciplina em queda.",
    "Agendar atendimento pedagógico individual nas próximas duas semanas.",
  ],
  ocorrencias: [
    "Encaminhar para escuta com a orientação educacional.",
    "Construir, junto ao aluno, um plano de convivência de curto prazo.",
  ],
};

const CAUSA_LABEL = { faltas: "Frequência", notas: "Notas", ocorrencias: "Ocorrências" };

function uid() {
  return Math.random().toString(36).slice(2, 9);
}

const CAMPO_POR_TIPO = { nota: "notas", falta: "faltas", ocorrencia: "ocorrencias", saida: "saidas" };

function classificarRisco(aluno) {
  const nFaltas = aluno.faltas.length;
  const nOcorrencias = aluno.ocorrencias.length;
  const nNotasBaixas = aluno.notas.filter((n) => n.valor < 6).length;

  const causas = [];
  if (nOcorrencias >= 3) causas.push({ tipo: "ocorrencias", peso: 3 });
  else if (nOcorrencias >= 1) causas.push({ tipo: "ocorrencias", peso: 1 });

  if (nFaltas >= 5) causas.push({ tipo: "faltas", peso: 3 });
  else if (nFaltas >= 3) causas.push({ tipo: "faltas", peso: 2 });
  else if (nFaltas >= 1) causas.push({ tipo: "faltas", peso: 1 });

  if (nNotasBaixas >= 2) causas.push({ tipo: "notas", peso: 3 });
  else if (nNotasBaixas === 1) causas.push({ tipo: "notas", peso: 1 });

  if (causas.length === 0) return { nivel: "baixo", causaPrincipal: null };

  const maxPeso = Math.max(...causas.map((c) => c.peso));
  const causaPrincipal = causas.find((c) => c.peso === maxPeso).tipo;
  const nivel = maxPeso >= 3 ? "alto" : maxPeso === 2 ? "moderado" : "baixo";
  return { nivel, causaPrincipal };
}

const RISCO_STYLE = {
  baixo: { cor: "var(--risco-baixo)", bg: "var(--risco-baixo-bg)", border: "var(--risco-baixo-border)", label: "Risco baixo" },
  moderado: { cor: "var(--risco-moderado)", bg: "var(--risco-moderado-bg)", border: "var(--risco-moderado-border)", label: "Risco moderado" },
  alto: { cor: "var(--risco-alto)", bg: "var(--risco-alto-bg)", border: "var(--risco-alto-border)", label: "Risco alto" },
};

/* ---------------- dados iniciais (mock) ---------------- */

const ALUNO_DEMO_ID = "a1";

function dadosIniciais() {
  return [
    {
      id: ALUNO_DEMO_ID,
      nome: "Rafael Costa Lima",
      turma: "8º ano B",
      responsavel: "Beatriz Lima",
      notas: [
        { id: uid(), disciplina: "Matemática", valor: 5.2, periodo: "3º bimestre" },
        { id: uid(), disciplina: "Português", valor: 5.8, periodo: "3º bimestre" },
      ],
      faltas: [
        { id: uid(), data: "12/08", justificada: false },
        { id: uid(), data: "14/08", justificada: false },
        { id: uid(), data: "19/08", justificada: false },
      ],
      ocorrencias: [
        { id: uid(), descricao: "Não entregou trabalho em grupo", gravidade: "leve" },
      ],
      saidas: [],
      planoAcao: null,
      feedbacks: [],
    },
    {
      id: "a2",
      nome: "Ana Beatriz Souza",
      turma: "7º ano A",
      responsavel: "Marcos Souza",
      notas: [{ id: uid(), disciplina: "Ciências", valor: 8.4, periodo: "3º bimestre" }],
      faltas: [],
      ocorrencias: [],
      saidas: [],
      planoAcao: null,
      feedbacks: [],
    },
    {
      id: "a3",
      nome: "Diego Matos Pereira",
      turma: "9º ano C",
      responsavel: "Sandra Matos",
      notas: [],
      faltas: [{ id: uid(), data: "02/09", justificada: true }],
      ocorrencias: [],
      saidas: [],
      planoAcao: null,
      feedbacks: [],
    },
  ];
}

/* ---------------------- shell / navegação ---------------------- */

export default function App() {
  const [alunos, setAlunos] = useState(dadosIniciais);
  const [perfil, setPerfil] = useState(null); // 'orientador' | 'responsavel'
  const [tela, setTela] = useState("login");
  const [alunoSelecionado, setAlunoSelecionado] = useState(null);
  const [toast, setToast] = useState(null);
  const [tema, setTema] = useState("escuro");

  function alternarTema() {
    setTema((t) => (t === "escuro" ? "claro" : "escuro"));
  }

  function mostrarToast(msg) {
    setToast(msg);
    setTimeout(() => setToast(null), 3200);
  }

  function atualizarAluno(id, updater) {
    setAlunos((prev) => prev.map((a) => (a.id === id ? updater(a) : a)));
  }

  function entrar(perfilEscolhido) {
    setPerfil(perfilEscolhido);
    if (perfilEscolhido === "orientador") {
      setTela("orientador-dashboard");
    } else {
      setAlunoSelecionado(ALUNO_DEMO_ID);
      setTela("responsavel-painel");
    }
  }

  function sair() {
    setPerfil(null);
    setAlunoSelecionado(null);
    setTela("login");
  }

  const aluno = alunos.find((a) => a.id === alunoSelecionado);

  return (
    <div data-theme={tema === "claro" ? "light" : undefined} style={{ fontFamily: "'IBM Plex Sans', sans-serif", background: "var(--bg)", minHeight: "100%", color: "var(--text)" }}>
      <GlobalStyle />
      <a href="#main-content" className="skip-link">Pular para o conteúdo</a>
      {tela !== "login" && (
        <TopBar
          perfil={perfil}
          tema={tema}
          onAlternarTema={alternarTema}
          onVoltar={
            tela === "orientador-dashboard" || tela === "responsavel-painel"
              ? null
              : () => setTela(perfil === "orientador" ? "orientador-dashboard" : "responsavel-painel")
          }
          onSair={sair}
        />
      )}

      {tela === "login" && <Login onEntrar={entrar} tema={tema} onAlternarTema={alternarTema} />}

      {tela === "orientador-dashboard" && (
        <OrientadorDashboard
          alunos={alunos}
          onNovoAluno={() => setTela("orientador-cadastro")}
          onAbrirAluno={(id) => {
            setAlunoSelecionado(id);
            setTela("orientador-indicador");
          }}
        />
      )}

      {tela === "orientador-cadastro" && (
        <CadastrarAluno
          onCancelar={() => setTela("orientador-dashboard")}
          onSalvar={(novo) => {
            const id = uid();
            setAlunos((prev) => [
              ...prev,
              { id, ...novo, notas: [], faltas: [], ocorrencias: [], saidas: [], planoAcao: null, feedbacks: [] },
            ]);
            mostrarToast(`Aluno ${novo.nome} cadastrado.`);
            setTela("orientador-dashboard");
          }}
        />
      )}

      {tela === "orientador-indicador" && aluno && (
        <RegistrarIndicador
          aluno={aluno}
          onVoltar={() => setTela("orientador-dashboard")}
          onRegistrar={(tipo, dados) => {
            atualizarAluno(aluno.id, (a) => {
              const campo = CAMPO_POR_TIPO[tipo];
              const atualizado = { ...a, [campo]: [...a[campo], { id: uid(), ...dados }] };
              const risco = classificarRisco(atualizado);
              if (risco.nivel !== "baixo" && risco.causaPrincipal) {
                atualizado.planoAcao = {
                  causa: risco.causaPrincipal,
                  sugestoes: SUGESTOES[risco.causaPrincipal],
                  nivel: risco.nivel,
                };
              }
              return atualizado;
            });
            mostrarToast("Indicador registrado. Risco recalculado pelo motor de regras.");
          }}
          onExcluir={(tipo, indicadorId) => {
            atualizarAluno(aluno.id, (a) => {
              const campo = CAMPO_POR_TIPO[tipo];
              const atualizado = { ...a, [campo]: a[campo].filter((item) => item.id !== indicadorId) };
              const risco = classificarRisco(atualizado);
              if (risco.nivel === "baixo") {
                atualizado.planoAcao = null;
              } else if (risco.causaPrincipal) {
                atualizado.planoAcao = {
                  causa: risco.causaPrincipal,
                  sugestoes: SUGESTOES[risco.causaPrincipal],
                  nivel: risco.nivel,
                };
              }
              return atualizado;
            });
            mostrarToast("Registro excluído. Risco recalculado pelo motor de regras.");
          }}
          onEditar={(tipo, indicadorId, novosDados) => {
            atualizarAluno(aluno.id, (a) => {
              const campo = CAMPO_POR_TIPO[tipo];
              const atualizado = {
                ...a,
                [campo]: a[campo].map((item) => (item.id === indicadorId ? { ...item, ...novosDados } : item)),
              };
              const risco = classificarRisco(atualizado);
              if (risco.nivel === "baixo") {
                atualizado.planoAcao = null;
              } else if (risco.causaPrincipal) {
                atualizado.planoAcao = {
                  causa: risco.causaPrincipal,
                  sugestoes: SUGESTOES[risco.causaPrincipal],
                  nivel: risco.nivel,
                };
              }
              return atualizado;
            });
            mostrarToast("Registro atualizado. Risco recalculado pelo motor de regras.");
          }}
        />
      )}

      {tela === "responsavel-painel" && aluno && (
        <PainelResponsavel
          aluno={aluno}
          onVerPlano={() => setTela("responsavel-plano")}
        />
      )}

      {tela === "responsavel-plano" && aluno && (
        <PlanoDeAcao
          aluno={aluno}
          onVoltar={() => setTela("responsavel-painel")}
          onFeedback={(status, observacao) => {
            atualizarAluno(aluno.id, (a) => ({
              ...a,
              feedbacks: [...a.feedbacks, { id: uid(), status, observacao, data: "hoje" }],
            }));
            mostrarToast("Feedback registrado. Obrigado por acompanhar!");
          }}
        />
      )}

      {toast && <Toast texto={toast} onFechar={() => setToast(null)} />}
    </div>
  );
}

/* ---------------------- componentes de layout ---------------------- */

function TopBar({ perfil, onVoltar, onSair, tema, onAlternarTema }) {
  return (
    <header style={{ background: "var(--bg)", color: "var(--text)", padding: "14px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", position: "sticky", top: 0, zIndex: 10, borderBottom: "1px solid var(--border)" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {onVoltar ? (
          <button onClick={onVoltar} className="icon-btn" aria-label="Voltar">
            <ArrowLeft size={19} />
          </button>
        ) : (
          <School size={20} color="var(--accent)" />
        )}
        <div>
          <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 17, lineHeight: 1 }}>EscolaAlerta</div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
            {perfil === "orientador" ? "Orientação escolar" : "Área do responsável"}
          </div>
        </div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={onAlternarTema} className="icon-btn" aria-label={tema === "claro" ? "Ativar modo escuro" : "Ativar modo claro"}>
          {tema === "claro" ? <Moon size={15} /> : <Sun size={15} />}
        </button>
        <button onClick={onSair} className="icon-btn" aria-label="Sair" style={{ borderColor: "var(--danger-border)", color: "var(--danger)" }}>
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}

function Toast({ texto, onFechar }) {
  return (
    <div className="toast" style={{
      position: "fixed", left: "50%", bottom: 22, transform: "translateX(-50%)",
      background: "var(--surface-2)", color: "var(--text)", padding: "12px 18px", borderRadius: 10,
      border: "1px solid var(--border-strong)",
      display: "flex", alignItems: "center", gap: 10, boxShadow: "0 1px 2px rgba(0,0,0,.5), 0 12px 28px rgba(0,0,0,.4)",
      maxWidth: "min(90vw, 420px)", zIndex: 50, fontSize: 14,
    }} role="status" aria-live="polite">
      <CheckCircle2 size={18} color="var(--success)" style={{ flexShrink: 0 }} />
      <span>{texto}</span>
      <button onClick={onFechar} style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", marginLeft: 4 }}>
        <X size={15} />
      </button>
    </div>
  );
}

function Page({ children, max = 640 }) {
  return <main id="main-content" style={{ maxWidth: max, margin: "0 auto", padding: "28px 20px 60px" }}>{children}</main>;
}

function ExplicacaoRisco() {
  return (
    <details style={{ marginTop: 12 }}>
      <summary style={{ cursor: "pointer", fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", userSelect: "none", display: "flex", alignItems: "center", gap: 6 }}>
        <Info size={13} />
        Como o risco é calculado?
      </summary>
      <p style={{ fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.6, marginTop: 8, marginBottom: 0 }}>
        O nível é calculado a partir de três sinais — <strong style={{ color: "var(--text)" }}>notas abaixo de 6</strong>, <strong style={{ color: "var(--text)" }}>faltas</strong> e <strong style={{ color: "var(--text)" }}>ocorrências</strong> — cada um com um peso que cresce conforme a quantidade registrada. O sinal de maior peso define o nível (baixo, moderado ou alto) e se torna a causa principal do plano de ação.
      </p>
    </details>
  );
}

/* ---------------------- LOGIN ---------------------- */

function Login({ onEntrar, tema, onAlternarTema }) {
  return (
    <main id="main-content" style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, position: "relative" }}>
      <button
        onClick={onAlternarTema} className="icon-btn"
        aria-label={tema === "claro" ? "Ativar modo escuro" : "Ativar modo claro"}
        style={{ position: "absolute", top: 20, right: 20, color: "var(--text-muted)", borderColor: "var(--border-strong)" }}
      >
        {tema === "claro" ? <Moon size={15} /> : <Sun size={15} />}
      </button>
      <div style={{ width: "100%", maxWidth: 420 }}>
        <div style={{ textAlign: "center", marginBottom: 34 }}>
          <div style={{
            width: 56, height: 56, borderRadius: 12, background: "var(--accent)", color: "#fff",
            boxShadow: "0 8px 20px var(--accent-glow-strong)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <School size={28} />
          </div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 28, margin: 0 }}>EscolaAlerta</h1>
          <p style={{ color: "var(--text-muted)", fontSize: 14, marginTop: 8, lineHeight: 1.5 }}>
            Acompanhamento acadêmico e comportamental para famílias e escola, com alerta antecipado de risco.
          </p>
        </div>

        <div className="card" style={{ padding: 22 }}>
          <label className="field-label" htmlFor="login-email">E-mail</label>
          <input id="login-email" className="field" type="email" autoComplete="email" placeholder="voce@escola.com.br" defaultValue="camila.duarte@escola.com.br" />
          <label className="field-label" htmlFor="login-senha" style={{ marginTop: 14 }}>Senha</label>
          <input id="login-senha" className="field" type="password" autoComplete="current-password" defaultValue="••••••••" />

          <p style={{ fontSize: 12, color: "var(--text-faint)", margin: "14px 0 4px", fontFamily: "'Kalam', cursive" }}>
            protótipo — escolha um perfil para entrar
          </p>

          <div style={{ display: "grid", gap: 10, marginTop: 6 }}>
            <button className="btn-primary" onClick={() => onEntrar("orientador")}>
              <LogIn size={17} /> Entrar como orientador escolar
            </button>
            <button className="btn-secondary" onClick={() => onEntrar("responsavel")}>
              <Users size={17} /> Entrar como responsável
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

/* ---------------------- ORIENTADOR: dashboard ---------------------- */

function OrientadorDashboard({ alunos, onNovoAluno, onAbrirAluno }) {
  const [busca, setBusca] = useState("");
  const [filtroRisco, setFiltroRisco] = useState("todos");

  const alunosComRisco = alunos.map((aluno) => ({ aluno, nivel: classificarRisco(aluno).nivel }));
  const alunosFiltrados = alunosComRisco.filter(({ aluno, nivel }) => {
    const combinaBusca = aluno.nome.toLowerCase().includes(busca.trim().toLowerCase());
    const combinaRisco = filtroRisco === "todos" || nivel === filtroRisco;
    return combinaBusca && combinaRisco;
  });
  const filtroAtivo = busca.trim() !== "" || filtroRisco !== "todos";

  return (
    <Page max={760}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 22, gap: 12, flexWrap: "wrap" }}>
        <div>
          <div className="eyebrow">turma sob acompanhamento</div>
          <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 26, margin: "4px 0 0" }}>
            Seus alunos
          </h1>
        </div>
        <button className="btn-primary" onClick={onNovoAluno}>
          <Plus size={17} /> Cadastrar aluno
        </button>
      </div>

      <div style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 200px" }}>
          <label className="field-label" htmlFor="busca-aluno">Buscar por nome</label>
          <input
            id="busca-aluno" className="field" value={busca} onChange={(e) => setBusca(e.target.value)}
            placeholder="ex.: Rafael" autoComplete="off"
          />
        </div>
        <div style={{ flex: "0 1 180px" }}>
          <label className="field-label" htmlFor="filtro-risco">Nível de risco</label>
          <select id="filtro-risco" className="field" value={filtroRisco} onChange={(e) => setFiltroRisco(e.target.value)}>
            <option value="todos">Todos</option>
            <option value="alto">Risco alto</option>
            <option value="moderado">Risco moderado</option>
            <option value="baixo">Risco baixo</option>
          </select>
        </div>
      </div>

      {alunosFiltrados.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>
          Nenhum aluno encontrado{filtroAtivo ? " com esse filtro." : "."}
        </p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 12 }}>
          {alunosFiltrados.map(({ aluno, nivel }) => {
            const rs = RISCO_STYLE[nivel];
            return (
              <li key={aluno.id}>
                <button onClick={() => onAbrirAluno(aluno.id)} className="row-card">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15.5 }}>{aluno.nome}</div>
                    <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{aluno.turma} · resp.: {aluno.responsavel}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span className="risk-badge" style={{ background: rs.bg, color: rs.cor, border: `1px solid ${rs.border}`, fontSize: 12.5, padding: "5px 11px" }}>
                      {rs.label}
                    </span>
                    <ChevronRight size={18} color="var(--text-faint)" />
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </Page>
  );
}

/* ---------------------- ORIENTADOR: cadastrar aluno ---------------------- */

function CadastrarAluno({ onCancelar, onSalvar }) {
  const [nome, setNome] = useState("");
  const [turma, setTurma] = useState("");
  const [responsavel, setResponsavel] = useState("");

  return (
    <Page max={520}>
      <div className="eyebrow">novo cadastro</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: "4px 0 20px" }}>
        Cadastrar aluno
      </h1>

      <form
        className="card" style={{ padding: 20 }}
        onSubmit={(e) => {
          e.preventDefault();
          if (!nome || !turma) return;
          onSalvar({ nome, turma, responsavel: responsavel || "—" });
        }}
      >
        <label className="field-label" htmlFor="aluno-nome">Nome completo</label>
        <input id="aluno-nome" className="field" value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome do aluno" />

        <label className="field-label" htmlFor="aluno-turma" style={{ marginTop: 14 }}>Turma</label>
        <input id="aluno-turma" className="field" value={turma} onChange={(e) => setTurma(e.target.value)} placeholder="ex.: 7º ano A" />

        <label className="field-label" htmlFor="aluno-responsavel" style={{ marginTop: 14 }}>Responsável vinculado</label>
        <input id="aluno-responsavel" className="field" value={responsavel} onChange={(e) => setResponsavel(e.target.value)} placeholder="Nome do responsável" />

        <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
          <button type="button" className="btn-ghost" onClick={onCancelar} style={{ flex: 1 }}>Cancelar</button>
          <button
            type="submit" className="btn-primary" style={{ flex: 1, justifyContent: "center" }}
            disabled={!nome || !turma} aria-describedby={!nome || !turma ? "aluno-hint" : undefined}
          >
            Salvar
          </button>
        </div>
        {(!nome || !turma) && (
          <p id="aluno-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 10 }}>Preencha nome e turma para habilitar o cadastro.</p>
        )}
      </form>
    </Page>
  );
}

/* ---------------------- ORIENTADOR: registrar indicador ---------------------- */

function RegistrarIndicador({ aluno, onRegistrar, onEditar, onExcluir }) {
  const [tab, setTab] = useState("nota");
  const risco = classificarRisco(aluno);
  const rs = RISCO_STYLE[risco.nivel];

  return (
    <Page max={640}>
      <div className="eyebrow">registro de indicador</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: "4px 0 4px" }}>
        {aluno.nome}
      </h1>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13.5, color: "var(--text-muted)" }}>{aluno.turma}</span>
        <span className="risk-badge" style={{ background: rs.bg, color: rs.cor, border: `1px solid ${rs.border}`, fontSize: 12, padding: "3px 10px" }}>
          {rs.label}
        </span>
      </div>
      <div style={{ marginBottom: 20 }}><ExplicacaoRisco /></div>

      <div className="tabs">
        {Object.entries(TABS).map(([key, t]) => {
          const Icon = t.icon;
          const ativo = tab === key;
          return (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={ativo ? "tab" : "tab is-inactive"}
              style={{
                background: ativo ? t.color : "transparent",
                color: ativo ? "#fff" : "var(--text-muted)",
                borderColor: t.color,
              }}
            >
              <Icon size={15} /> {t.label}
            </button>
          );
        })}
      </div>

      <div className="card" style={{ padding: 20, borderTop: `3px solid ${TABS[tab].color}` }}>
        {tab === "nota" && <FormNota onSalvar={(d) => onRegistrar("nota", d)} />}
        {tab === "falta" && <FormFalta onSalvar={(d) => onRegistrar("falta", d)} />}
        {tab === "ocorrencia" && <FormOcorrencia onSalvar={(d) => onRegistrar("ocorrencia", d)} />}
        {tab === "saida" && <FormSaida onSalvar={(d) => onRegistrar("saida", d)} />}
      </div>

      <HistoricoIndicadores aluno={aluno} onEditar={onEditar} onExcluir={onExcluir} />
    </Page>
  );
}

function FormNota({ onSalvar }) {
  const [disciplina, setDisciplina] = useState("");
  const [valor, setValor] = useState("");
  const [periodo, setPeriodo] = useState("3º bimestre");
  const valorNum = parseFloat(valor);
  const foraDaFaixa = valor !== "" && (Number.isNaN(valorNum) || valorNum < 0 || valorNum > 10);
  const invalido = !disciplina || valor === "" || foraDaFaixa;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (invalido) return;
        onSalvar({ disciplina, valor: parseFloat(valor), periodo });
      }}
    >
      <label className="field-label" htmlFor="nota-disciplina">Disciplina</label>
      <input id="nota-disciplina" className="field" value={disciplina} onChange={(e) => setDisciplina(e.target.value)} placeholder="ex.: Matemática" />
      <div style={{ display: "flex", gap: 12, marginTop: 14 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="nota-valor">Nota (0–10)</label>
          <input
            id="nota-valor" className="field" type="number" min="0" max="10" step="0.1"
            value={valor} onChange={(e) => setValor(e.target.value)}
            aria-invalid={foraDaFaixa} aria-describedby={foraDaFaixa ? "nota-valor-erro" : undefined}
          />
          {foraDaFaixa && (
            <p id="nota-valor-erro" style={{ fontSize: 12, color: "var(--danger)", marginTop: 6 }}>A nota deve estar entre 0 e 10.</p>
          )}
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="nota-periodo">Período</label>
          <select id="nota-periodo" className="field" value={periodo} onChange={(e) => setPeriodo(e.target.value)}>
            <option>1º bimestre</option><option>2º bimestre</option><option>3º bimestre</option><option>4º bimestre</option>
          </select>
        </div>
      </div>
      <button
        type="submit" className="btn-primary" style={{ marginTop: 18, justifyContent: "center", width: "100%" }}
        disabled={invalido} aria-describedby={invalido && !foraDaFaixa ? "nota-hint" : undefined}
      >
        Registrar nota
      </button>
      {invalido && !foraDaFaixa && (
        <p id="nota-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>Preencha disciplina e nota para habilitar o registro.</p>
      )}
    </form>
  );
}

function FormFalta({ onSalvar }) {
  const [data, setData] = useState("");
  const [justificada, setJustificada] = useState(false);
  const [comprovante, setComprovante] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!data) return;
        onSalvar({ data: formatarData(data), justificada, comprovante: justificada ? comprovante : "" });
      }}
    >
      <label className="field-label" htmlFor="falta-data">Data</label>
      <input id="falta-data" className="field" type="date" value={data} onChange={(e) => setData(e.target.value)} />
      <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 14, fontSize: 14 }}>
        <input type="checkbox" checked={justificada} onChange={(e) => setJustificada(e.target.checked)} />
        Falta justificada
      </label>
      {justificada && (
        <div style={{ marginTop: 14 }}>
          <label className="field-label" htmlFor="falta-comprovante">Observação / comprovante</label>
          <textarea
            id="falta-comprovante" className="field" rows={2}
            value={comprovante} onChange={(e) => setComprovante(e.target.value)}
            placeholder="ex.: atestado médico anexado, consulta em 12/08"
          />
          <p style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 6 }}>
            Registre aqui o motivo e a data do comprovante — evita depender de conversas ou papéis avulsos guardados fora do sistema.
          </p>
        </div>
      )}
      <button
        type="submit" className="btn-primary" style={{ marginTop: 18, justifyContent: "center", width: "100%" }}
        disabled={!data} aria-describedby={!data ? "falta-hint" : undefined}
      >
        Registrar falta
      </button>
      {!data && (
        <p id="falta-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>Selecione a data para habilitar o registro.</p>
      )}
    </form>
  );
}

function FormOcorrencia({ onSalvar }) {
  const [descricao, setDescricao] = useState("");
  const [gravidade, setGravidade] = useState("leve");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!descricao) return;
        onSalvar({ descricao, gravidade });
      }}
    >
      <label className="field-label" htmlFor="ocorrencia-descricao">Descrição</label>
      <textarea id="ocorrencia-descricao" className="field" rows={3} value={descricao} onChange={(e) => setDescricao(e.target.value)} placeholder="O que aconteceu?" />
      <label className="field-label" htmlFor="ocorrencia-gravidade" style={{ marginTop: 14 }}>Gravidade</label>
      <select id="ocorrencia-gravidade" className="field" value={gravidade} onChange={(e) => setGravidade(e.target.value)}>
        <option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option>
      </select>
      <button
        type="submit" className="btn-primary" style={{ marginTop: 18, justifyContent: "center", width: "100%" }}
        disabled={!descricao} aria-describedby={!descricao ? "ocorrencia-hint" : undefined}
      >
        Registrar ocorrência
      </button>
      {!descricao && (
        <p id="ocorrencia-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>Descreva o ocorrido para habilitar o registro.</p>
      )}
    </form>
  );
}

function FormSaida({ onSalvar }) {
  const [data, setData] = useState("");
  const [horario, setHorario] = useState("");
  const [motivo, setMotivo] = useState("");
  const invalido = !data || !motivo;
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (invalido) return;
        onSalvar({ data: formatarData(data), horario, motivo });
      }}
    >
      <div style={{ display: "flex", gap: 12 }}>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="saida-data">Data</label>
          <input id="saida-data" className="field" type="date" value={data} onChange={(e) => setData(e.target.value)} />
        </div>
        <div style={{ flex: 1 }}>
          <label className="field-label" htmlFor="saida-horario">Horário</label>
          <input id="saida-horario" className="field" type="time" value={horario} onChange={(e) => setHorario(e.target.value)} />
        </div>
      </div>
      <label className="field-label" htmlFor="saida-motivo" style={{ marginTop: 14 }}>Motivo</label>
      <input id="saida-motivo" className="field" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="ex.: consulta médica" />
      <button
        type="submit" className="btn-primary" style={{ marginTop: 18, justifyContent: "center", width: "100%" }}
        disabled={invalido} aria-describedby={invalido ? "saida-hint" : undefined}
      >
        Registrar saída
      </button>
      {invalido && (
        <p id="saida-hint" style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 8 }}>Preencha data e motivo para habilitar o registro.</p>
      )}
    </form>
  );
}

function formatarData(iso) {
  if (!iso) return "";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}`;
}

function EditorIndicador({ tipo, dados, onSalvar, onCancelar }) {
  const inputStyle = { flex: "1 1 120px" };

  if (tipo === "nota") {
    const [disciplina, setDisciplina] = useState(dados.disciplina);
    const [valor, setValor] = useState(String(dados.valor));
    const [periodo, setPeriodo] = useState(dados.periodo);
    const valorNum = parseFloat(valor);
    const foraDaFaixa = valor !== "" && (Number.isNaN(valorNum) || valorNum < 0 || valorNum > 10);
    const invalido = !disciplina || valor === "" || foraDaFaixa;
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <input className="field" style={inputStyle} value={disciplina} onChange={(e) => setDisciplina(e.target.value)} aria-label="Disciplina" />
          <input className="field" style={{ flex: "1 1 80px" }} type="number" min="0" max="10" step="0.1" value={valor} onChange={(e) => setValor(e.target.value)} aria-label="Nota" />
          <select className="field" style={inputStyle} value={periodo} onChange={(e) => setPeriodo(e.target.value)} aria-label="Período">
            <option>1º bimestre</option><option>2º bimestre</option><option>3º bimestre</option><option>4º bimestre</option>
          </select>
        </div>
        {foraDaFaixa && <p style={{ fontSize: 12, color: "var(--danger)", margin: 0 }}>A nota deve estar entre 0 e 10.</p>}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={invalido} onClick={() => onSalvar({ disciplina, valor: parseFloat(valor), periodo })} className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Salvar</button>
          <button type="button" onClick={onCancelar} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (tipo === "falta") {
    const [data, setData] = useState(dados.data);
    const [justificada, setJustificada] = useState(dados.justificada);
    const [comprovante, setComprovante] = useState(dados.comprovante || "");
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <input className="field" style={{ flex: "1 1 100px" }} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data (DD/MM)" placeholder="DD/MM" />
          <label style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13.5 }}>
            <input type="checkbox" checked={justificada} onChange={(e) => setJustificada(e.target.checked)} />
            Justificada
          </label>
        </div>
        {justificada && (
          <textarea className="field" rows={2} value={comprovante} onChange={(e) => setComprovante(e.target.value)} placeholder="Observação / comprovante" aria-label="Observação / comprovante" />
        )}
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={!data} onClick={() => onSalvar({ data, justificada, comprovante: justificada ? comprovante : "" })} className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Salvar</button>
          <button type="button" onClick={onCancelar} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Cancelar</button>
        </div>
      </div>
    );
  }

  if (tipo === "ocorrencia") {
    const [descricao, setDescricao] = useState(dados.descricao);
    const [gravidade, setGravidade] = useState(dados.gravidade);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
        <textarea className="field" rows={2} value={descricao} onChange={(e) => setDescricao(e.target.value)} aria-label="Descrição" />
        <select className="field" style={{ maxWidth: 160 }} value={gravidade} onChange={(e) => setGravidade(e.target.value)} aria-label="Gravidade">
          <option value="leve">Leve</option><option value="moderada">Moderada</option><option value="grave">Grave</option>
        </select>
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" disabled={!descricao} onClick={() => onSalvar({ descricao, gravidade })} className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Salvar</button>
          <button type="button" onClick={onCancelar} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Cancelar</button>
        </div>
      </div>
    );
  }

  // tipo === "saida"
  const [data, setData] = useState(dados.data);
  const [horario, setHorario] = useState(dados.horario);
  const [motivo, setMotivo] = useState(dados.motivo);
  const invalido = !data || !motivo;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, width: "100%" }}>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input className="field" style={{ flex: "1 1 100px" }} value={data} onChange={(e) => setData(e.target.value)} aria-label="Data (DD/MM)" placeholder="DD/MM" />
        <input className="field" style={{ flex: "1 1 100px" }} type="time" value={horario} onChange={(e) => setHorario(e.target.value)} aria-label="Horário" />
      </div>
      <input className="field" value={motivo} onChange={(e) => setMotivo(e.target.value)} aria-label="Motivo" />
      <div style={{ display: "flex", gap: 8 }}>
        <button type="button" disabled={invalido} onClick={() => onSalvar({ data, horario, motivo })} className="btn-primary" style={{ padding: "6px 14px", fontSize: 13 }}>Salvar</button>
        <button type="button" onClick={onCancelar} className="btn-ghost" style={{ padding: "6px 14px", fontSize: 13 }}>Cancelar</button>
      </div>
    </div>
  );
}

function HistoricoIndicadores({ aluno, onEditar, onExcluir }) {
  const [confirmando, setConfirmando] = useState(null);
  const [editando, setEditando] = useState(null);
  const itens = [
    ...aluno.notas.map((n) => ({ tipo: "nota", id: n.id, dados: n, texto: `${n.disciplina}: nota ${n.valor} (${n.periodo})` })),
    ...aluno.faltas.map((f) => ({
      tipo: "falta", id: f.id, dados: f,
      texto: `Falta em ${f.data}${f.justificada ? ` · justificada${f.comprovante ? ` (${f.comprovante})` : ""}` : ""}`,
    })),
    ...aluno.ocorrencias.map((o) => ({ tipo: "ocorrencia", id: o.id, dados: o, texto: `${o.descricao} · gravidade ${o.gravidade}` })),
    ...aluno.saidas.map((s) => ({ tipo: "saida", id: s.id, dados: s, texto: `Saída antecipada em ${s.data} às ${s.horario} · ${s.motivo}` })),
  ];
  return (
    <div style={{ marginTop: 26 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
        <History size={16} color="var(--text-muted)" />
        <span style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)" }}>Histórico registrado</span>
      </div>
      {itens.length === 0 ? (
        <p style={{ fontSize: 13.5, color: "var(--text-muted)" }}>Nenhum indicador registrado ainda para este aluno.</p>
      ) : (
        <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "grid", gap: 8 }}>
          {itens.map((it) => {
            const emEdicao = editando === it.id;
            return (
              <li
                key={it.id}
                style={{
                  display: "flex", alignItems: emEdicao ? "stretch" : "center", flexDirection: emEdicao ? "column" : "row",
                  gap: 10, fontSize: 13.5, background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 8, padding: "9px 12px",
                }}
              >
                {emEdicao ? (
                  <EditorIndicador
                    tipo={it.tipo}
                    dados={it.dados}
                    onSalvar={(novosDados) => { onEditar(it.tipo, it.id, novosDados); setEditando(null); }}
                    onCancelar={() => setEditando(null)}
                  />
                ) : confirmando === it.id ? (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: TABS[it.tipo].color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{it.texto}</span>
                    <span style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                      <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Excluir?</span>
                      <button
                        type="button"
                        onClick={() => { onExcluir(it.tipo, it.id); setConfirmando(null); }}
                        style={{ background: "none", border: "1px solid var(--danger-border)", color: "var(--danger)", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Sim
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmando(null)}
                        style={{ background: "none", border: "1px solid var(--border-strong)", color: "var(--text-muted)", borderRadius: 6, padding: "3px 9px", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
                      >
                        Não
                      </button>
                    </span>
                  </>
                ) : (
                  <>
                    <span style={{ width: 8, height: 8, borderRadius: 99, background: TABS[it.tipo].color, flexShrink: 0 }} />
                    <span style={{ flex: 1 }}>{it.texto}</span>
                    <span style={{ display: "flex", gap: 2, flexShrink: 0 }}>
                      {onEditar && (
                        <button
                          type="button"
                          onClick={() => { setEditando(it.id); setConfirmando(null); }}
                          aria-label={`Editar registro: ${it.texto}`}
                          style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, display: "flex" }}
                        >
                          <Pencil size={13} />
                        </button>
                      )}
                      {onExcluir && (
                        <button
                          type="button"
                          onClick={() => { setConfirmando(it.id); setEditando(null); }}
                          aria-label={`Excluir registro: ${it.texto}`}
                          style={{ background: "none", border: "none", color: "var(--text-faint)", cursor: "pointer", padding: 6, display: "flex" }}
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </span>
                  </>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/* ---------------------- RESPONSÁVEL: painel de risco ---------------------- */

function PainelResponsavel({ aluno, onVerPlano }) {
  const { nivel, causaPrincipal } = classificarRisco(aluno);
  const rs = RISCO_STYLE[nivel];
  const totalIndicadores = aluno.notas.length + aluno.faltas.length + aluno.ocorrencias.length + aluno.saidas.length;

  return (
    <Page>
      <div className="eyebrow">painel de risco</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: "4px 0 22px" }}>
        Olá, {aluno.responsavel.split(" ")[0]}
      </h1>

      <div className="card" style={{ padding: 24, borderLeft: `3px solid ${rs.cor}` }}>
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>{aluno.nome} · {aluno.turma}</div>
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
          {nivel !== "baixo" && <AlertTriangle size={22} color={rs.cor} />}
          <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 22, color: rs.cor }}>
            {rs.label}
          </span>
        </div>
        {nivel !== "baixo" && causaPrincipal && (
          <p style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 6 }}>
            Motivo principal: <strong style={{ color: "var(--text)" }}>{CAUSA_LABEL[causaPrincipal]}</strong>
          </p>
        )}
        <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.55 }}>
          {nivel === "baixo"
            ? "Nenhum sinal de risco identificado no momento. Continue acompanhando por aqui."
            : "O motor de correlação identificou um padrão que pede atenção. Veja o plano de ação sugerido pela escola."}
        </p>
        {nivel !== "baixo" && (
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={onVerPlano}>
            <ClipboardList size={17} /> Ver plano de ação
          </button>
        )}
        <ExplicacaoRisco />
      </div>

      <div style={{ marginTop: 26 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 10 }}>
          Histórico de acompanhamento ({totalIndicadores} registros)
        </div>
        <HistoricoIndicadores aluno={aluno} />
      </div>
    </Page>
  );
}

/* ---------------------- RESPONSÁVEL: plano de ação ---------------------- */

function PlanoDeAcao({ aluno, onFeedback }) {
  const [status, setStatus] = useState("em_andamento");
  const [observacao, setObservacao] = useState("");
  const [enviado, setEnviado] = useState(false);
  const plano = aluno.planoAcao;

  if (!plano) {
    return (
      <Page>
        <p style={{ color: "var(--text-muted)" }}>Nenhum plano de ação ativo no momento.</p>
      </Page>
    );
  }

  return (
    <Page>
      <div className="eyebrow">sugestão pedagógica</div>
      <h1 style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 24, margin: "4px 0 6px" }}>
        Plano de ação — {aluno.nome}
      </h1>
      <p style={{ fontSize: 13.5, color: "var(--text-muted)", marginBottom: 20 }}>
        Causa principal identificada: <strong style={{ color: "var(--text)" }}>{CAUSA_LABEL[plano.causa]}</strong>
      </p>

      <div className="card" style={{ padding: 20 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
          <Lightbulb size={18} color="var(--warning)" />
          <span style={{ fontWeight: 600, fontSize: 14.5 }}>Sugestões da matriz pedagógica</span>
        </div>
        <div style={{ display: "grid", gap: 10 }}>
          {plano.sugestoes.map((s, i) => (
            <div key={i} className="sticky-note">
              {s}
            </div>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 20, marginTop: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14.5, marginBottom: 12 }}>Registrar feedback de resolução</div>
        {enviado ? (
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--success)", fontSize: 14 }}>
            <CheckCircle2 size={18} /> Feedback enviado. Obrigado por acompanhar!
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              onFeedback(status, observacao);
              setEnviado(true);
            }}
          >
            <label className="field-label" htmlFor="plano-status">Status</label>
            <select id="plano-status" className="field" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="em_andamento">Em andamento</option>
              <option value="resolvido">Resolvido</option>
            </select>
            <label className="field-label" htmlFor="plano-observacao" style={{ marginTop: 14 }}>Observação</label>
            <textarea id="plano-observacao" className="field" rows={3} value={observacao} onChange={(e) => setObservacao(e.target.value)} placeholder="Conte como está o acompanhamento em casa..." />
            <button type="submit" className="btn-primary" style={{ marginTop: 16, justifyContent: "center", width: "100%" }}>
              Enviar feedback
            </button>
          </form>
        )}

        {aluno.feedbacks.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--border)", paddingTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-muted)", marginBottom: 8 }}>FEEDBACKS ANTERIORES</div>
            {aluno.feedbacks.map((f) => (
              <div key={f.id} style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 6 }}>
                <strong style={{ color: "var(--text)" }}>{f.status === "resolvido" ? "Resolvido" : "Em andamento"}:</strong> {f.observacao || "—"}
              </div>
            ))}
          </div>
        )}
      </div>
    </Page>
  );
}

/* ---------------------- estilo global ---------------------- */

function GlobalStyle() {
  return (
    <style>{`
      @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=IBM+Plex+Sans:wght@400;500;600&family=Kalam:wght@400;700&display=swap');

      :root {
        --bg: #0B0D10;
        --surface: #16181D;
        --surface-2: #1D2026;
        --border: rgba(255,255,255,.08);
        --border-strong: rgba(255,255,255,.16);
        --text: #F4F5F7;
        --text-muted: #9AA1AC;
        --text-faint: #6B7280;
        --accent: #3D6BC7;
        --accent-hover: #4A78D6;
        --accent-glow: rgba(61,107,199,.28);
        --accent-glow-strong: rgba(61,107,199,.35);
        --success: #34D399;
        --warning: #FBBF24;
        --danger: #F87171;
        --danger-border: rgba(248,113,113,.4);
        --sticky-bg: #362F1E;
        --sticky-border: rgba(251,191,36,.28);
        --sticky-text: #E8D9B8;
        --risco-baixo: #34D399;
        --risco-baixo-bg: #1B3A33;
        --risco-baixo-border: rgba(52,211,153,.35);
        --risco-moderado: #FBBF24;
        --risco-moderado-bg: #3F361E;
        --risco-moderado-border: rgba(251,191,36,.35);
        --risco-alto: #F87171;
        --risco-alto-bg: #3F282C;
        --risco-alto-border: rgba(248,113,113,.35);
      }

      [data-theme="light"] {
        --bg: #F6F3EC;
        --surface: #FFFFFF;
        --surface-2: #FCFAF5;
        --border: #E4DECE;
        --border-strong: #D9D2BF;
        --text: #23303A;
        --text-muted: #5C6B78;
        --text-faint: #6B604A;
        --accent: #223A5E;
        --accent-hover: #2C4A73;
        --accent-glow: rgba(34,58,94,.22);
        --accent-glow-strong: rgba(34,58,94,.3);
        --success: #2F6B3D;
        --warning: #8F5E0C;
        --danger: #A8382B;
        --danger-border: rgba(168,56,43,.4);
        --sticky-bg: #FCF3D9;
        --sticky-border: #E9D9A0;
        --sticky-text: #4A4022;
        --risco-baixo: #2F6B3D;
        --risco-baixo-bg: #EAF2EA;
        --risco-baixo-border: rgba(47,107,61,.35);
        --risco-moderado: #8F5E0C;
        --risco-moderado-bg: #FBF1DF;
        --risco-moderado-border: rgba(143,94,12,.35);
        --risco-alto: #A8382B;
        --risco-alto-bg: #FBE9E6;
        --risco-alto-border: rgba(168,56,43,.35);
      }

      * { box-sizing: border-box; }

      body {
        font-variant-numeric: tabular-nums;
      }

      h1 { letter-spacing: -0.01em; text-wrap: balance; color: var(--text); }

      .skip-link {
        position: absolute; left: 12px; top: -48px;
        background: var(--accent); color: #fff; padding: 10px 16px;
        border-radius: 8px; font-weight: 700; font-size: 13px;
        text-decoration: none; z-index: 100; transition: top .15s ease;
        box-shadow: 0 4px 14px rgba(0,0,0,.4);
      }
      .skip-link:focus { top: 12px; }

      .eyebrow {
        font-family: 'Kalam', cursive;
        font-size: 13.5px;
        color: var(--text-faint);
      }

      .card {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        box-shadow: 0 1px 2px rgba(0,0,0,.5), 0 12px 28px rgba(0,0,0,.35);
      }

      .row-card {
        display: flex;
        align-items: center;
        justify-content: space-between;
        width: 100%;
        text-align: left;
        padding: 16px 18px;
        cursor: pointer;
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: 12px;
        color: var(--text);
        font-family: inherit;
        box-shadow: 0 1px 2px rgba(0,0,0,.4);
        transition: transform .15s ease, box-shadow .15s ease, border-color .15s ease, background .15s ease;
      }
      .row-card:hover { border-color: var(--border-strong); background: var(--surface-2); transform: translateY(-1px); box-shadow: 0 10px 24px rgba(0,0,0,.4); }
      .row-card:active { transform: translateY(0); box-shadow: 0 1px 2px rgba(0,0,0,.4); }

      .field-label {
        display: block;
        font-size: 11.5px;
        font-weight: 600;
        color: var(--text-muted);
        margin-bottom: 6px;
        text-transform: uppercase;
        letter-spacing: .04em;
      }

      .field {
        width: 100%;
        border: 1px solid var(--border-strong);
        background: var(--surface-2);
        border-radius: 8px;
        padding: 10px 12px;
        font-size: 14px;
        font-family: inherit;
        color: var(--text);
      }
      .field::placeholder { color: var(--text-faint); }
      .field:focus {
        outline: none;
        border-color: var(--accent);
        box-shadow: 0 0 0 3px var(--accent-glow);
        background: var(--surface-2);
      }

      .btn-primary {
        display: inline-flex; align-items: center; gap: 8px;
        background: var(--accent); color: #fff; border: 1px solid rgba(0,0,0,.2);
        padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
        cursor: pointer; box-shadow: 0 1px 2px rgba(0,0,0,.4);
        transition: transform .15s ease, box-shadow .15s ease, background .15s ease;
      }
      .btn-primary:hover { background: var(--accent-hover); transform: translateY(-1px); box-shadow: 0 8px 20px var(--accent-glow-strong); }
      .btn-primary:active { transform: translateY(0); box-shadow: 0 1px 2px rgba(0,0,0,.4); }
      .btn-primary:disabled { opacity: .4; box-shadow: none; transform: none; cursor: not-allowed; }

      .btn-secondary {
        display: inline-flex; align-items: center; justify-content: center; gap: 8px;
        background: transparent; color: var(--text); border: 1px solid var(--border-strong);
        padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
        cursor: pointer; transition: background .15s ease, border-color .15s ease;
      }
      .btn-secondary:hover { background: var(--surface-2); border-color: rgba(255,255,255,.24); }

      .btn-ghost {
        background: transparent; border: 1px solid var(--border); color: var(--text-muted);
        padding: 10px 18px; border-radius: 8px; font-size: 14px; font-weight: 600;
        cursor: pointer; transition: background .15s ease, color .15s ease;
      }
      .btn-ghost:hover { background: var(--surface-2); color: var(--text); }

      .icon-btn {
        background: transparent; border: 1px solid var(--border-strong); color: var(--text);
        width: 34px; height: 34px; border-radius: 8px;
        display: flex; align-items: center; justify-content: center; cursor: pointer;
        transition: background .15s ease;
      }
      .icon-btn:hover { background: rgba(255,255,255,.08); }

      .tabs {
        display: flex; gap: 6px; margin-bottom: 14px; overflow-x: auto; padding-bottom: 2px;
      }
      .tab {
        display: inline-flex; align-items: center; gap: 6px; white-space: nowrap;
        border: 1px solid; border-radius: 8px;
        padding: 8px 14px; font-size: 13.5px; font-weight: 600;
        cursor: pointer; transition: background .12s ease, color .12s ease;
      }
      .tab.is-inactive:hover { background: var(--surface-2) !important; color: var(--text) !important; }

      @keyframes toast-in {
        from { opacity: 0; transform: translate(-50%, 8px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
      .toast { animation: toast-in .22s ease-out; }
      @media (prefers-reduced-motion: reduce) { .toast { animation: none; } }

      .sticky-note {
        background: var(--sticky-bg);
        border: 1px solid var(--sticky-border);
        border-radius: 10px;
        padding: 12px 14px;
        font-size: 13.5px;
        color: var(--sticky-text);
        line-height: 1.5;
        box-shadow: 0 1px 2px rgba(0,0,0,.3);
      }

      .risk-badge {
        display: inline-flex; align-items: center; font-weight: 600;
        border-radius: 6px; text-transform: uppercase; letter-spacing: .02em;
      }

      input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--accent); }
    `}</style>
  );
}
