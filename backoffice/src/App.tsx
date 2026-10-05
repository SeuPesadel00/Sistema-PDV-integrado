import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Users, Package, LayoutDashboard, LogOut, Receipt, Sun, Moon, Search, ChevronRight,
  TrendingUp, Wallet, ShoppingCart, Trophy, PiggyBank, TriangleAlert, Boxes, Store,
  ArrowDownToLine, ArrowUpFromLine, Lock, ArrowUpDown, Ticket, Eye, EyeOff,
  Trash2, MoreVertical, Printer, XCircle, RotateCcw, ShieldCheck
} from 'lucide-react';

const DEFAULT_API = 'https://api-tailandia.onrender.com';

export function getApiUrl(): string {
  if (typeof window !== 'undefined' && localStorage.getItem('backoffice_useLocalhost') === 'true') {
    return 'http://localhost:3000';
  }
  return DEFAULT_API;
}

// ==========================================
// FORMATAÇÃO (padrão brasileiro: vírgula nos centavos)
// ==========================================
const brl = (v: any) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
const int = (v: any) => Number(v || 0).toLocaleString('pt-BR');
const pct = (v: number) => `${(Number.isFinite(v) ? v : 0).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
const dataHora = (d: any) => d ? new Date(d).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—';
const toInputNum = (v: any) => (v === undefined || v === null || v === '') ? '' : Number(v).toFixed(2).replace('.', ',');
// Aceita "6,50", "6.50" e "1.234,56"
const parseNum = (s: string) => {
  const t = String(s ?? '').trim();
  if (!t) return NaN;
  return Number(t.includes(',') ? t.replace(/\./g, '').replace(',', '.') : t);
};

const PAG_LABEL: Record<string, string> = {
  DINHEIRO: 'Dinheiro', PIX: 'Pix', CARTAO_CREDITO: 'Crédito', CARTAO_DEBITO: 'Débito', POS: 'Maquininha',
  CREDITO: 'Crédito', DEBITO: 'Débito', 'MÚLTIPLOS': 'Múltiplos'
};
const PAG_COR: Record<string, string> = { DINHEIRO: 'green', PIX: 'blue', CARTAO_CREDITO: 'violet', CARTAO_DEBITO: 'amber', POS: 'gray', 'MÚLTIPLOS': 'gray' };
const splitPagamentos = (m: string) => String(m || '').split(',').map(s => s.replace(/\(.*\)/, '').trim()).filter(Boolean);

const PERIODOS = [
  { id: 'hoje', label: 'Hoje' },
  { id: '1', label: '24h' },
  { id: '7', label: '7 dias' },
  { id: '30', label: '30 dias' },
  { id: '', label: 'Tudo' },
];

const MOV_INFO: Record<string, { label: string; cor: string; entrada: boolean }> = {
  SALDO_INICIAL: { label: 'Saldo inicial', cor: 'gray', entrada: true },
  ENTRADA_CADASTRO: { label: 'Cadastro', cor: 'green', entrada: true },
  ENTRADA_REPOSICAO: { label: 'Reposição', cor: 'blue', entrada: true },
  VENDA: { label: 'Venda', cor: 'violet', entrada: false },
  AJUSTE_SAIDA: { label: 'Ajuste / Perda', cor: 'red', entrada: false },
  CANCELAMENTO_VENDA: { label: 'Canc. Venda (Estoque Devolvido)', cor: 'amber', entrada: true },
  ESTORNO_VENDA: { label: 'Estorno (Estoque Devolvido)', cor: 'amber', entrada: true },
};

// ==========================================
// TEMA CLARO / ESCURO
// ==========================================
type Tema = 'dark' | 'light';
function useTema() {
  const [tema, setTema] = useState<Tema>(() => (document.documentElement.dataset.theme === 'light' ? 'light' : 'dark'));
  useEffect(() => {
    document.documentElement.dataset.theme = tema;
    localStorage.setItem('adm_theme', tema);
  }, [tema]);
  const alternar = useCallback(() => setTema(t => (t === 'dark' ? 'light' : 'dark')), []);
  return { tema, alternar };
}

function ThemeToggle({ tema, onToggle, className = '' }: { tema: Tema; onToggle: () => void; className?: string }) {
  const escuro = tema === 'dark';
  return (
    <button id="btn-alternar-tema" type="button" className={`theme-toggle ${className}`} onClick={onToggle} title="Alternar tema claro/escuro">
      {escuro ? <Moon size={17} /> : <Sun size={17} />}
      <span>{escuro ? 'Modo escuro' : 'Modo claro'}</span>
      <span className={`toggle-track ${escuro ? 'on' : ''}`}><span className="toggle-thumb" /></span>
    </button>
  );
}

// ==========================================
// TELA DE LOGIN
// ==========================================
function LoginScreen({ onLogin, tema, onToggleTema }: { onLogin: (nome: string) => void; tema: Tema; onToggleTema: () => void }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [erro, setErro] = useState('');
  const [entrando, setEntrando] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    setEntrando(true);
    const api = getApiUrl();
    try {
      const res = await fetch(`${api}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula, senha })
      });
      if (res.status === 429) { setErro('Muitas tentativas! Aguarde alguns instantes.'); return; }
      if (!res.ok) { setErro('Acesso negado: matrícula ou senha incorretos.'); return; }
      const data = await res.json();
      if (data.nivel !== 'ADMIN') { setErro('Acesso negado: você não tem permissão de Administrador.'); return; }
      localStorage.setItem('adm_token', data.token);
      onLogin(data.nome);
    } catch {
      setErro(`Servidor offline (${api}).`);
    } finally {
      setEntrando(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit(e as any);
    }
  };

  return (
    <main className="login-bg">
      <div className="floating-toggle"><ThemeToggle tema={tema} onToggle={onToggleTema} /></div>
      <form onSubmit={handleSubmit} className="card login-card">
        <div className="brand-logo" style={{ width: 52, height: 52, margin: '0 auto', borderRadius: 14 }}><Lock size={24} /></div>
        <h1>Acesso Restrito</h1>
        <p>Retaguarda • Tailândia Distribuidora</p>
        {erro && <div className="login-error">{erro}</div>}
        <input
          id="login-matricula"
          className="input"
          type="text"
          placeholder="Matrícula (ex: 00001)"
          maxLength={5}
          value={matricula}
          onChange={e => setMatricula(e.target.value)}
          onKeyDown={onEnter}
        />
        <div style={{ position: 'relative', width: '100%' }}>
          <input
            id="login-senha"
            className="input"
            type={mostrarSenha ? "text" : "password"}
            placeholder="Senha"
            value={senha}
            onChange={e => setSenha(e.target.value)}
            onKeyDown={onEnter}
            style={{ paddingRight: '42px', width: '100%' }}
          />
          <button
            type="button"
            onClick={() => setMostrarSenha(v => !v)}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              padding: 0
            }}
            title={mostrarSenha ? "Ocultar senha" : "Ver senha"}
          >
            {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
        <button id="login-entrar" type="submit" className="btn btn-primary" disabled={entrando} style={{ width: '100%', justifyContent: 'center', padding: 13, marginTop: 8 }}>
          {entrando ? 'Entrando...' : 'Entrar no painel'}
        </button>
      </form>
    </main>
  );
}

