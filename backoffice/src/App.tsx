import React, { useState, useEffect } from 'react';
import { Users, Package, LayoutDashboard, LogOut, Receipt } from 'lucide-react';

const API = 'http://localhost:3000';

const theme = {
  bgMain: '#111827', // Fundo escuro igual ao PDV
  bgPanel: '#1f2937', // Painel lateral e caixas
  bgApp: '#f3f4f6', // Fundo cinza claro para o conteúdo do ADM
  accent: '#10b981', // Verde esmeralda (padrão original)
  textMain: '#1f2937',
  textLight: '#f9fafb',
  textMuted: '#9ca3af',
  danger: '#ef4444',
  border: '#374151'
};

const styles = {
  overlay: { position: 'fixed' as const, inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  modal: { backgroundColor: 'white', borderRadius: '8px', padding: '30px', width: '500px', maxHeight: '90vh', overflowY: 'auto' as const, boxShadow: '0 10px 25px rgba(0,0,0,0.2)' },
  inputGroup: { marginBottom: '14px' },
  label: { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '4px' },
  input: { width: '100%', padding: '10px 12px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '0.95rem', boxSizing: 'border-box' as const },
  btnPrimary: { backgroundColor: theme.accent, color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', fontWeight: 'bold' as const, cursor: 'pointer', fontSize: '0.95rem' },
  btnSecondary: { backgroundColor: '#6b7280', color: 'white', border: 'none', padding: '10px 20px', borderRadius: '4px', cursor: 'pointer', fontSize: '0.95rem' },
  th: { padding: '12px 16px', fontSize: '0.8rem', fontWeight: 600, color: 'white', backgroundColor: theme.bgPanel, textAlign: 'left' as const },
  td: { padding: '12px 16px', fontSize: '0.85rem', color: theme.textMain, borderBottom: '1px solid #e5e7eb', textAlign: 'left' as const },
};

// ==========================================
// TELA DE LOGIN (IDÊNTICA AO PDV)
// ==========================================
function LoginScreen({ onLogin }: { onLogin: (nome: string) => void }) {
  const [matricula, setMatricula] = useState('');
  const [senha, setSenha] = useState('');
  const [erro, setErro] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErro('');
    try {
      const res = await fetch(`${API}/auth`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula, senha }) });
      if (!res.ok) { setErro('Acesso Negado: Matrícula ou senha incorretos!'); return; }
      const data = await res.json();
      if (data.nivel !== 'ADMIN') { setErro('Acesso Negado: Você não tem permissão de Administrador.'); return; }
      localStorage.setItem('adm_token', data.token);
      onLogin(data.nome);
    } catch { setErro('Erro crítico: Servidor Banco de Dados Offline.'); }
  };

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: theme.bgMain, alignItems: 'center', justifyContent: 'center', fontFamily: 'system-ui, sans-serif' }}>
      <form onSubmit={handleSubmit} style={{ backgroundColor: theme.bgPanel, padding: '3rem', borderRadius: '16px', border: `1px solid ${theme.border}`, textAlign: 'center', minWidth: '350px' }}>
        <h2 style={{ color: theme.accent, marginBottom: '2rem' }}>🔒 ACESSO RESTRITO (ADM)</h2>
        {erro && <div style={{ color: theme.danger, marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 'bold' }}>{erro}</div>}
        
        <input type="text" placeholder="Matrícula (Ex: 12345)" maxLength={5} value={matricula} onChange={e => setMatricula(e.target.value)} 
          style={{ width: '100%', padding: '1rem', marginBottom: '1rem', backgroundColor: theme.border, color: 'white', border: 'none', borderRadius: '8px', boxSizing: 'border-box' }} />
        
        <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} 
          style={{ width: '100%', padding: '1rem', marginBottom: '2rem', backgroundColor: theme.border, color: 'white', border: 'none', borderRadius: '8px', boxSizing: 'border-box' }} />
        
        <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: theme.accent, color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', fontSize: '1rem' }}>
          ENTRAR NO PAINEL
        </button>
      </form>
    </div>
  );
}

function ModalProduto({ produto, onClose, onSaved }: any) {
  const [ean, setEan] = useState(produto?.ean || '');
  const [nome, setNome] = useState(produto?.nome || '');
  const [precoCusto, setPrecoCusto] = useState(produto?.preco_custo?.toString() || '');
  const [precoVenda, setPrecoVenda] = useState(produto?.preco_venda?.toString() || '');
  const [estoque, setEstoque] = useState(produto?.estoque_atual?.toString() || '');
  
  const handleSave = async () => {
    if (!ean || !nome || !precoVenda || !estoque) return alert('Preencha os campos obrigatórios');
    const token = localStorage.getItem('adm_token');
    await fetch(produto ? `${API}/admin/produtos/${produto.id}` : `${API}/admin/produtos`, {
      method: produto ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
      body: JSON.stringify({ ean, nome, preco_custo: Number(precoCusto)||0, preco_venda: Number(precoVenda), estoque_atual: Number(estoque) })
    });
    onSaved(); onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}><div style={styles.modal} onClick={e=>e.stopPropagation()}>
      <h3 style={{marginTop:0, marginBottom:'20px', color: theme.textMain}}>{produto?'Editar Produto':'Novo Produto'}</h3>
      <div style={styles.inputGroup}><label style={styles.label}>Código de Barras (EAN)</label><input value={ean} onChange={e=>setEan(e.target.value)} style={styles.input} /></div>
      <div style={styles.inputGroup}><label style={styles.label}>Nome do Produto</label><input value={nome} onChange={e=>setNome(e.target.value)} style={styles.input} /></div>
      <div style={styles.inputGroup}><label style={styles.label}>Preço de Custo (R$)</label><input type="number" value={precoCusto} onChange={e=>setPrecoCusto(e.target.value)} style={styles.input} /></div>
      <div style={styles.inputGroup}><label style={styles.label}>Preço de Venda (R$)</label><input type="number" value={precoVenda} onChange={e=>setPrecoVenda(e.target.value)} style={styles.input} /></div>
      <div style={{...styles.inputGroup, marginBottom:'20px'}}><label style={styles.label}>Estoque Inicial</label><input type="number" value={estoque} onChange={e=>setEstoque(e.target.value)} style={styles.input} /></div>
      <div style={{display:'flex', gap:'10px', justifyContent:'flex-end'}}>
        <button onClick={onClose} style={styles.btnSecondary}>Cancelar</button>
        <button onClick={handleSave} style={styles.btnPrimary}>Salvar Produto</button>
      </div>
    </div></div>
  );
}