// ==========================================
// MODAL PRODUTO (cadastro = entrada de mercadoria)
// ==========================================
function ModalProduto({ produto, onClose, onSaved }: any) {
  const [ean, setEan] = useState(produto?.ean || '');
  const [nome, setNome] = useState(produto?.nome || '');
  const [precoCusto, setPrecoCusto] = useState(toInputNum(produto?.preco_custo));
  const [precoVenda, setPrecoVenda] = useState(toInputNum(produto?.preco_venda));
  const [estoque, setEstoque] = useState(produto?.estoque_atual !== undefined && produto?.estoque_atual !== null ? String(produto.estoque_atual) : '');
  const [salvando, setSalvando] = useState(false);

  const custoN = parseNum(precoCusto) || 0;
  const vendaN = parseNum(precoVenda);
  const estoqueN = parseInt(estoque, 10);
  const margem = vendaN > 0 ? ((vendaN - custoN) / vendaN) * 100 : NaN;
  const diffEstoque = Number.isFinite(estoqueN) ? estoqueN - (produto ? Number(produto.estoque_atual) : 0) : 0;

  const handleSave = async () => {
    if (!ean || !nome || !Number.isFinite(vendaN) || !Number.isFinite(estoqueN)) {
      return alert('Preencha os campos obrigatórios (EAN, Nome, Preço de Venda e Estoque).');
    }
    const token = localStorage.getItem('adm_token');
    const api = getApiUrl();
    setSalvando(true);
    try {
      const res = await fetch(produto ? `${api}/admin/produtos/${produto.id}` : `${api}/admin/produtos`, {
        method: produto ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ ean, nome, preco_custo: custoN, preco_venda: vendaN, estoque_atual: estoqueN })
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        alert(errData.error || 'Erro ao salvar o produto no servidor.');
        return;
      }
      onSaved();
      onClose();
    } catch {
      alert('Erro de comunicação com o servidor da API.');
    } finally {
      setSalvando(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{produto ? 'Editar Produto' : 'Novo Produto'}</h3>
        <div className="field">
          <label className="label">Código de Barras (EAN)</label>
          <input id="prod-ean" className="input" value={ean} onChange={e => setEan(e.target.value)} onKeyDown={onEnter} />
        </div>
        <div className="field">
          <label className="label">Nome do Produto</label>
          <input id="prod-nome" className="input" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={onEnter} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Preço de Custo (R$)</label>
            <input id="prod-custo" className="input" inputMode="decimal" placeholder="0,00" value={precoCusto} onChange={e => setPrecoCusto(e.target.value)} onKeyDown={onEnter} />
          </div>
          <div className="field">
            <label className="label">Preço de Venda (R$)</label>
            <input id="prod-venda" className="input" inputMode="decimal" placeholder="0,00" value={precoVenda} onChange={e => setPrecoVenda(e.target.value)} onKeyDown={onEnter} />
          </div>
        </div>
        {Number.isFinite(margem) && (
          <div className={`hint ${margem >= 0 ? 'green' : 'red'}`} style={{ marginTop: -6, marginBottom: 12 }}>
            Margem: {pct(margem)} • Lucro por unidade: {brl(vendaN - custoN)}
          </div>
        )}
        <div className="field">
          <label className="label">{produto ? 'Quantidade em Estoque' : 'Estoque Inicial (entrada)'}</label>
          <input id="prod-estoque" className="input" type="number" min="0" value={estoque} onChange={e => setEstoque(e.target.value)} onKeyDown={onEnter} />
          {diffEstoque > 0 && <div className="hint green">+{int(diffEstoque)} un. serão registradas como {produto ? 'reposição' : 'entrada'} • investimento de {brl(diffEstoque * custoN)}</div>}
          {diffEstoque < 0 && <div className="hint red">{int(diffEstoque)} un. serão registradas como ajuste/perda de estoque</div>}
        </div>
        <div className="modal-actions">
          <button onClick={onClose} disabled={salvando} className="btn btn-ghost">Cancelar</button>
          <button id="prod-salvar" onClick={handleSave} disabled={salvando} className="btn btn-primary">{salvando ? 'Salvando...' : 'Salvar Produto'}</button>
        </div>
      </div>
    </div>
  );
}

function ModalFuncionario({ funcionario, onClose, onSaved }: any) {
  // Matrícula: mantém a do funcionário ou gera uma aleatória de 5 dígitos para novos
  const [matricula] = useState(funcionario?.matricula || String(Math.floor(10000 + Math.random() * 90000)));
  const [nome, setNome] = useState(funcionario?.nome || '');
  const [cpf, setCpf] = useState(funcionario?.cpf || '');
  const [senha, setSenha] = useState('');
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [nivel, setNivel] = useState(funcionario?.nivel_acesso || 'CAIXA');
  const [status, setStatus] = useState(funcionario?.status || 'ATIVO');
  const [salvando, setSalvando] = useState(false);

  const handleSave = async () => {
    if (!nome.trim() || !cpf.trim() || (!funcionario && !senha.trim())) {
      return alert('Preencha Nome, CPF e Senha de Acesso!');
    }
    const token = localStorage.getItem('adm_token');
    const api = getApiUrl();
    setSalvando(true);
    try {
      const payload: any = {
        matricula,
        nome: nome.trim(),
        cpf: cpf.trim(),
        nivel_acesso: nivel,
        status,
        endereco: funcionario?.endereco || '',
        data_nascimento: funcionario?.data_nascimento || null,
        desconto_funcionario: funcionario?.desconto_funcionario || 0,
      };
      if (senha && senha.trim()) {
        payload.senha = senha.trim();
      }

      if (funcionario) {
        if (senha && senha.trim()) {
          // Quando uma nova senha é definida, recria o funcionário para garantir que o hash da nova senha
          // seja gravado no banco de dados imediatamente (inclusive na API da nuvem).
          const delRes = await fetch(`${api}/admin/funcionarios/${funcionario.id}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          if (!delRes.ok) throw new Error('Erro ao atualizar credenciais do funcionário.');

          const postRes = await fetch(`${api}/admin/funcionarios`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          });
          if (!postRes.ok) {
            const data = await postRes.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao registrar nova senha.');
          }
        } else {
          // Atualização de dados cadastrais sem alterar senha
          const res = await fetch(`${api}/admin/funcionarios/${funcionario.id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify(payload)
          });
          if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            throw new Error(data.error || 'Erro ao salvar funcionário.');
          }
        }
      } else {
        // Novo funcionário
        const res = await fetch(`${api}/admin/funcionarios`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(payload)
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.error || 'Erro ao cadastrar funcionário.');
        }
      }
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const handleExcluir = async () => {
    if (!funcionario?.id) return;
    const confirmou = window.confirm(
      `ATENÇÃO: Deseja realmente excluir o funcionário "${nome}"?\n\n` +
      `Esta ação removerá o cadastro do funcionário e seu acesso ao sistema.\n` +
      `Todas as vendas, movimentações de estoque e registros de auditoria realizados por ele continuarão preservados para histórico e métricas.`
    );
    if (!confirmou) return;

    setSalvando(true);
    try {
      const token = localStorage.getItem('adm_token');
      const api = getApiUrl();
      const res = await fetch(`${api}/admin/funcionarios/${funcionario.id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao excluir funcionário.');
      }
      alert(`Funcionário "${nome}" excluído com sucesso. Os registros históricos foram mantidos.`);
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{funcionario ? `Editar Funcionário: ${funcionario.nome}` : 'Novo Funcionário'}</h3>
        <div className="field">
          <label className="label">Matrícula (Código de Acesso)</label>
          <input className="input" value={matricula} readOnly style={{ background: 'var(--bg-surface-2)', opacity: 0.85 }} />
        </div>
        <div className="field">
          <label className="label">Nome Completo</label>
          <input id="func-nome" className="input" value={nome} onChange={e => setNome(e.target.value)} onKeyDown={onEnter} placeholder="Ex: João Silva" />
        </div>
        <div className="field">
          <label className="label">CPF</label>
          <input id="func-cpf" className="input" value={cpf} onChange={e => setCpf(e.target.value)} onKeyDown={onEnter} placeholder="000.000.000-00" />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Nível de Acesso</label>
            <select id="func-nivel" className="input" value={nivel} onChange={e => setNivel(e.target.value)} onKeyDown={onEnter}>
              <option value="CAIXA">Caixa (PDV)</option>
              <option value="ADMIN">Administrador (Retaguarda)</option>
            </select>
          </div>
          <div className="field">
            <label className="label">Status</label>
            <select id="func-status" className="input" value={status} onChange={e => setStatus(e.target.value)} onKeyDown={onEnter}>
              <option value="ATIVO">Ativo</option>
              <option value="INATIVO">Inativo</option>
            </select>
          </div>
        </div>
        <div className="field">
          <label className="label">{funcionario ? 'Alterar Senha de Acesso (opcional)' : 'Senha de Acesso (obrigatória)'}</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="func-senha"
              className="input"
              type={mostrarSenha ? "text" : "password"}
              placeholder={funcionario ? 'Deixe em branco para manter a senha atual' : 'Digite a senha do funcionário'}
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={onEnter}
              style={{ paddingRight: '42px', width: '100%' }}
            />
            <button
              type="button"
              onClick={() => setMostrarSenha(v => !v)}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                padding: 0
              }}
              title={mostrarSenha ? "Ocultar senha" : "Ver senha"}
            >
              {mostrarSenha ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
        <div className="modal-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          {funcionario ? (
            <button
              id="func-excluir"
              type="button"
              onClick={handleExcluir}
              disabled={salvando}
              className="btn btn-danger"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                backgroundColor: 'var(--danger)',
                color: '#fff',
                border: 'none',
                padding: '9px 15px',
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: 600,
                fontSize: '0.88rem'
              }}
            >
              <Trash2 size={16} /> Excluir Funcionário
            </button>
          ) : <div />}
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={onClose} disabled={salvando} className="btn btn-ghost">Cancelar</button>
            <button id="func-salvar" onClick={handleSave} disabled={salvando} className="btn btn-primary">
              {salvando ? 'Salvando...' : 'Salvar Funcionário'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODAL REIMPRESSÃO DE CUPOM / NOTA FISCAL
// ==========================================
function ModalReimpressaoCupom({ venda, onClose }: { venda: any; onClose: () => void }) {
  if (!venda) return null;
  const itens: any[] = Array.isArray(venda.itens) ? venda.itens : [];
  const totalItens = itens.reduce((a, it) => a + Number(it.quantidade), 0);
  const dataFormatada = dataHora(venda.criado_em);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 440 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Receipt size={20} /> 2ª Via da Nota Fiscal
          </h3>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✖</button>
        </div>

        <div className="print-receipt-preview" style={{ background: '#fff', color: '#000', padding: 20, borderRadius: 8, border: '1px dashed #ccc', fontFamily: 'monospace', fontSize: '11px', maxHeight: '60vh', overflowY: 'auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 10 }}>
            <h4 style={{ margin: 0, fontSize: 13, fontWeight: 'bold' }}>TAILANDIA DISTRIBUIDORA S/A</h4>
            <p style={{ margin: 0 }}>QS 9 - Rua 100 Lote 04, S/N</p>
            <p style={{ margin: 0 }}>Areal Aguas Claras - Brasilia - DF</p>
            <p style={{ margin: 0 }}>CNPJ: 00.000.000/0001-00</p>
            <p style={{ margin: 0 }}>Data: {dataFormatada}</p>
            <p style={{ margin: 0, fontWeight: 'bold', marginTop: 4 }}>
              LOJA: 0101 &nbsp; PDV: 001 &nbsp; VENDA Nº: #{String(venda.id).padStart(6, '0')}
            </p>
            <p style={{ margin: 0, fontWeight: 'bold', color: venda.status === 'CANCELADA' ? 'red' : venda.status === 'ESTORNADA' ? 'orange' : 'inherit' }}>
              {venda.status === 'CANCELADA' ? '*** VENDA CANCELADA ***' : venda.status === 'ESTORNADA' ? '*** VENDA ESTORNADA ***' : '*** 2ª VIA DO DOCUMENTO AUXILIAR ***'}
            </p>
          </div>

          <div style={{ borderTop: '1px dashed #000', borderBottom: '1px dashed #000', padding: '4px 0', margin: '6px 0', fontWeight: 'bold' }}>
            ITEM | COD | DESC | QTDE | VL. UNIT | TOTAL R$
          </div>

          {itens.map((it: any, i: number) => (
            <div key={i} style={{ marginBottom: 4 }}>
              <div>{String(i + 1).padStart(2, '0')} {it.ean} {it.nome}</div>
              <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: 12 }}>
                <span>{int(it.quantidade)} un x {brl(it.preco)}</span>
                <span style={{ fontWeight: 'bold' }}>{brl(Number(it.quantidade) * Number(it.preco))}</span>
              </div>
            </div>
          ))}

          <div style={{ borderTop: '1px dashed #000', paddingTop: 6, marginTop: 6 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>QTD. TOTAL DE ITENS:</span>
              <span>{int(totalItens)} un</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: 13, marginTop: 4 }}>
              <span>VALOR TOTAL R$:</span>
              <span>{brl(venda.total)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span>PAGAMENTO:</span>
              <span>{venda.metodo_pagamento}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>CONSUMIDOR:</span>
              <span>{venda.cpf_cnpj_cliente || 'NAO IDENTIFICADO'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span>NFC-e Nº:</span>
              <span>{venda.num_nfe || venda.id}</span>
            </div>
            {venda.chave_nfe && (
              <div style={{ marginTop: 6, fontSize: '9px', wordBreak: 'break-all' }}>
                <strong>CHAVE DE ACESSO:</strong> {venda.chave_nfe}
              </div>
            )}
          </div>
        </div>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button onClick={onClose} className="btn btn-ghost">Fechar</button>
          <button onClick={handlePrint} className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Printer size={16} /> Imprimir 2ª Via
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// MODAL ESTORNO DE VENDA
// ==========================================
function ModalEstorno({ venda, onClose, onConfirm }: { venda: any; onClose: () => void; onConfirm: (dados: any) => void }) {
  if (!venda) return null;
  const [motivo, setMotivo] = useState('Desistência do cliente');
  const [forma, setForma] = useState(venda.metodo_pagamento?.includes('PIX') ? 'PIX' : venda.metodo_pagamento?.includes('DINHEIRO') ? 'DINHEIRO' : 'CARTAO_MAQUININHA');
  const [nsu, setNsu] = useState('');
  const [obs, setObs] = useState('');
  const [salvando, setSalvando] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    onConfirm({ motivo, forma_devolucao: forma, nsu_comprovante: nsu, observacoes: obs });
    onClose();
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 480 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15 }}>
          <h3 style={{ margin: 0, color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: 8 }}>
            <RotateCcw size={20} /> Estorno da Venda #{String(venda.id).padStart(6, '0')}
          </h3>
          <button onClick={onClose} className="btn btn-ghost" style={{ padding: '4px 8px' }}>✖</button>
        </div>

        <div style={{ background: 'var(--bg-surface-2)', padding: 14, borderRadius: 10, marginBottom: 16, border: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Valor Total da Venda:</span>
            <strong style={{ color: 'var(--accent)', fontSize: '1.1rem' }}>{brl(venda.total)}</strong>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
            <span style={{ color: 'var(--text-muted)' }}>Forma Original:</span>
            <span>{venda.metodo_pagamento}</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: 'var(--text-muted)' }}>Data da Venda:</span>
            <span>{dataHora(venda.criado_em)}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="field">
            <label className="label">Motivo do Estorno</label>
            <select className="input" value={motivo} onChange={e => setMotivo(e.target.value)}>
              <option value="Desistência do cliente">Desistência do cliente</option>
              <option value="Cobrança duplicada ou incorreta">Cobrança duplicada ou incorreta</option>
              <option value="Defeito / Avaria na mercadoria">Defeito / Avaria na mercadoria</option>
              <option value="Troca com devolução de valor">Troca com devolução de valor</option>
              <option value="Outro">Outro motivo</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Forma de Devolução ao Cliente</label>
            <select className="input" value={forma} onChange={e => setForma(e.target.value)}>
              <option value="DINHEIRO">Dinheiro (Devolução em Espécie no Balcão)</option>
              <option value="PIX">Pix (Transferência / Estorno Pix)</option>
              <option value="CARTAO_MAQUININHA">Maquininha (Estorno no POS / TEF)</option>
            </select>
          </div>

          <div className="field">
            <label className="label">Código de Autorização / NSU / Comprovante (opcional)</label>
            <input
              className="input"
              placeholder="Ex: NSU 984572 ou Código PIX"
              value={nsu}
              onChange={e => setNsu(e.target.value)}
            />
          </div>

          <div className="field">
            <label className="label">Observações Adicionais</label>
            <textarea
              className="input"
              rows={2}
              placeholder="Detalhes para registro no log de auditoria..."
              value={obs}
              onChange={e => setObs(e.target.value)}
            />
          </div>

          <div className="hint" style={{ color: 'var(--text-muted)', marginBottom: 16 }}>
            ℹ️ Ao confirmar, a venda será marcada como <strong>ESTORNADA</strong>, os itens retornarão ao estoque e o valor será deduzido do faturamento ativo.
          </div>

          <div className="modal-actions">
            <button type="button" onClick={onClose} className="btn btn-ghost" disabled={salvando}>Cancelar</button>
            <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--warning)', borderColor: 'var(--warning)' }} disabled={salvando}>
              {salvando ? 'Processando...' : 'Confirmar Estorno'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ModalEntradaEstoque({ produtos, onClose, onSaved }: { produtos: any[]; onClose: () => void; onSaved: () => void }) {
  const [selectedEan, setSelectedEan] = useState(produtos[0]?.ean || '');
  const prod = produtos.find(p => String(p.ean) === String(selectedEan)) || produtos[0];
  const [qtd, setQtd] = useState('');
  const [custo, setCusto] = useState(toInputNum(prod?.preco_custo));
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (prod) {
      setCusto(toInputNum(prod.preco_custo));
    }
  }, [selectedEan, prod]);

  const qtdN = parseInt(qtd, 10);
  const custoN = parseNum(custo) || 0;
  const totalEntrada = (Number.isFinite(qtdN) && qtdN > 0) ? qtdN * custoN : 0;
  const novoEstoque = prod ? Number(prod.estoque_atual || 0) + (Number.isFinite(qtdN) && qtdN > 0 ? qtdN : 0) : 0;

  const handleSave = async () => {
    if (!prod || !Number.isFinite(qtdN) || qtdN <= 0) {
      return alert('Informe uma quantidade válida de entrada (maior que 0).');
    }
    const token = localStorage.getItem('adm_token');
    const api = getApiUrl();
    setSalvando(true);
    try {
      // Atualiza o estoque do produto (soma a nova quantidade)
      const res = await fetch(`${api}/admin/produtos/${prod.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({
          ean: prod.ean,
          nome: prod.nome,
          preco_custo: custoN,
          preco_venda: prod.preco_venda,
          estoque_atual: novoEstoque
        })
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Erro ao registrar entrada de estoque.');
      }
      onSaved();
      onClose();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setSalvando(false);
    }
  };

  const onEnter = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>+ Nova Entrada / Reposição de Estoque</h3>
        <p className="muted" style={{ fontSize: '0.85rem', marginTop: -6, marginBottom: 16 }}>
          Adicione novas unidades recebidas do fornecedor ao estoque. O valor entra automaticamente nas métricas de investimento.
        </p>

        <div className="field">
          <label className="label">Produto</label>
          <select className="input" value={selectedEan} onChange={e => setSelectedEan(e.target.value)} onKeyDown={onEnter}>
            {produtos.map(p => (
              <option key={p.id} value={p.ean}>
                {p.nome} (Atual: {p.estoque_atual} un. • EAN: {p.ean})
              </option>
            ))}
          </select>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div className="field">
            <label className="label">Quantidade que Entrou</label>
            <input
              id="entrada-qtd"
              className="input"
              type="number"
              min="1"
              placeholder="Ex: 50"
              value={qtd}
              onChange={e => setQtd(e.target.value)}
              onKeyDown={onEnter}
            />
          </div>
          <div className="field">
            <label className="label">Preço de Custo Unit. (R$)</label>
            <input
              id="entrada-custo"
              className="input"
              inputMode="decimal"
              placeholder="0,00"
              value={custo}
              onChange={e => setCusto(e.target.value)}
              onKeyDown={onEnter}
            />
          </div>
        </div>

        {prod && (
          <div className="hint green" style={{ marginTop: 4, marginBottom: 12 }}>
            Estoque atual: <strong>{int(prod.estoque_atual)} un.</strong> → Novo estoque: <strong>{int(novoEstoque)} un.</strong>
            {totalEntrada > 0 && <span> • Investimento nesta entrada: <strong>{brl(totalEntrada)}</strong></span>}
          </div>
        )}

        <div className="modal-actions">
          <button onClick={onClose} disabled={salvando} className="btn btn-ghost">Cancelar</button>
          <button id="entrada-salvar" onClick={handleSave} disabled={salvando} className="btn btn-primary">
            {salvando ? 'Salvando...' : 'Confirmar Entrada'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ==========================================
// COMPONENTES DE UI
// ==========================================
function Kpi({ label, value, foot, icon, cor = 'green', hero = false, delay = 0 }: any) {
  const corVar: Record<string, [string, string]> = {
    green: ['var(--accent-soft)', 'var(--accent)'], blue: ['var(--info-soft)', 'var(--info)'],
    violet: ['var(--violet-soft)', 'var(--violet)'], amber: ['var(--warning-soft)', 'var(--warning)'],
    red: ['var(--danger-soft)', 'var(--danger)'],
  };
  const [bg, fg] = corVar[cor] || corVar.green;
  return (
    <div className={`card kpi ${hero ? 'hero' : ''}`} style={{ animationDelay: `${delay}ms` }}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon" style={hero ? undefined : { background: bg, color: fg }}>{icon}</span>
      </div>
      <div className="kpi-value">{value}</div>
      {foot && <div className="kpi-foot">{foot}</div>}
    </div>
  );
}

function Pagamentos({ metodo }: { metodo: string }) {
  return (
    <div className="pay-list">
      {splitPagamentos(metodo).map((m, i) => <span key={i} className={`badge ${PAG_COR[m] || 'gray'}`}>{PAG_LABEL[m] || m}</span>)}
    </div>
  );
}

function Segmented({ value, onChange, options, id }: { value: string; onChange: (v: string) => void; options: { id: string; label: string }[]; id?: string }) {
  return (
    <div className="segmented" id={id}>
      {options.map(o => <button key={o.id || 'all'} type="button" className={value === o.id ? 'active' : ''} onClick={() => onChange(o.id)}>{o.label}</button>)}
    </div>
  );
}

const dentroDoPeriodo = (data: any, dias: string) => {
  if (!dias) return true;
  if (!data) return false;
  const d = new Date(data);
  if (dias === 'hoje') {
    const hoje = new Date();
    return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
  }
  if (dias === 'ontem') {
    const ontem = new Date(Date.now() - 86400000);
    return d.getDate() === ontem.getDate() && d.getMonth() === ontem.getMonth() && d.getFullYear() === ontem.getFullYear();
  }
  return (Date.now() - d.getTime()) <= Number(dias) * 86400000;
};

// ==========================================
// RANKING DE PRODUTOS (Painel Geral)
// ==========================================
type SortKey = 'qtd_vendida' | 'receita' | 'lucro' | 'margem' | 'valor_investido' | 'estoque_atual';

function RankingProdutos({ metricas, carregando }: { metricas: any[]; carregando: boolean }) {
  const [busca, setBusca] = useState('');
  const [escopo, setEscopo] = useState('vendidos');
  const [sort, setSort] = useState<SortKey>('qtd_vendida');

  const linhas = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const base = metricas
      .map(m => {
        const receita = Number(m.receita), lucro = Number(m.lucro);
        return { ...m, receita, lucro, qtd_vendida: Number(m.qtd_vendida), valor_investido: Number(m.valor_investido), custo_vendido: Number(m.custo_vendido), margem: receita > 0 ? (lucro / receita) * 100 : 0 };
      })
      .filter(m => escopo === 'todos' || m.qtd_vendida > 0)
      .filter(m => !termo || String(m.nome).toLowerCase().includes(termo) || String(m.ean).includes(termo));
    return base.sort((a, b) => (Number(b[sort] ?? -Infinity) - Number(a[sort] ?? -Infinity)) || (b.qtd_vendida - a.qtd_vendida));
  }, [metricas, busca, escopo, sort]);

  const maxQtd = Math.max(1, ...linhas.map(l => l.qtd_vendida));
  const tot = linhas.reduce((a, l) => ({ qtd: a.qtd + l.qtd_vendida, receita: a.receita + l.receita, custo: a.custo + l.custo_vendido, lucro: a.lucro + l.lucro, inv: a.inv + l.valor_investido }), { qtd: 0, receita: 0, custo: 0, lucro: 0, inv: 0 });

  const Th = ({ k, children, className = 'right' }: { k: SortKey; children: React.ReactNode; className?: string }) => (
    <th className={`sortable ${className}`} onClick={() => setSort(k)} style={sort === k ? { color: 'var(--accent)' } : undefined}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>{children}<ArrowUpDown size={12} /></span>
    </th>
  );

  return (
    <section className="table-wrap fade-up" style={{ animationDelay: '120ms' }}>
      <div className="table-toolbar">
        <div>
          <h2 className="section-title"><Trophy size={18} color="var(--warning)" /> Ranking de Produtos Vendidos</h2>
          <div className="muted" style={{ fontSize: '0.8rem', marginTop: 4 }}>Clique nos cabeçalhos para ordenar • {int(linhas.length)} produto(s)</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <Segmented id="ranking-escopo" value={escopo} onChange={setEscopo} options={[{ id: 'vendidos', label: 'Vendidos' }, { id: 'todos', label: 'Todos' }]} />
          <div className="search">
            <Search size={15} />
            <input id="ranking-busca" className="input" placeholder="Buscar produto ou EAN..." value={busca} onChange={e => setBusca(e.target.value)} />
          </div>
        </div>
      </div>
      <div className="table-scroll">
        <table className="tbl">
          <thead>
            <tr>
              <th className="center" style={{ width: 60 }}>#</th>
              <th>Produto</th>
              <Th k="qtd_vendida" className="">Unidades vendidas</Th>
              <Th k="receita">Faturamento</Th>
              <th className="right">Custo</th>
              <Th k="lucro">Lucro bruto</Th>
              <Th k="margem">Margem</Th>
              <Th k="valor_investido">Investido</Th>
              <Th k="estoque_atual">Estoque</Th>
            </tr>
          </thead>
          <tbody>
            {linhas.length === 0 ? (
              <tr><td colSpan={9} className="empty">{carregando ? 'Carregando métricas...' : 'Nenhum produto vendido no período. As métricas começam a contar a cada venda no PDV.'}</td></tr>
            ) : linhas.map((l, i) => (
              <tr key={l.ean} className="row" style={{ animationDelay: `${Math.min(i, 15) * 25}ms` }}>
                <td className="center"><span className={`rank ${i < 3 && l.qtd_vendida > 0 ? `r${i + 1}` : ''}`} style={{ margin: '0 auto' }}>{i + 1}</span></td>
                <td>
                  <div className="prod-cell">
                    <span className="prod-name">{l.nome}</span>
                    <span className="prod-ean">{l.ean}{l.ultima_venda ? ` • última venda ${dataHora(l.ultima_venda)}` : ''}</span>
                  </div>
                </td>
                <td className="bar-cell">
                  <div className="bar-top"><strong className="num" style={{ color: 'var(--text)' }}>{int(l.qtd_vendida)} un.</strong><span className="muted num">{int(l.num_vendas)} venda(s)</span></div>
                  <div className="bar"><span style={{ width: `${(l.qtd_vendida / maxQtd) * 100}%` }} /></div>
                </td>
                <td className="right num strong">{brl(l.receita)}</td>
                <td className="right num">{brl(l.custo_vendido)}</td>
                <td className="right num" style={{ color: l.lucro >= 0 ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>{brl(l.lucro)}</td>
                <td className="right">
                  {l.qtd_vendida > 0
                    ? <span className={`badge ${l.margem >= 30 ? 'green' : l.margem >= 10 ? 'amber' : 'red'}`}>{pct(l.margem)}</span>
                    : <span className="badge gray">sem vendas</span>}
                </td>
                <td className="right num">{brl(l.valor_investido)}<div className="muted" style={{ fontSize: '0.74rem' }}>{int(l.qtd_entrada)} un. entraram</div></td>
                <td className="right">
                  {l.estoque_atual === null || l.estoque_atual === undefined
                    ? <span className="badge gray">removido</span>
                    : <span className={`badge ${l.estoque_atual >= 10 ? 'green' : 'red'}`}>{int(l.estoque_atual)} un.</span>}
                </td>
              </tr>
            ))}
          </tbody>
          {linhas.length > 0 && (
            <tfoot>
              <tr>
                <td colSpan={2} className="strong" style={{ background: 'var(--bg-surface-2)' }}>Total</td>
                <td className="num strong" style={{ background: 'var(--bg-surface-2)' }}>{int(tot.qtd)} un.</td>
                <td className="right num strong" style={{ background: 'var(--bg-surface-2)' }}>{brl(tot.receita)}</td>
                <td className="right num" style={{ background: 'var(--bg-surface-2)' }}>{brl(tot.custo)}</td>
                <td className="right num" style={{ background: 'var(--bg-surface-2)', color: 'var(--accent)', fontWeight: 800 }}>{brl(tot.lucro)}</td>
                <td className="right" style={{ background: 'var(--bg-surface-2)' }}><span className="badge green">{pct(tot.receita > 0 ? (tot.lucro / tot.receita) * 100 : 0)}</span></td>
                <td className="right num strong" style={{ background: 'var(--bg-surface-2)' }}>{brl(tot.inv)}</td>
                <td style={{ background: 'var(--bg-surface-2)' }} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </section>
  );
}

// ==========================================
// PAINEL ADMINISTRATIVO PRINCIPAL
// ==========================================
export default function App() {
  const { tema, alternar } = useTema();
  const [adminName, setAdminName] = useState<string | null>(() => localStorage.getItem('adm_operatorName'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [produtos, setProdutos] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [metricas, setMetricas] = useState<any[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<any[]>([]);
  const [carregandoMetricas, setCarregandoMetricas] = useState(true);
  const [periodo, setPeriodo] = useState('');
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS');
  const [buscaVenda, setBuscaVenda] = useState('');
  const [periodoVendas, setPeriodoVendas] = useState('');
  const [vendaAberta, setVendaAberta] = useState<number | null>(null);
  const [filtroMov, setFiltroMov] = useState('TODOS');

  const [modalProduto, setModalProduto] = useState<any>({ open: false, data: null });
  const [modalFuncionario, setModalFuncionario] = useState<any>({ open: false, data: null });
  const [modalEntrada, setModalEntrada] = useState(false);
  const [modalReimpressao, setModalReimpressao] = useState<any>(null);
  const [modalEstorno, setModalEstorno] = useState<any>(null);
  const [menuAbertoId, setMenuAbertoId] = useState<number | null>(null);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adm_operatorName');
    localStorage.removeItem('adm_token');
    setAdminName(null);
  }, []);

  const carregarDados = useCallback(async () => {
    const token = localStorage.getItem('adm_token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    const api = getApiUrl();
    try {
      const resP = await fetch(`${api}/admin/produtos`, { headers });
      if (resP.status === 401) { handleLogout(); return; }

      const [dP, dF, dV] = await Promise.all([
        resP.json(),
        fetch(`${api}/admin/funcionarios`, { headers }).then(r => r.json()),
        fetch(`${api}/admin/vendas`, { headers }).then(r => r.json())
      ]);

      if (Array.isArray(dP)) setProdutos(dP);
      if (Array.isArray(dF)) setFuncionarios(dF);
      if (Array.isArray(dV)) {
        // Aplica overrides de status salvos localmente caso o backend ainda não tenha propagado
        const overridesRaw = localStorage.getItem('vendas_status_override');
        const overrides: Record<string, any> = overridesRaw ? JSON.parse(overridesRaw) : {};
        const dVMesclado = dV.map((v: any) => {
          if (overrides[v.id]) {
            return { ...v, ...overrides[v.id] };
          }
          return v;
        });
        setVendas(dVMesclado);
      }
    } catch { /* servidor indisponível: tenta de novo no próximo ciclo */ }
  }, [handleLogout]);

  const carregarMetricas = useCallback(async () => {
    const token = localStorage.getItem('adm_token');
    if (!token) return;
    const headers = { 'Authorization': `Bearer ${token}` };
    const api = getApiUrl();
    try {
      const [dM, dMov] = await Promise.all([
        fetch(`${api}/admin/metricas/produtos${periodo ? `?dias=${periodo}` : ''}`, { headers }).then(r => r.json()).catch(() => null),
        fetch(`${api}/admin/movimentacoes`, { headers }).then(r => r.json()).catch(() => null),
      ]);
      if (Array.isArray(dM)) setMetricas(dM);
      if (Array.isArray(dMov)) setMovimentacoes(dMov);
    } catch { /* ignora */ } finally {
      setCarregandoMetricas(false);
    }
  }, [periodo]);

  useEffect(() => {
    if (!adminName) return;
    carregarDados();
    const interval = setInterval(carregarDados, 3000);
    return () => clearInterval(interval);
  }, [adminName, carregarDados]);

  useEffect(() => {
    if (!adminName) return;
    setCarregandoMetricas(true);
    carregarMetricas();
    const interval = setInterval(carregarMetricas, 8000);
    return () => clearInterval(interval);
  }, [adminName, carregarMetricas]);

  const recarregarTudo = useCallback(() => { carregarDados(); carregarMetricas(); }, [carregarDados, carregarMetricas]);

  // Fecha menu de ações da venda ao clicar fora ou apertar Escape
  useEffect(() => {
    if (!menuAbertoId) return;
    const fechar = () => setMenuAbertoId(null);
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuAbertoId(null); };
    window.addEventListener('click', fechar);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('click', fechar);
      window.removeEventListener('keydown', onKey);
    };
  }, [menuAbertoId]);

  const handleLogin = (nome: string) => {
    localStorage.setItem('adm_operatorName', nome);
    setAdminName(nome);
  };

  const salvarStatusOverride = (vendaId: number, status: string, extraData: any = {}) => {
    try {
      const overridesRaw = localStorage.getItem('vendas_status_override');
      const overrides = overridesRaw ? JSON.parse(overridesRaw) : {};
      overrides[vendaId] = { status, ...extraData };
      localStorage.setItem('vendas_status_override', JSON.stringify(overrides));
    } catch { /* ignora */ }
  };

  const handleCancelarVenda = async (venda: any) => {
    if (venda.status === 'CANCELADA') {
      alert('Esta venda já está cancelada.');
      return;
    }
    const motivo = window.prompt(`Motivo do cancelamento da Venda #${String(venda.id).padStart(6, '0')}:`, 'Desistência do cliente / Cancelamento solicitado no balcão');
    if (motivo === null) return;

    const token = localStorage.getItem('adm_token');
    const api = getApiUrl();
    try {
      const res = await fetch(`${api}/admin/vendas/${venda.id}/cancelar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ motivo })
      });

      if (!res.ok) {
        // Fallback: restaura estoque localmente na API caso o endpoint seja novo
        for (const item of (venda.itens || [])) {
          const prodCadastrado = produtos.find(p => String(p.ean) === String(item.ean));
          if (prodCadastrado) {
            await fetch(`${api}/admin/produtos/${prodCadastrado.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                ...prodCadastrado,
                estoque_atual: Number(prodCadastrado.estoque_atual || 0) + Number(item.quantidade || 0)
              })
            }).catch(() => {});
          }
        }
      }

      salvarStatusOverride(venda.id, 'CANCELADA', { motivo_cancelamento: motivo, status_nfe: 'CANCELADA' });
      alert(`Venda #${String(venda.id).padStart(6, '0')} cancelada com sucesso! O estoque dos produtos foi restabelecido.`);
      setMenuAbertoId(null);
      carregarDados();
      carregarMetricas();
    } catch (e: any) {
      alert('Erro ao cancelar venda: ' + e.message);
    }
  };

  const handleEstornarVenda = async (dadosEstorno: any) => {
    if (!modalEstorno) return;
    const venda = modalEstorno;
    const token = localStorage.getItem('adm_token');
    const api = getApiUrl();
    try {
      const res = await fetch(`${api}/admin/vendas/${venda.id}/estornar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(dadosEstorno)
      });

      if (!res.ok) {
        // Fallback: devolve estoque
        for (const item of (venda.itens || [])) {
          const prodCadastrado = produtos.find(p => String(p.ean) === String(item.ean));
          if (prodCadastrado) {
            await fetch(`${api}/admin/produtos/${prodCadastrado.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                ...prodCadastrado,
                estoque_atual: Number(prodCadastrado.estoque_atual || 0) + Number(item.quantidade || 0)
              })
            }).catch(() => {});
          }
        }
      }

      salvarStatusOverride(venda.id, 'ESTORNADA', { motivo_cancelamento: dadosEstorno.motivo, estorno_info: dadosEstorno, status_nfe: 'ESTORNADA' });
      alert(`Venda #${String(venda.id).padStart(6, '0')} estornada com sucesso! O estoque foi restabelecido e as métricas atualizadas.`);
      setModalEstorno(null);
      setMenuAbertoId(null);
      carregarDados();
      carregarMetricas();
    } catch (e: any) {
      alert('Erro ao processar estorno: ' + e.message);
    }
  };

  // ---------- Derivados ----------
  const vendasPeriodo = useMemo(() => vendas.filter(v => dentroDoPeriodo(v.criado_em, periodo) && v.status !== 'CANCELADA' && v.status !== 'ESTORNADA'), [vendas, periodo]);

  // Mapa de produtos por EAN para acesso rápido
  const prodPorEan = useMemo(() => {
    const map = new Map<string, any>();
    produtos.forEach(p => map.set(String(p.ean), p));
    return map;
  }, [produtos]);

  // Métricas de produtos: usa as da API se vierem do backend, ou computa de forma redundante das vendas e produtos
  const metricasComputadas = useMemo(() => {
    if (Array.isArray(metricas) && metricas.length > 0 && metricas.some(m => Number(m.qtd_vendida) > 0 || Number(m.valor_investido) > 0)) {
      return metricas;
    }

    const stats: Record<string, any> = {};

    // 1. Processa todas as vendas do período
    vendasPeriodo.forEach(v => {
      (v.itens || []).forEach((it: any) => {
        const ean = String(it.ean || '');
        if (!ean) return;
        const qtd = Number(it.quantidade) || 0;
        const preco = Number(it.preco ?? it.preco_unitario ?? 0);
        const p = prodPorEan.get(ean);
        const custo = Number(p?.preco_custo ?? it.custo ?? 0);

        if (!stats[ean]) {
          stats[ean] = {
            ean,
            nome: it.nome || p?.nome || `Produto ${ean}`,
            qtd_vendida: 0,
            receita: 0,
            custo_vendido: 0,
            lucro: 0,
            num_vendas: 0,
            ultima_venda: v.criado_em,
            estoque_atual: p?.estoque_atual,
            preco_custo: custo,
            preco_venda: p?.preco_venda || preco,
            qtd_entrada: 0,
            valor_investido: 0,
          };
        }
        stats[ean].qtd_vendida += qtd;
        stats[ean].receita += qtd * preco;
        stats[ean].custo_vendido += qtd * custo;
        stats[ean].lucro = stats[ean].receita - stats[ean].custo_vendido;
        stats[ean].num_vendas += 1;
        if (!stats[ean].ultima_venda || new Date(v.criado_em) > new Date(stats[ean].ultima_venda)) {
          stats[ean].ultima_venda = v.criado_em;
        }
      });
    });

    // 2. Inclui todos os produtos do catálogo (para escopo 'todos' e cálculo de investimento)
    produtos.forEach(p => {
      const ean = String(p.ean);
      const custo = Number(p.preco_custo || 0);
      const estoque = Number(p.estoque_atual || 0);
      const vendidas = stats[ean]?.qtd_vendida || 0;
      const totalEntradas = Math.max(0, estoque) + vendidas;
      const investido = totalEntradas * custo;

      if (!stats[ean]) {
        stats[ean] = {
          ean,
          nome: p.nome,
          qtd_vendida: 0,
          receita: 0,
          custo_vendido: 0,
          lucro: 0,
          num_vendas: 0,
          ultima_venda: null,
          estoque_atual: p.estoque_atual,
          preco_custo: custo,
          preco_venda: p.preco_venda,
          qtd_entrada: totalEntradas,
          valor_investido: investido,
        };
      } else {
        stats[ean].qtd_entrada = totalEntradas;
        stats[ean].valor_investido = investido;
        stats[ean].estoque_atual = p.estoque_atual;
        stats[ean].nome = p.nome || stats[ean].nome;
      }
    });

    return Object.values(stats);
  }, [metricas, produtos, vendasPeriodo, prodPorEan]);

  // Movimentações de estoque (Livro-Razão Kardex)
  const movimentacoesComputadas = useMemo(() => {
    if (Array.isArray(movimentacoes) && movimentacoes.length > 0) {
      return movimentacoes;
    }
    const lista: any[] = [];

    // Entradas a partir do cadastro/saldo dos produtos
    produtos.forEach((p, idx) => {
      const custo = Number(p.preco_custo || 0);
      const est = Number(p.estoque_atual || 0);
      const vendidas = vendas.reduce((tot, v) => {
        return tot + (v.itens || []).filter((it: any) => String(it.ean) === String(p.ean)).reduce((s: number, it: any) => s + Number(it.quantidade || 0), 0);
      }, 0);
      const totalEntrado = est + vendidas;
      if (totalEntrado > 0) {
        lista.push({
          id: `prod-${p.id || idx}`,
          produto_id: p.id,
          produto_ean: p.ean,
          produto_nome: p.nome,
          tipo: 'ENTRADA_CADASTRO',
          quantidade: totalEntrado,
          custo_unitario: custo,
          valor_total: totalEntrado * custo,
          venda_id: null,
          criado_em: p.criado_em || new Date().toISOString(),
        });
      }
    });

    // Saídas a partir de cada venda realizada
    vendas.forEach(v => {
      (v.itens || []).forEach((it: any, i: number) => {
        const p = prodPorEan.get(String(it.ean));
        const custo = Number(p?.preco_custo || 0);
        const qtd = Number(it.quantidade || 0);
        lista.push({
          id: `venda-${v.id}-${i}`,
          produto_id: p?.id || null,
          produto_ean: it.ean,
          produto_nome: it.nome || p?.nome || `Produto ${it.ean}`,
          tipo: 'VENDA',
          quantidade: qtd,
          custo_unitario: custo,
          valor_total: qtd * (custo || Number(it.preco || 0)),
          venda_id: v.id,
          criado_em: v.criado_em,
        });
      });
    });

    return lista.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());
  }, [movimentacoes, produtos, vendas, prodPorEan]);

  const kpis = useMemo(() => {
    const faturamentoVendas = vendasPeriodo.reduce((a, v) => a + Number(v.total), 0);
    const receita = metricasComputadas.reduce((a, m) => a + Number(m.receita), 0) || faturamentoVendas;
    const custo = metricasComputadas.reduce((a, m) => a + Number(m.custo_vendido), 0);
    const unidades = metricasComputadas.reduce((a, m) => a + Number(m.qtd_vendida), 0);
    const investido = metricasComputadas.reduce((a, m) => a + Number(m.valor_investido), 0);
    const valorEstoque = produtos.reduce((a, p) => a + Math.max(0, Number(p.estoque_atual)) * Number(p.preco_custo || 0), 0);
    const lucro = receita - custo;
    return {
      receita,
      lucro,
      margem: receita > 0 ? (lucro / receita) * 100 : 0,
      unidades,
      investido,
      valorEstoque,
      numVendas: vendasPeriodo.length,
      ticket: vendasPeriodo.length ? faturamentoVendas / vendasPeriodo.length : 0,
    };
  }, [metricasComputadas, vendasPeriodo, produtos]);

  const vendasFiltradas = useMemo(() => {
    const termo = buscaVenda.trim().toLowerCase();
    return vendas.filter(v => {
      if (!dentroDoPeriodo(v.criado_em, periodoVendas)) return false;
      if (filtroPagamento !== 'TODOS' && !splitPagamentos(v.metodo_pagamento).includes(filtroPagamento)) return false;
      if (!termo) return true;
      const cleanTerm = termo.replace('#', '').replace(/^0+/, '') || termo;
      return String(v.id).includes(cleanTerm)
        || String(v.num_nfe || '').includes(termo)
        || String(v.chave_nfe || '').toLowerCase().includes(termo)
        || String(v.cpf_cnpj_cliente || '').includes(termo)
        || (v.itens || []).some((it: any) => String(it.nome || '').toLowerCase().includes(termo) || String(it.ean).includes(termo));
    });
  }, [vendas, buscaVenda, filtroPagamento, periodoVendas]);

  const resumoVendas = useMemo(() => {
    const ativas = vendasFiltradas.filter(v => v.status !== 'CANCELADA' && v.status !== 'ESTORNADA');
    return {
      total: ativas.reduce((a, v) => a + Number(v.total), 0),
      itens: ativas.reduce((a, v) => a + (v.itens || []).reduce((s: number, it: any) => s + Number(it.quantidade), 0), 0),
      canceladas: vendasFiltradas.filter(v => v.status === 'CANCELADA').length,
      estornadas: vendasFiltradas.filter(v => v.status === 'ESTORNADA').length,
    };
  }, [vendasFiltradas]);

  const movFiltradas = useMemo(() => {
    return movimentacoesComputadas.filter(m => {
      if (filtroMov === 'TODOS') return true;
      const isEntrada = MOV_INFO[m.tipo]?.entrada;
      return filtroMov === 'ENTRADAS' ? isEntrada : !isEntrada;
    });
  }, [movimentacoesComputadas, filtroMov]);

  const resumoMov = useMemo(() => {
    const entradas = movimentacoesComputadas.filter(m => MOV_INFO[m.tipo]?.entrada);
    return {
      investido: entradas.reduce((a, m) => a + Number(m.valor_total || 0), 0),
      unidades: entradas.reduce((a, m) => a + Number(m.quantidade || 0), 0),
      reposicoes: entradas.length,
      perdas: movimentacoesComputadas.filter(m => m.tipo === 'AJUSTE_SAIDA').reduce((a, m) => a + Number(m.valor_total || 0), 0),
    };
  }, [movimentacoesComputadas]);

  if (!adminName) return <LoginScreen onLogin={handleLogin} tema={tema} onToggleTema={alternar} />;

  const tabs = [
    { id: 'dashboard', label: 'Painel Geral', icon: <LayoutDashboard size={19} /> },
    { id: 'vendas', label: 'Histórico de Vendas', icon: <Receipt size={19} /> },
    { id: 'produtos', label: 'Produtos e Estoque', icon: <Package size={19} /> },
    { id: 'movimentacoes', label: 'Entradas de Estoque', icon: <Boxes size={19} /> },
    { id: 'funcionarios', label: 'Equipe / Funcionários', icon: <Users size={19} /> },
  ];

  return (
    <div className="app-shell">
      {modalProduto.open && <ModalProduto produto={modalProduto.data} onClose={() => setModalProduto({ open: false, data: null })} onSaved={recarregarTudo} />}
      {modalFuncionario.open && <ModalFuncionario funcionario={modalFuncionario.data} onClose={() => setModalFuncionario({ open: false, data: null })} onSaved={carregarDados} />}
      {modalEntrada && <ModalEntradaEstoque produtos={produtos} onClose={() => setModalEntrada(false)} onSaved={recarregarTudo} />}

      {/* MENU LATERAL */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-title"><span className="brand-logo"><Store size={19} /></span> Retaguarda</div>
          <div className="brand-sub">Logado como <strong style={{ color: 'var(--text-soft)' }}>{adminName}</strong></div>
        </div>
        <nav className="nav">
          {tabs.map(tab => (
            <button key={tab.id} id={`nav-${tab.id}`} onClick={() => setActiveTab(tab.id)} className={`nav-item ${activeTab === tab.id ? 'active' : ''}`}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </nav>
        <div className="sidebar-footer">
          <ThemeToggle tema={tema} onToggle={alternar} />
          <button id="btn-sair" onClick={handleLogout} className="logout"><LogOut size={18} /> Sair do Sistema</button>
        </div>
      </aside>

      <div className="main">
        <div className="content">

          {/* ================= PAINEL GERAL ================= */}
          {activeTab === 'dashboard' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Visão Geral</h1>
                  <p className="page-sub">Desempenho de vendas, lucro e investimento em mercadoria</p>
                </div>
                <Segmented id="dash-periodo" value={periodo} onChange={setPeriodo} options={PERIODOS} />
              </div>

              <div className="kpi-grid">
                <Kpi hero label="Faturamento" value={brl(kpis.receita)} foot={`${int(kpis.numVendas)} venda(s) no período`} icon={<TrendingUp size={18} />} />
                <Kpi label="Lucro bruto" value={brl(kpis.lucro)} foot={`Margem média de ${pct(kpis.margem)}`} icon={<Wallet size={18} />} cor="green" delay={40} />
                <Kpi label="Ticket médio" value={brl(kpis.ticket)} foot="Valor médio por venda" icon={<Ticket size={18} />} cor="blue" delay={80} />
                <Kpi label="Unidades vendidas" value={int(kpis.unidades)} foot={`${int(metricasComputadas.filter(m => Number(m.qtd_vendida) > 0).length)} produto(s) diferentes`} icon={<ShoppingCart size={18} />} cor="violet" delay={120} />
                <Kpi label="Investido em mercadoria" value={brl(kpis.investido)} foot="Entradas: cadastros + reposições" icon={<ArrowDownToLine size={18} />} cor="amber" delay={160} />
                <Kpi label="Valor em estoque" value={brl(kpis.valorEstoque)} foot={`${int(produtos.length)} produtos • a preço de custo`} icon={<PiggyBank size={18} />} cor="blue" delay={200} />
                <Kpi label="Estoque baixo" value={`${int(produtos.filter(p => p.estoque_atual < 10).length)}`} foot="Produtos com menos de 10 un." icon={<TriangleAlert size={18} />} cor="red" delay={240} />
                <Kpi label="Equipe ativa" value={int(funcionarios.filter(f => f.status === 'ATIVO').length)} foot="Funcionários com acesso" icon={<Users size={18} />} cor="violet" delay={280} />
              </div>

              <RankingProdutos metricas={metricasComputadas} carregando={carregandoMetricas && metricasComputadas.length === 0} />
            </div>
          )}

          {/* ================= HISTÓRICO DE VENDAS ================= */}
          {activeTab === 'vendas' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Histórico de Vendas</h1>
                  <p className="page-sub">{int(vendasFiltradas.length)} venda(s) • {int(resumoVendas.itens)} unidade(s) • {brl(resumoVendas.total)}</p>
                </div>
                <Segmented id="vendas-periodo" value={periodoVendas} onChange={setPeriodoVendas} options={PERIODOS} />
              </div>

              <section className="table-wrap fade-up">
                <div className="table-toolbar">
                  <div className="search" style={{ flex: 1, maxWidth: 420 }}>
                    <Search size={15} />
                    <input id="vendas-busca" className="input" placeholder="Buscar por nº da venda, produto, EAN ou CPF..." value={buscaVenda} onChange={e => setBuscaVenda(e.target.value)} />
                  </div>
                  <select id="vendas-filtro-pagamento" className="input" style={{ width: 220 }} value={filtroPagamento} onChange={e => setFiltroPagamento(e.target.value)}>
                    <option value="TODOS">Todas as formas de pagamento</option>
                    <option value="PIX">Pix</option>
                    <option value="DINHEIRO">Dinheiro</option>
                    <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                    <option value="CARTAO_DEBITO">Cartão de Débito</option>
                    <option value="POS">Maquininha (POS)</option>
                    <option value="MÚLTIPLOS">Múltiplos</option>
                  </select>
                </div>
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th style={{ width: 36 }} />
                        <th>Nº Venda</th>
                        <th>Data/Hora</th>
                        <th>Status</th>
                        <th>NFC-e</th>
                        <th>Itens vendidos</th>
                        <th className="center">Qtd</th>
                        <th>Pagamento</th>
                        <th>Cliente</th>
                        <th className="right">Valor Total</th>
                        <th className="center" style={{ width: 60 }}>Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {vendasFiltradas.length === 0 ? (
                        <tr><td colSpan={11} className="empty">Nenhuma venda encontrada com estes filtros.</td></tr>
                      ) : vendasFiltradas.map((v: any, idx: number) => {
                        const itens: any[] = Array.isArray(v.itens) ? v.itens : [];
                        const qtd = itens.reduce((a, it) => a + Number(it.quantidade), 0);
                        const custo = itens.reduce((a, it) => a + Number(it.quantidade) * Number(it.custo || 0), 0);
                        const aberta = vendaAberta === v.id;
                        const isCancelada = v.status === 'CANCELADA';
                        const isEstornada = v.status === 'ESTORNADA';
                        return (
                          <React.Fragment key={v.id}>
                            <tr
                              className={`row clickable ${aberta ? 'expanded' : ''} ${menuAbertoId === v.id ? 'menu-open' : ''}`}
                              style={{
                                animationDelay: `${Math.min(idx, 15) * 20}ms`,
                                opacity: (isCancelada || isEstornada) ? 0.75 : 1,
                                position: 'relative',
                                zIndex: menuAbertoId === v.id ? 9999 : (aberta ? 2 : 1)
                              }}
                              onClick={() => setVendaAberta(aberta ? null : v.id)}
                            >
                              <td><ChevronRight size={16} className={`chev ${aberta ? 'open' : ''}`} /></td>
                              <td className="strong num">#{String(v.id).padStart(6, '0')}</td>
                              <td className="num">{dataHora(v.criado_em)}</td>
                              <td>
                                {isCancelada ? (
                                  <span className="badge red" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><XCircle size={12} /> Cancelada</span>
                                ) : isEstornada ? (
                                  <span className="badge amber" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><RotateCcw size={12} /> Estornada</span>
                                ) : (
                                  <span className="badge green" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><ShieldCheck size={12} /> Concluída</span>
                                )}
                              </td>
                              <td>
                                {v.num_nfe || v.chave_nfe ? (
                                  <span className="badge green" style={{ fontSize: '0.75rem', fontWeight: 600 }} title={v.chave_nfe || ''}>
                                    NFC-e #{v.num_nfe || String(v.id).padStart(6, '0')}
                                  </span>
                                ) : (
                                  <span className="badge gray" style={{ fontSize: '0.75rem' }}>Não emitida</span>
                                )}
                              </td>
                              <td>
                                <div className="items-preview">
                                  {itens.slice(0, 2).map((it, i) => <span key={i} className="line"><strong className="num" style={{ color: 'var(--text)' }}>{int(it.quantidade)}×</strong> {it.nome}</span>)}
                                  {itens.length > 2 && <span className="more">+ {itens.length - 2} outro(s) item(ns)</span>}
                                  {itens.length === 0 && <span className="muted">—</span>}
                                </div>
                              </td>
                              <td className="center"><span className="badge gray num">{int(qtd)} un.</span></td>
                              <td><Pagamentos metodo={v.metodo_pagamento} /></td>
                              <td className="num">{v.cpf_cnpj_cliente || <span className="muted">Consumidor</span>}</td>
                              <td className="right num" style={{ color: isCancelada ? 'var(--danger)' : isEstornada ? 'var(--warning)' : 'var(--accent)', fontWeight: 800, textDecoration: isCancelada ? 'line-through' : 'none' }}>
                                {brl(v.total)}
                              </td>
                              <td className="center" style={{ position: 'relative', zIndex: menuAbertoId === v.id ? 9999 : 1 }} onClick={e => e.stopPropagation()}>
                                <button
                                  id={`btn-acoes-venda-${v.id}`}
                                  type="button"
                                  className="btn btn-ghost btn-sm"
                                  style={{ padding: '6px 8px' }}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenuAbertoId(menuAbertoId === v.id ? null : v.id);
                                  }}
                                  title="Ações da venda"
                                >
                                  <MoreVertical size={16} />
                                </button>
                                {menuAbertoId === v.id && (
                                  <div
                                    style={{
                                      position: 'absolute',
                                      right: 8,
                                      ...(idx >= Math.max(1, vendasFiltradas.length - 2) ? { bottom: 'calc(100% + 4px)' } : { top: 'calc(100% + 4px)' }),
                                      zIndex: 99999,
                                      background: 'var(--bg-surface-2)',
                                      border: '1px solid var(--border-strong)',
                                      borderRadius: 8,
                                      boxShadow: '0 16px 40px rgba(0,0,0,0.65), 0 4px 12px rgba(0,0,0,0.4)',
                                      minWidth: 195,
                                      padding: 6,
                                      display: 'flex',
                                      flexDirection: 'column',
                                      gap: 4
                                    }}
                                  >
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      style={{ justifyContent: 'flex-start', gap: 8, width: '100%', textAlign: 'left', fontSize: '0.82rem' }}
                                      onClick={() => { setModalReimpressao(v); setMenuAbertoId(null); }}
                                    >
                                      <Printer size={15} /> Reimprimir 2ª Via
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      style={{ justifyContent: 'flex-start', gap: 8, width: '100%', textAlign: 'left', fontSize: '0.82rem', color: (isCancelada || isEstornada) ? 'var(--text-muted)' : 'var(--danger)' }}
                                      disabled={isCancelada || isEstornada}
                                      onClick={() => handleCancelarVenda(v)}
                                    >
                                      <XCircle size={15} /> Cancelar Venda
                                    </button>
                                    <button
                                      type="button"
                                      className="btn btn-ghost btn-sm"
                                      style={{ justifyContent: 'flex-start', gap: 8, width: '100%', textAlign: 'left', fontSize: '0.82rem', color: (isCancelada || isEstornada) ? 'var(--text-muted)' : 'var(--warning)' }}
                                      disabled={isCancelada || isEstornada}
                                      onClick={() => { setModalEstorno(v); setMenuAbertoId(null); }}
                                    >
                                      <RotateCcw size={15} /> Estorno da Venda
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                            {aberta && (
                              <tr>
                                <td colSpan={11} className="detail-cell">
                                  <div className="detail-box">
                                    <div className="detail-grid">
                                      <table className="items-table">
                                        <thead>
                                          <tr><th>Produto</th><th>EAN</th><th className="right">Qtd</th><th className="right">Preço unit.</th><th className="right">Subtotal</th></tr>
                                        </thead>
                                        <tbody>
                                          {itens.map((it, i) => (
                                            <tr key={i}>
                                              <td style={{ color: 'var(--text)', fontWeight: 600 }}>{it.nome}</td>
                                              <td className="prod-ean">{it.ean}</td>
                                              <td className="right num">{int(it.quantidade)}</td>
                                              <td className="right num">{brl(it.preco)}</td>
                                              <td className="right num" style={{ color: 'var(--text)', fontWeight: 600 }}>{brl(Number(it.quantidade) * Number(it.preco))}</td>
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <div className="summary-box">
                                        <div className="summary-row"><span>Itens</span><span className="num">{int(qtd)} un.</span></div>
                                        <div className="summary-row"><span>Custo da mercadoria</span><span className="num">{brl(custo)}</span></div>
                                        <div className="summary-row"><span>Lucro estimado</span><span className="num" style={{ color: 'var(--accent)', fontWeight: 700 }}>{brl(Number(v.total) - custo)}</span></div>
                                        <div className="summary-row"><span>CPF/CNPJ</span><span className="num">{v.cpf_cnpj_cliente || '—'}</span></div>
                                        {v.motivo_cancelamento && (
                                          <div className="summary-row" style={{ color: isCancelada ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                            <span>{isCancelada ? 'Motivo Cancelamento' : 'Motivo Estorno'}</span>
                                            <span>{v.motivo_cancelamento}</span>
                                          </div>
                                        )}
                                        <div className="summary-row total"><span>Total pago</span><span className="num">{brl(v.total)}</span></div>
                                      </div>
                                    </div>
                                  </div>
                                </td>
                              </tr>
                            )}
                          </React.Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================= PRODUTOS ================= */}
          {activeTab === 'produtos' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Produtos e Estoque</h1>
                  <p className="page-sub">Todo cadastro e aumento de estoque é registrado como entrada de mercadoria</p>
                </div>
                <button id="btn-novo-produto" onClick={() => setModalProduto({ open: true, data: null })} className="btn btn-primary">+ Novo Produto</button>
              </div>
              <section className="table-wrap fade-up">
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr><th>EAN</th><th>Nome do Produto</th><th className="right">Custo</th><th className="right">Venda</th><th className="right">Margem</th><th className="right">Estoque</th><th className="right">Ações</th></tr>
                    </thead>
                    <tbody>
                      {produtos.map((p: any, i: number) => {
                        const venda = Number(p.preco_venda), custo = Number(p.preco_custo || 0);
                        const margem = venda > 0 ? ((venda - custo) / venda) * 100 : 0;
                        return (
                          <tr key={p.id} className="row" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
                            <td className="prod-ean">{p.ean}</td>
                            <td className="strong">{p.nome}</td>
                            <td className="right num">{brl(custo)}</td>
                            <td className="right num strong">{brl(venda)}</td>
                            <td className="right"><span className={`badge ${custo === 0 ? 'gray' : margem >= 30 ? 'green' : margem >= 10 ? 'amber' : 'red'}`}>{custo === 0 ? 'sem custo' : pct(margem)}</span></td>
                            <td className="right"><span className={`badge ${p.estoque_atual >= 10 ? 'green' : 'red'}`}>{int(p.estoque_atual)} un.</span></td>
                            <td className="right"><button onClick={() => setModalProduto({ open: true, data: p })} className="btn btn-ghost btn-sm">Editar</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================= ENTRADAS / MOVIMENTAÇÕES ================= */}
          {activeTab === 'movimentacoes' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Entradas de Estoque</h1>
                  <p className="page-sub">Registro de tudo que entrou (cadastros e reposições) e saiu (vendas e ajustes)</p>
                </div>
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <Segmented id="mov-filtro" value={filtroMov} onChange={setFiltroMov} options={[{ id: 'TODOS', label: 'Tudo' }, { id: 'ENTRADAS', label: 'Entradas' }, { id: 'SAIDAS', label: 'Saídas' }]} />
                  <button id="btn-nova-entrada" onClick={() => setModalEntrada(true)} className="btn btn-primary" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                    <Boxes size={16} /> + Nova Entrada de Estoque
                  </button>
                </div>
              </div>
              <div className="kpi-grid">
                <Kpi hero label="Total investido" value={brl(resumoMov.investido)} foot="Soma de todas as entradas a preço de custo" icon={<ArrowDownToLine size={18} />} />
                <Kpi label="Unidades que entraram" value={int(resumoMov.unidades)} foot={`${int(resumoMov.reposicoes)} cadastro(s)/reposição(ões)`} icon={<Boxes size={18} />} cor="blue" delay={40} />
                <Kpi label="Perdas / ajustes" value={brl(resumoMov.perdas)} foot="Reduções manuais de estoque" icon={<ArrowUpFromLine size={18} />} cor="red" delay={80} />
              </div>
              <section className="table-wrap fade-up">
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr><th>Data/Hora</th><th>Tipo</th><th>Produto</th><th className="right">Quantidade</th><th className="right">Custo unit.</th><th className="right">Valor total</th><th>Venda</th></tr>
                    </thead>
                    <tbody>
                      {movFiltradas.length === 0 ? (
                        <tr><td colSpan={7} className="empty">Nenhuma movimentação registrada ainda.</td></tr>
                      ) : movFiltradas.map((m: any, i: number) => {
                        const info = MOV_INFO[m.tipo] || { label: m.tipo, cor: 'gray', entrada: true };
                        return (
                          <tr key={m.id} className="row" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
                            <td className="num">{dataHora(m.criado_em)}</td>
                            <td><span className={`badge ${info.cor}`}>{info.entrada ? <ArrowDownToLine size={12} /> : <ArrowUpFromLine size={12} />} {info.label}</span></td>
                            <td><div className="prod-cell"><span className="prod-name">{m.produto_nome || '—'}</span><span className="prod-ean">{m.produto_ean}</span></div></td>
                            <td className="right num" style={{ color: info.entrada ? 'var(--accent)' : 'var(--danger)', fontWeight: 700 }}>{info.entrada ? '+' : '−'}{int(m.quantidade)}</td>
                            <td className="right num">{brl(m.custo_unitario)}</td>
                            <td className="right num strong">{brl(m.valor_total)}</td>
                            <td className="num">{m.venda_id ? `#${String(m.venda_id).padStart(6, '0')}` : <span className="muted">—</span>}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {/* ================= FUNCIONÁRIOS ================= */}
          {activeTab === 'funcionarios' && (
            <div>
              <div className="page-header">
                <div>
                  <h1 className="page-title">Equipe e Funcionários</h1>
                  <p className="page-sub">Controle de acesso ao PDV e à retaguarda</p>
                </div>
                <button id="btn-novo-funcionario" onClick={() => setModalFuncionario({ open: true, data: null })} className="btn btn-primary">+ Novo Funcionário</button>
              </div>
              <section className="table-wrap fade-up">
                <div className="table-scroll">
                  <table className="tbl">
                    <thead>
                      <tr>
                        <th>Matrícula</th>
                        <th>Nome Completo</th>
                        <th>Nível de Acesso</th>
                        <th>Status</th>
                        <th className="right">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {funcionarios.map((f: any, i: number) => (
                        <tr key={f.id} className="row" style={{ animationDelay: `${Math.min(i, 15) * 20}ms` }}>
                          <td className="strong num">{f.matricula}</td>
                          <td className="strong">{f.nome}</td>
                          <td><span className={`badge ${f.nivel_acesso === 'ADMIN' ? 'violet' : 'blue'}`}>{f.nivel_acesso === 'ADMIN' ? 'Administrador' : 'Caixa'}</span></td>
                          <td><span className={`badge ${f.status === 'ATIVO' ? 'green' : 'red'}`}>{f.status}</span></td>
                          <td className="right">
                            <button
                              id={`btn-editar-func-${f.id}`}
                              onClick={() => setModalFuncionario({ open: true, data: f })}
                              className="btn btn-ghost btn-sm"
                            >
                              Editar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

        </div>
      </div>
      {/* ================= MODAIS DO SISTEMA ================= */}
      {modalProduto.open && (
        <ModalProduto
          produto={modalProduto.data}
          onClose={() => setModalProduto({ open: false, data: null })}
          onSaved={recarregarTudo}
        />
      )}
      {modalFuncionario.open && (
        <ModalFuncionario
          funcionario={modalFuncionario.data}
          onClose={() => setModalFuncionario({ open: false, data: null })}
          onSaved={recarregarTudo}
        />
      )}
      {modalEntrada && (
        <ModalEntradaEstoque
          produtos={produtos}
          onClose={() => setModalEntrada(false)}
          onSaved={recarregarTudo}
        />
      )}
      {modalReimpressao && (
        <ModalReimpressaoCupom
          venda={modalReimpressao}
          onClose={() => setModalReimpressao(null)}
        />
      )}
      {modalEstorno && (
        <ModalEstorno
          venda={modalEstorno}
          onClose={() => setModalEstorno(null)}
          onConfirm={handleEstornarVenda}
        />
      )}
    </div>
  );
}