// ==========================================
// PAINEL ADMINISTRATIVO PRINCIPAL
// ==========================================
export default function App() {
  const [adminName, setAdminName] = useState<string | null>(() => localStorage.getItem('adm_operatorName'));
  const [activeTab, setActiveTab] = useState('dashboard');
  const [produtos, setProdutos] = useState<any[]>([]);
  const [funcionarios, setFuncionarios] = useState<any[]>([]);
  const [vendas, setVendas] = useState<any[]>([]);
  const [filtroPagamento, setFiltroPagamento] = useState('TODOS');
  
  const [modalProduto, setModalProduto] = useState<any>({ open: false, data: null });

  const carregarDados = async () => {
    const token = localStorage.getItem('adm_token');
    const headers = { 'Authorization': `Bearer ${token}` };
    fetch(`${API}/admin/produtos`, { headers }).then(r => r.json()).then(d => Array.isArray(d) && setProdutos(d)).catch(()=>{});
    fetch(`${API}/admin/funcionarios`, { headers }).then(r => r.json()).then(d => Array.isArray(d) && setFuncionarios(d)).catch(()=>{});
    fetch(`${API}/admin/vendas`, { headers }).then(r => r.json()).then(d => Array.isArray(d) && setVendas(d)).catch(()=>{});
  };

  useEffect(() => { if (adminName) carregarDados(); }, [adminName]);

  const handleLogin = (nome: string) => {
    localStorage.setItem('adm_operatorName', nome);
    setAdminName(nome);
  };

  const handleLogout = () => {
    localStorage.removeItem('adm_operatorName');
    localStorage.removeItem('adm_token');
    setAdminName(null);
  };

  if (!adminName) return <LoginScreen onLogin={handleLogin} />;

  const vendasFiltradas = filtroPagamento === 'TODOS' ? vendas : vendas.filter(v => v.metodo_pagamento === filtroPagamento);

  return (
    <div style={{ display: 'flex', height: '100vh', backgroundColor: theme.bgApp, fontFamily: 'system-ui, sans-serif' }}>
      
      {modalProduto.open && <ModalProduto produto={modalProduto.data} onClose={() => setModalProduto({ open: false, data: null })} onSaved={carregarDados} />}

      {/* MENU LATERAL ESCURO */}
      <div style={{ width: '250px', backgroundColor: theme.bgPanel, color: 'white', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '20px', borderBottom: `1px solid ${theme.border}`, textAlign: 'center' }}>
          <h2 style={{ margin: 0, color: theme.accent }}>🏢 Retaguarda</h2>
          <div style={{ fontSize: '0.8rem', color: theme.textMuted, marginTop: '5px' }}>Logado: {adminName}</div>
        </div>

        <div style={{ padding: '20px 0', display: 'flex', flexDirection: 'column', gap: '5px' }}>
          {[
            { id: 'dashboard', label: 'Painel Geral', icon: <LayoutDashboard size={20} /> },
            { id: 'vendas', label: 'Histórico de Vendas', icon: <Receipt size={20} /> },
            { id: 'produtos', label: 'Produtos e Estoque', icon: <Package size={20} /> },
            { id: 'funcionarios', label: 'Funcionários', icon: <Users size={20} /> },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
              display: 'flex', alignItems: 'center', gap: '15px', border: 'none', width: '100%',
              color: activeTab === tab.id ? 'white' : theme.textMuted,
              padding: '15px 25px', cursor: 'pointer', textAlign: 'left', fontSize: '1rem',
              backgroundColor: activeTab === tab.id ? theme.border : 'transparent', 
              borderLeft: activeTab === tab.id ? `4px solid ${theme.accent}` : '4px solid transparent',
              transition: 'all 0.2s'
            }}>
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        <div style={{ marginTop: 'auto', padding: '20px', borderTop: `1px solid ${theme.border}` }}>
          <button onClick={handleLogout} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'none', border: 'none', color: theme.danger, cursor: 'pointer', fontSize: '1rem', width: '100%' }}>
            <LogOut size={20} /> Sair do Sistema
          </button>
        </div>
      </div>

      {/* CONTEÚDO PRINCIPAL (BRANCO/CINZA CLARO) */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        
        <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
          
          {activeTab === 'dashboard' && (
            <div>
              <h2 style={{ color: theme.textMain, marginBottom: '20px' }}>Visão Geral</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px' }}>
                <div style={{ padding: '25px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.9rem', color: theme.textMuted, fontWeight: 'bold' }}>VENDAS TOTAIS</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: theme.textMain }}>{vendas.length}</div>
                </div>
                <div style={{ padding: '25px', backgroundColor: 'white', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.9rem', color: theme.textMuted, fontWeight: 'bold' }}>PRODUTOS CADASTRADOS</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: theme.textMain }}>{produtos.length}</div>
                </div>
                <div style={{ padding: '25px', backgroundColor: theme.accent, borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
                  <div style={{ fontSize: '0.9rem', color: 'rgba(255,255,255,0.8)', fontWeight: 'bold' }}>FATURAMENTO BRUTO</div>
                  <div style={{ fontSize: '2.5rem', fontWeight: 'bold', color: 'white' }}>R$ {vendas.reduce((acc, v) => acc + Number(v.total), 0).toFixed(2)}</div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'vendas' && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: theme.textMain, margin: 0 }}>Histórico de Vendas</h2>
                  
                  {/* FILTRO DE PAGAMENTO IMPLEMENTADO */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label style={{ fontWeight: 'bold', color: theme.textMain }}>Filtrar por Pagamento:</label>
                    <select 
                      value={filtroPagamento} 
                      onChange={e => setFiltroPagamento(e.target.value)}
                      style={{ padding: '8px 12px', borderRadius: '4px', border: '1px solid #d1d5db', fontSize: '0.95rem', cursor: 'pointer' }}
                    >
                      <option value="TODOS">Todas as Vendas</option>
                      <option value="PIX">Pix</option>
                      <option value="DINHEIRO">Dinheiro</option>
                      <option value="CARTAO_CREDITO">Cartão de Crédito</option>
                      <option value="CARTAO_DEBITO">Cartão de Débito</option>
                      <option value="POS">Maquininha (POS)</option>
                    </select>
                  </div>
               </div>
               
               <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr>
                    <th style={styles.th}>Nº Venda</th>
                    <th style={styles.th}>Data/Hora</th>
                    <th style={styles.th}>Método Pagamento</th>
                    <th style={styles.th}>Qtd Itens</th>
                    <th style={styles.th}>Valor Total</th>
                  </tr>
                </thead>
                <tbody>
                  {vendasFiltradas.length === 0 ? (
                    <tr><td colSpan={5} style={{...styles.td, textAlign: 'center', padding: '30px', color: theme.textMuted}}>Nenhuma venda encontrada com este filtro.</td></tr>
                  ) : vendasFiltradas.map((v: any) => (
                    <tr key={v.id} style={{ transition: 'background-color 0.2s' }} onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f9fafb'} onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                      <td style={{...styles.td, fontWeight: 'bold'}}>#{v.id.toString().padStart(6, '0')}</td>
                      <td style={styles.td}>{new Date(v.criado_em).toLocaleString('pt-BR')}</td>
                      <td style={styles.td}>
                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: '#e5e7eb', color: '#374151' }}>
                          {v.metodo_pagamento}
                        </span>
                      </td>
                      <td style={styles.td}>{v.itens ? v.itens.length : 0} unid.</td>
                      <td style={{...styles.td, fontWeight: 'bold', color: theme.accent}}>R$ {Number(v.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'produtos' && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: theme.textMain, margin: 0 }}>Gerenciamento de Produtos</h2>
                  <button onClick={() => setModalProduto({ open: true, data: null })} style={styles.btnPrimary}>+ Novo Produto</button>
               </div>
               <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr><th style={styles.th}>EAN</th><th style={styles.th}>Nome do Produto</th><th style={styles.th}>Preço Venda</th><th style={styles.th}>Estoque</th><th style={styles.th}>Ações</th></tr>
                </thead>
                <tbody>
                  {produtos.map((p: any) => (
                    <tr key={p.id}>
                      <td style={styles.td}>{p.ean}</td><td style={styles.td}>{p.nome}</td>
                      <td style={{...styles.td, fontWeight: 'bold'}}>R$ {Number(p.preco_venda).toFixed(2)}</td>
                      <td style={styles.td}>
                        <span style={{ color: p.estoque_atual > 10 ? theme.accent : theme.danger, fontWeight: 'bold' }}>
                          {p.estoque_atual} un
                        </span>
                      </td>
                      <td style={styles.td}><button onClick={() => setModalProduto({ open: true, data: p })} style={styles.btnSecondary}>Editar</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === 'funcionarios' && (
            <div>
               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h2 style={{ color: theme.textMain, margin: 0 }}>Quadro de Funcionários</h2>
               </div>
               <table style={{ width: '100%', backgroundColor: 'white', borderCollapse: 'collapse', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: '8px', overflow: 'hidden' }}>
                <thead>
                  <tr><th style={styles.th}>Matrícula</th><th style={styles.th}>Nome Completo</th><th style={styles.th}>Nível de Acesso</th><th style={styles.th}>Status</th></tr>
                </thead>
                <tbody>
                  {funcionarios.map((f: any) => (
                    <tr key={f.id}>
                      <td style={{...styles.td, fontWeight: 'bold'}}>{f.matricula}</td><td style={styles.td}>{f.nome}</td>
                      <td style={styles.td}>{f.nivel_acesso}</td>
                      <td style={styles.td}>
                        <span style={{ padding: '4px 8px', borderRadius: '12px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: f.status === 'ATIVO' ? '#d1fae5' : '#fee2e2', color: f.status === 'ATIVO' ? '#065f46' : '#991b1b' }}>
                          {f.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
