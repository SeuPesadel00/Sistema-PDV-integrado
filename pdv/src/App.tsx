import React, { useState, useEffect, useRef } from "react";

interface CartItem { id: string; ean: string; name: string; quantity: number; unitPrice: number; }
interface Payment { id: string; method: string; value: number; authCode?: string; }

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  
  // Custom Modals
  const [alertMsg, setAlertMsg] = useState("");
  const [printPrompt, setPrintPrompt] = useState<{ receiptData: any } | null>(null);
  const [showExitModal, setShowExitModal] = useState(false);
  const [showCloseRegister, setShowCloseRegister] = useState(false);
  
  // Recebimento
  const [showRecebimento, setShowRecebimento] = useState(false);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [paymentValue, setPaymentValue] = useState("");
  const [showPosAuth, setShowPosAuth] = useState(false);
  const [posAuthCode, setPosAuthCode] = useState("");
  
  // Legacy states for PIX/TEF forms inside Recebimento
  const [showPix, setShowPix] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardType, setCardType] = useState('CARTAO_CREDITO');
  
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [isEmitting, setIsEmitting] = useState(false);
  const [lastReceipt, setLastReceipt] = useState<{itens: CartItem[], total: number, date: string, cpfCnpj: string, payments: Payment[], chave_acesso?: string} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recebimentoInputRef = useRef<HTMLInputElement>(null);

  // CONFIGURAÇÃO DE REDE (MULTI-LOJAS)
  const apiUrl = "https://api-tailandia.onrender.com";

  // MÓDULO DE SEGURANÇA E PERSISTÊNCIA DE SESSÃO
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!sessionStorage.getItem('pdv_operatorName'));
  const [operatorName, setOperatorName] = useState(() => sessionStorage.getItem('pdv_operatorName') || "");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Tema
  const [theme, setTheme] = useState(() => localStorage.getItem('pdv_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('pdv_theme', newTheme);
  };

  const executePrint = () => {
    // @ts-ignore
    if (window.require) {
      // @ts-ignore
      const { ipcRenderer } = window.require('electron');
      ipcRenderer.send('print-silent');
    } else {
      window.print();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const res = await fetch(`${apiUrl}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula, senha })
      });
      setIsLoggingIn(false);
      if (res.ok) {
        const data = await res.json();
        setOperatorName(data.nome);
        setIsAuthenticated(true);
        sessionStorage.setItem('pdv_operatorName', data.nome);
        sessionStorage.setItem('pdv_token', data.token);
      } else { setAlertMsg("Acesso Negado: Matrícula ou senha incorretos!"); }
    } catch (err) { 
      setIsLoggingIn(false);
      setAlertMsg("Erro crítico: Servidor Banco de Dados Offline."); 
    }
  };

  const handleCloseRegister = () => {
    sessionStorage.removeItem('pdv_operatorName');
    sessionStorage.removeItem('pdv_token');
    setIsAuthenticated(false);
    setOperatorName("");
    setShowCloseRegister(false);
  };
  
  const checkTokenStatus = (resStatus: number) => {
    if (resStatus === 401 || resStatus === 403) {
      setAlertMsg("Sua sessão expirou por inatividade!");
      handleCloseRegister();
      return true;
    }
    return false;
  };

  // Focus management
  useEffect(() => {
    if (isAuthenticated && !showRecebimento && !showExitModal && !showCloseRegister && !alertMsg && !printPrompt) {
      inputRef.current?.focus();
    } else if (showRecebimento && !showPix && !showCard && !showPosAuth && !alertMsg && !printPrompt) {
      recebimentoInputRef.current?.focus();
    }
  }, [isAuthenticated, showRecebimento, showPix, showCard, showPosAuth, showCloseRegister, showExitModal, alertMsg, printPrompt]);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = Math.round(cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0) * 100) / 100;
  const totalRecebido = Math.round(payments.reduce((sum, p) => sum + p.value, 0) * 100) / 100;
  const resta = Math.max(0, Math.round((subtotal - totalRecebido) * 100) / 100);
  const troco = Math.max(0, Math.round((totalRecebido - subtotal) * 100) / 100);

  // Pre-fill payment value when screen opens or changes
  useEffect(() => {
    if (showRecebimento && !showPix && !showCard && !showPosAuth) {
      setPaymentValue(resta.toFixed(2).replace('.', ','));
    }
  }, [showRecebimento, resta, showPix, showCard, showPosAuth]);



  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 1. Alertas
      if (alertMsg) {
        if (e.key === "Enter" || e.key === "Escape") {
          e.preventDefault();
          setAlertMsg("");
        }
        return;
      }

      // 2. Confirmação de Impressão (Print Prompt)
      if (printPrompt) {
        if (e.key === "Enter") { 
          e.preventDefault(); 
          setLastReceipt(printPrompt.receiptData); 
          setPrintPrompt(null);
          setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 1000); }, 100);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setLastReceipt(printPrompt.receiptData);
          setTimeout(() => setLastReceipt(null), 100);
          setPrintPrompt(null);
          return;
        }
        return;
      }

      // 3. Modal POS Auth
      if (showPosAuth) {
        if (e.key === "Enter") {
          e.preventDefault();
          if (posAuthCode.trim() !== "") {
            addPayment('POS', posAuthCode);
            setShowPosAuth(false);
            setPosAuthCode("");
          } else {
            setAlertMsg("O código de autorização é obrigatório para POS.");
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowPosAuth(false);
          setPosAuthCode("");
          return;
        }
        return;
      }

      // 4. Modal PIX
      if (showPix) {
        if (e.key === "Enter") {
          e.preventDefault();
          addPayment('PIX');
          setShowPix(false);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowPix(false);
          return;
        }
        return;
      }

      // 5. Modal Cartão / TEF
      if (showCard) {
        if (e.key === "Enter") {
          e.preventDefault();
          addPayment(cardType === 'CARTAO_CREDITO' ? 'TEF_Crédito' : 'TEF_Débito');
          setShowCard(false);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowCard(false);
          return;
        }
        return;
      }

      // 6. Modal de Fechamento de Caixa
      if (showCloseRegister) {
        if (e.key === "Enter" || e.key === "F5") {
          e.preventDefault();
          handleCloseRegister();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowCloseRegister(false);
          return;
        }
        return;
      }

      // 7. Modal de Saída do PDV
      if (showExitModal) {
        if (e.key === "Enter") {
          e.preventDefault();
          window.close();
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowExitModal(false);
          return;
        }
        return;
      }

      // 8. Tela de Recebimento
      if (showRecebimento) {
        if (e.key === "F2") { e.preventDefault(); if (resta > 0) setShowCard(true); return; }
        if (e.key === "F4") { e.preventDefault(); if (resta > 0) addPayment('Dinheiro'); return; }
        if (e.key === "F6") { e.preventDefault(); if (resta > 0) setShowPosAuth(true); return; }
        if (e.key === "F8") { e.preventDefault(); if (resta > 0) setShowPix(true); return; }
        if (e.key === "F10" || e.key === "Enter") {
          e.preventDefault();
          if (resta <= 0) {
            finalizarVenda();
          } else {
            addPayment('Dinheiro');
          }
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setShowRecebimento(false);
          return;
        }
        return;
      }

      // 9. Tela Principal (Balcão do Caixa)
      if (isAuthenticated) {
        if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) setShowRecebimento(true); return; }
        if (e.key === "F4") { e.preventDefault(); cancelarVenda(); return; }
        if (e.key === "F5") { e.preventDefault(); setShowCloseRegister(true); return; }
        if (e.key === "Escape") { e.preventDefault(); setShowExitModal(true); return; }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAuthenticated, showExitModal, showCloseRegister, showRecebimento, 
    showPix, showCard, showPosAuth, alertMsg, printPrompt, cart, resta,
    posAuthCode, cardType, paymentValue
  ]);

  const handleBarcodeSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcode.trim();
      setBarcode("");
      if (!code) return;

      try {
        const token = sessionStorage.getItem('pdv_token');
        const response = await fetch(`${apiUrl}/produtos/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (checkTokenStatus(response.status)) return;
        
        if (response.ok) {
          const dbProduct = await response.json();
          
          const existingItem = cart.find(item => item.ean === code);
          const currentQty = existingItem ? existingItem.quantity : 0;
          
          if (currentQty + 1 > dbProduct.estoque_atual) {
            setAlertMsg("Produto sem estoque disponível!");
            return;
          }

          const product = { name: dbProduct.nome, price: Number(dbProduct.preco_venda) };
          setCart((prev) => {
            if (existingItem) return prev.map(item => item.ean === code ? { ...item, quantity: item.quantity + 1 } : item);
            return [...prev, { id: Math.random().toString(36).substr(2, 9), ean: code, name: product.name, quantity: 1, unitPrice: product.price }];
          });
        } else {
          setAlertMsg("Produto não encontrado!");
        }
      } catch (err) { setAlertMsg("Ops! O PDV perdeu conexão com o Banco de Dados Local."); }
    }
  };

  const parsePaymentValue = () => {
    let cleanStr = paymentValue.toString().replace(/\./g, '').replace(',', '.');
    let v = parseFloat(cleanStr);
    if (isNaN(v) || v <= 0) v = resta;
    return Math.round(v * 100) / 100;
  };

  const cancelarVenda = () => {
    setCart([]);
    setPayments([]);
    setCpfCnpj("");
    setShowRecebimento(false);
  };

  const addPayment = (method: string, authCode?: string) => {
    const v = parsePaymentValue();
    if (v <= 0) return;
    setPayments(prev => [...prev, { id: Math.random().toString(), method, value: v, authCode }]);
  };

  // handleRecebimentoKey removido (substituído pelo global keydown listener)

  const finalizarVenda = async () => {
    try {
      const token = sessionStorage.getItem('pdv_token');
      // Passa os metodos separados por virgula para o banco registrar
      let methodStr = payments.map(p => p.authCode ? `${p.method}(${p.authCode})` : p.method).join(', ');
      if (methodStr.length > 20) methodStr = "MÚLTIPLOS";
      
      const resDb = await fetch(`${apiUrl}/vendas`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ itens: cart, total: subtotal, metodo_pagamento: methodStr, cpfCnpj }) 
      });
      
      if (checkTokenStatus(resDb.status)) return;
      if (!resDb.ok) throw new Error("Falha no Banco");
      const dataVenda = await resDb.json();
      
      setIsEmitting(true);
      const resFiscal = await fetch(`${apiUrl}/fiscal/emitir-nfce`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ venda_id: dataVenda.id_venda }) 
      });
      const dataFiscal = await resFiscal.json();
      setIsEmitting(false);
      
      const receiptData = { itens: cart, total: subtotal, date: new Date().toLocaleString('pt-BR'), cpfCnpj, payments, chave_acesso: dataFiscal.chave_acesso };
      
      // Cleanup screen
      setCart([]); setPayments([]); setCpfCnpj(""); setShowRecebimento(false);
      
      // Show Print Prompt Custom Modal
      setPrintPrompt({ receiptData });
    } catch(e) { 
      setIsEmitting(false); 
      setAlertMsg("Erro ao registrar venda!"); 
    }
  };

  if (!isAuthenticated) {
    const onEnterLogin = (e: React.KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleLogin(e as any);
      }
    };

    return (
      <div className="login-bg">
        <div className="floating-toggle">
          <button className="theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? '🌙 Modo Escuro' : '☀️ Modo Claro'}
            <div className={`toggle-track ${theme === 'dark' ? 'on' : ''}`}>
              <div className="toggle-thumb" />
            </div>
          </button>
        </div>
        <form onSubmit={handleLogin} className="login-card">
          <h2>🔒 ACESSO RESTRITO (PDV)</h2>
          <input
            type="text"
            placeholder="Matrícula (Ex: 12345)"
            maxLength={5}
            value={matricula}
            onChange={e => setMatricula(e.target.value)}
            onKeyDown={onEnterLogin}
          />
          <div style={{ position: 'relative', width: '100%', marginBottom: '12px' }}>
            <input
              type={mostrarSenha ? "text" : "password"}
              placeholder="Senha"
              value={senha}
              onChange={e => setSenha(e.target.value)}
              onKeyDown={onEnterLogin}
              style={{ width: '100%', paddingRight: '44px', marginBottom: 0 }}
            />
            <button
              type="button"
              className="eye-toggle-btn"
              onClick={() => setMostrarSenha(v => !v)}
              title={mostrarSenha ? "Ocultar senha" : "Ver senha"}
            >
              {mostrarSenha ? (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                  <line x1="1" y1="1" x2="23" y2="23"></line>
                </svg>
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                  <circle cx="12" cy="12" r="3"></circle>
                </svg>
              )}
            </button>
          </div>
          <button type="submit" disabled={isLoggingIn}>
            {isLoggingIn ? "ACORDANDO SERVIDOR (PODE LEVAR 50s)..." : "ENTRAR NO CAIXA"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="pos-container">
      {/* PAINEL ESQUERDO: CARRINHO */}
      <div className="pos-left">
        <header className="pos-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <h1>TAILÂNDIA SMART-POS</h1>
            <div className="theme-toggle" onClick={toggleTheme} style={{ width: 'auto', padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px' }}>
              {theme === 'dark' ? '🌙' : '☀️'}
            </div>
          </div>
          <div className="cashier-info">
            <span className="status-badge">● ONLINE (Sefaz DF)</span>
            <span>Caixa: 01</span>
            <span>Operador: {operatorName}</span>
          </div>
        </header>

        <div className="cart-list">
          {cart.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-secondary)", marginTop: "2rem" }}>Aguardando leitura de produtos...</div>
          ) : (
            cart.map((item, index) => (
              <div key={item.id} className="cart-item">
                <div style={{ width: "30px", color: "var(--text-secondary)" }}>{(index + 1).toString().padStart(2, '0')}</div>
                <div className="cart-item-desc">{item.name}</div>
                <div className="cart-item-qty">{item.quantity} x R$ {item.unitPrice.toFixed(2).replace('.', ',')}</div>
                <div className="cart-item-price">R$ {(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: TOTAIS E CONTROLES */}
      <div className="pos-right">
        <div className="totals-panel">
          <div className="total-row"><span>Qtd. Itens:</span><span>{totalItems}</span></div>
          <div className="total-row"><span>Subtotal:</span><span>R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
          <div className="total-row grand-total"><span>TOTAL</span><span>R$ {subtotal.toFixed(2).replace('.', ',')}</span></div>
        </div>

        <div className="input-panel">
          <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>Código de Barras / EAN</label>
          <input ref={inputRef} type="text" className="barcode-input" placeholder="Bipar o produto..." value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={handleBarcodeSubmit} />

          <div className="shortcuts-panel" style={{ marginTop: '2rem' }}>
            <button className="shortcut-btn" onClick={cancelarVenda}>Cancelar Venda <span>[ F4 ]</span></button>
            <button className="shortcut-btn" style={{ gridColumn: "span 2" }} onClick={() => cart.length > 0 && setShowRecebimento(true)}>Recebimento <span>[ F3 ]</span></button>
            <button className="shortcut-btn" style={{ gridColumn: "span 2" }} onClick={() => setShowCloseRegister(true)}>Fechar Caixa <span>[ F5 ]</span></button>
          </div>
        </div>
      </div>

      {/* TELA DE RECEBIMENTO (F3) */}
      {showRecebimento && (
        <div className="pix-modal-overlay" style={{ zIndex: 1000 }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text)', width: '700px', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)' }}>
            <div style={{ backgroundColor: 'var(--bg-surface-2)', padding: '15px 20px', textAlign: 'center', fontWeight: '800', fontSize: '1.2rem', letterSpacing: '2px', borderBottom: '1px solid var(--border)' }}>RECEBIMENTO</div>
            
            <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ backgroundColor: 'var(--bg-surface-2)', padding: '15px', borderRadius: '12px', marginBottom: '15px', border: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--text-soft)' }}><span>Total da Venda R$</span><span>{subtotal.toFixed(2).replace('.', ',')}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px', color: 'var(--text-soft)' }}><span>Total Recebido R$</span><span>{totalRecebido.toFixed(2).replace('.', ',')}</span></div>
                  {troco > 0 ? (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--accent)', fontSize: '1.2rem' }}><span>Troco R$</span><span>{troco.toFixed(2).replace('.', ',')}</span></div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: resta > 0 ? 'var(--danger)' : 'var(--accent)', fontSize: '1.2rem' }}><span>Resta R$</span><span>{resta.toFixed(2).replace('.', ',')}</span></div>
                  )}
                </div>

                <div style={{ marginBottom: '15px', border: '1px solid var(--border)', padding: '15px', borderRadius: '12px' }}>
                  <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-muted)" }}>CPF/CNPJ na Nota (Opcional)</label>
                  <input
                    type="text"
                    placeholder="Apenas números..."
                    value={cpfCnpj}
                    onChange={(e) => setCpfCnpj(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        recebimentoInputRef.current?.focus();
                      }
                    }}
                    style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '8px', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', marginBottom: '15px', outline: 'none' }}
                  />
                  
                  <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text-muted)' }}>Valor do Pagamento</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span style={{ color: 'var(--text-soft)' }}>Valor R$:</span>
                    <input
                      ref={recebimentoInputRef}
                      type="text"
                      value={paymentValue}
                      onChange={e => setPaymentValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          if (resta <= 0) {
                            finalizarVenda();
                          } else {
                            addPayment('Dinheiro');
                          }
                        }
                      }}
                      style={{ flex: 1, padding: '10px', fontSize: '1.1rem', textAlign: 'right', borderRadius: '8px', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }}
                    />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => resta > 0 && setShowCard(true)}>TEF (F2)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => resta > 0 && addPayment('Dinheiro')}>Dinheiro (F4)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }}>Voucher (F5)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => resta > 0 && setShowPosAuth(true)}>POS (F6)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px', border: '1px solid var(--accent)', color: 'var(--accent)' }} onClick={() => resta > 0 && setShowPix(true)}>PIX (F8)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }}>Convênio (F7)</button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, border: '1px solid var(--border)', borderRadius: '12px', padding: '10px', backgroundColor: 'var(--bg-surface-2)', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ color: 'var(--text-muted)', borderBottom: '1px solid var(--border-strong)' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '8px' }}>Forma de Pagamento</th>
                        <th style={{ textAlign: 'right', paddingBottom: '8px' }}>Valor R$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id}>
                          <td style={{ paddingTop: '8px', color: 'var(--text)' }}>{p.method} {p.authCode ? `(${p.authCode})` : ''}</td>
                          <td style={{ textAlign: 'right', paddingTop: '8px', color: 'var(--text)' }}>{p.value.toFixed(2).replace('.', ',')}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => { if (resta <= 0) finalizarVenda(); else setAlertMsg("Finalize o pagamento restante!"); }} style={{ flex: 2, padding: '15px', backgroundColor: resta <= 0 ? 'var(--accent)' : 'var(--bg-surface-2)', color: resta <= 0 ? 'white' : 'var(--text-muted)', border: resta <= 0 ? 'none' : '1px solid var(--border)', fontWeight: 'bold', cursor: resta <= 0 ? 'pointer' : 'not-allowed', borderRadius: '10px', transition: 'all 0.2s' }}>Confirma (F10)</button>
                  <button onClick={() => setShowRecebimento(false)} style={{ flex: 1, padding: '15px', backgroundColor: 'var(--bg-surface-2)', color: 'var(--text-soft)', border: '1px solid var(--border)', fontWeight: 'bold', cursor: 'pointer', borderRadius: '10px', transition: 'all 0.2s' }}>Cancela (Esc)</button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL POS AUTH */}
      {showPosAuth && (
         <div className="pix-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="pix-modal">
            <h2>POS (Máquina Externa)</h2>
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: 'var(--text-soft)' }}>Código de Autorização (NSU/Aut):</label>
              <input
                autoFocus
                type="text"
                value={posAuthCode}
                onChange={e => setPosAuthCode(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    if (posAuthCode.trim() !== '') {
                      addPayment('POS', posAuthCode);
                      setShowPosAuth(false);
                      setPosAuthCode('');
                    } else {
                      setAlertMsg('O código de autorização é obrigatório para POS.');
                    }
                  }
                }}
                style={{ width: '100%', padding: '10px', fontSize: '1.2rem', borderRadius: '8px', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => { setShowPosAuth(false); setPosAuthCode(""); }}>Cancelar</button>
              <button className="btn-success" onClick={() => {
                if(posAuthCode.trim() !== "") {
                  addPayment('POS', posAuthCode);
                  setShowPosAuth(false);
                  setPosAuthCode("");
                } else {
                  setAlertMsg("O código de autorização é obrigatório para POS.");
                }
              }}>Confirmar</button>
            </div>
          </div>
         </div>
      )}

      {/* MODAL PIX E CARTÃO REAPROVEITADOS DENTRO DO RECEBIMENTO */}
      {showPix && (
        <div className="pix-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="pix-modal">
            <h2>PAGAMENTO VIA PIX</h2>
            <div className="pix-value">R$ {parsePaymentValue().toFixed(2).replace('.', ',')}</div>
            <div style={{ margin: '15px 0', padding: '10px', backgroundColor: 'white', borderRadius: '8px', display: 'inline-block' }}>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020101021226580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865405${parsePaymentValue().toFixed(2)}5802BR5913Tailandia%20Distribuidora6008BRASILIA62070503***6304`} alt="QR Code PIX" style={{ width: '150px', height: '150px' }} />
            </div>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowPix(false)}>Cancelar</button>
              <button className="btn-success" onClick={() => { addPayment('PIX'); setShowPix(false); }}>Confirmar PIX</button>
            </div>
          </div>
        </div>
      )}
      
      {showCard && (
        <div className="pix-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="pix-modal" style={{ width: '400px' }}>
            <h2 style={{ color: 'var(--warning)' }}>TEF / MÁQUINA DE CARTÃO</h2>
            <div className="pix-value">R$ {parsePaymentValue().toFixed(2).replace('.', ',')}</div>
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', color: 'var(--text-soft)' }}>Selecione a Modalidade:</label>
              <select value={cardType} onChange={e => setCardType(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '8px', border: '1px solid var(--border-strong)', backgroundColor: 'var(--bg-input)', color: 'var(--text)', outline: 'none' }}>
                <option value="CARTAO_CREDITO">Crédito</option>
                <option value="CARTAO_DEBITO">Débito</option>
              </select>
            </div>
            <p style={{ color: "var(--text-muted)", marginBottom: '20px' }}>Aguardando o cliente inserir o cartão e digitar a senha...</p>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowCard(false)}>Cancelar</button>
              <button className="btn-success" style={{ backgroundColor: 'var(--warning)', boxShadow: '0 4px 14px var(--warning-soft)' }} onClick={() => { addPayment(cardType === 'CARTAO_CREDITO' ? 'TEF_Crédito' : 'TEF_Débito'); setShowCard(false); }}>Simular Aprovação TEF</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRINT CUSTOMIZADO (Entrega do Documento) */}
      {printPrompt && (
        <div className="pix-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="pix-modal" style={{ textAlign: 'left', width: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--text)', fontSize: '1.2rem' }}>Entrega do Documento</h3>
              <button onClick={() => { setLastReceipt(printPrompt.receiptData); setTimeout(() => setLastReceipt(null), 100); setPrintPrompt(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            </div>
            <p style={{ color: 'var(--text-muted)', marginBottom: '15px' }}>Como entregar o documento fiscal ao cliente?</p>
            
            <div style={{ border: '1px solid var(--border)', borderRadius: '12px', padding: '15px', marginBottom: '20px', backgroundColor: 'var(--bg-surface-2)' }}>
              <label style={{ display: 'block', marginBottom: '10px', color: 'var(--text)', cursor: 'pointer' }}>
                <input type="radio" name="delivery" defaultChecked style={{ marginRight: '10px' }} /> Imprimir
              </label>
              <label style={{ display: 'block', color: 'var(--text-soft)', cursor: 'not-allowed', opacity: 0.5 }}>
                <input type="radio" name="delivery" disabled style={{ marginRight: '10px' }} /> Enviar por WhatsApp (Em breve)
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setLastReceipt(printPrompt.receiptData); setTimeout(() => setLastReceipt(null), 100); setPrintPrompt(null); }} className="btn-cancel">Cancelar</button>
              <button onClick={() => { 
                setLastReceipt(printPrompt.receiptData); 
                setPrintPrompt(null);
                setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 1000); }, 100);
              }} className="btn-success">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTA CUSTOMIZADO (Produto Não Encontrado) */}
      {alertMsg && (
        <div className="pix-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="pix-modal" style={{ width: '400px', textAlign: 'center', padding: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--danger-soft)', padding: '15px 20px', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontWeight: 'bold', color: 'var(--danger)' }}>Atenção</span>
              <button onClick={() => setAlertMsg("")} style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}>✖</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', padding: '30px 20px' }}>
              <div style={{ fontSize: '3rem' }}>⚠️</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text)', flex: 1, textAlign: 'left' }}>{alertMsg}</div>
            </div>
            <div style={{ padding: '0 20px 20px 20px' }}>
              <button onClick={() => setAlertMsg("")} className="btn-success" style={{ width: '100%', backgroundColor: 'var(--danger)', boxShadow: '0 4px 14px var(--danger-soft)' }}>OK</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE FECHAMENTO DE CAIXA (ESTILO SISTEMA LEGADO) */}
      {showCloseRegister && (
        <div className="pix-modal-overlay" style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.8)' }}>
          <div style={{ backgroundColor: '#2d324c', color: 'white', width: '600px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)' }}>
            <div style={{ backgroundColor: '#1e223b', padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontWeight: 'bold' }}>
              <span>Fechamento de Caixa</span>
              <button onClick={() => setShowCloseRegister(false)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            </div>
            
            <div style={{ backgroundColor: '#f0f0f0', color: '#333', padding: '20px' }}>
              <h3 style={{ textAlign: 'center', color: '#1e223b', marginBottom: '20px' }}>CAIXA ABERTO Nº 040724092026-023654</h3>
              <table style={{ width: '100%', marginBottom: '20px', borderSpacing: '0 8px' }}>
                <thead>
                  <tr style={{ color: '#1e223b', fontSize: '0.9rem' }}>
                    <th style={{ textAlign: 'left', width: '40%' }}>Forma</th>
                    <th style={{ textAlign: 'right', width: '30%' }}>Sistema (R$)</th>
                    <th style={{ textAlign: 'center', width: '30%' }}>Conferido (R$)</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Dinheiro', sis: '0,00' },
                    { label: 'TEF (Cartao)', sis: '0,00' },
                    { label: 'POS', sis: '0,00' },
                    { label: 'PIX', sis: '0,00' },
                  ].map((f, i) => (
                    <tr key={i}>
                      <td style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{f.label}</td>
                      <td style={{ textAlign: 'right', paddingRight: '20px', color: '#555' }}>{f.sis}</td>
                      <td>
                        <div style={{ display: 'flex' }}>
                          <input type="text" defaultValue="0,00" style={{ width: '100%', padding: '6px', border: '1px solid #ccc', textAlign: 'right' }} />
                          <button style={{ backgroundColor: '#1e223b', border: 'none', padding: '0 5px' }}>🖩</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleCloseRegister} style={{ flex: 1, padding: '12px', backgroundColor: '#4b5563', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>F5 | Fechar Caixa</button>
                <button onClick={() => setShowCloseRegister(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#4b5563', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>ESC | Sair</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE SAÍDA / ESC */}
      {showExitModal && (
        <div className="pix-modal-overlay" style={{ zIndex: 1000 }}>
          <div className="pix-modal" style={{ width: '450px' }}>
            <h2 style={{ marginBottom: '10px', color: 'var(--text)' }}>Finalizar PDV</h2>
            <p style={{ marginBottom: '30px', fontSize: '1.1rem', color: 'var(--text-muted)' }}>O que você deseja fazer?</p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => window.close()} className="btn-success" style={{ backgroundColor: 'var(--danger)', boxShadow: '0 4px 14px var(--danger-soft)' }}>Sair do PDV</button>
              <button onClick={() => { setShowExitModal(false); setShowCloseRegister(true); }} className="btn-success" style={{ backgroundColor: 'var(--warning)', boxShadow: '0 4px 14px var(--warning-soft)' }}>Fechar o Caixa</button>
              <button onClick={() => setShowExitModal(false)} className="btn-cancel">Cancelar</button>
            </div>
          </div>
        </div>
      )}

      {/* OVERLAY DE PROCESSAMENTO FISCAL */}
      {isEmitting && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
          <div style={{ border: '4px solid #f3f3f3', borderTop: '4px solid var(--accent)', borderRadius: '50%', width: '50px', height: '50px', animation: 'spin 1s linear infinite', marginBottom: '20px' }} />
          <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
          <h2 style={{ color: 'var(--accent)', marginBottom: '10px' }}>Transmitindo NFC-e...</h2>
          <p style={{ color: 'var(--text-secondary)' }}>Aguardando autorização da SEFAZ</p>
        </div>
      )}

      {/* IMPRESSÃO DO CUPOM TÉRMICO (ESTILO ASSAÍ) */}
      {lastReceipt && (
        <div className="print-receipt">
          <div style={{ textAlign: 'center', marginBottom: '5px' }}>
            <h3 style={{ margin: 0, fontSize: '14px' }}>TAILANDIA DISTRIBUIDORA S/A</h3>
            <p style={{ margin: 0 }}>QS 9 - Rua 100 Lote 04, S/N</p>
            <p style={{ margin: 0 }}>Areal Aguas Claras - Brasilia - DF</p>
            <p style={{ margin: 0 }}>CNPJ: 00.000.000/0001-00</p>
            <p style={{ margin: 0 }}>Telefone: (61) 9999-9999</p>
            <p style={{ margin: 0, marginTop: '5px' }}>Data: {lastReceipt.date.split(' ')[0]} - {lastReceipt.date.split(' ')[1]}</p>
            <p style={{ margin: 0, fontWeight: 'bold' }}>LOJA: 0101 &nbsp; PDV: 001 &nbsp; SEQ: {Math.floor(Math.random() * 900000) + 100000}</p>
          </div>
          
          <div style={{ textAlign: 'center', margin: '10px 0', borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>DOCUMENTO AUXILIAR</p>
            <p style={{ margin: 0 }}>DA NOTA FISCAL DE CONSUMIDOR ELETRONICA</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed black', paddingBottom: '2px', marginBottom: '5px' }}>
            <span>ITEM | COD | DESC | QTDE | UN | VL. UNIT | VL. TOTAL R$</span>
          </div>
          
          <div>
            {lastReceipt.itens.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '5px' }}>
                <div>{(idx+1).toString().padStart(3, '0')} {item.ean} {item.name.substring(0, 20)}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '25px' }}>
                  <span>{item.quantity.toFixed(3).replace('.', ',')} un x {item.unitPrice.toFixed(2).replace('.', ',')}</span>
                  <span>{(item.quantity * item.unitPrice).toFixed(2).replace('.', ',')}</span>
                </div>
              </div>
            ))}
          </div>

          <div style={{ borderTop: '1px dashed black', paddingTop: '5px', marginTop: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>QTD. TOTAL DE ITENS</span>
              <span>{lastReceipt.itens.reduce((sum, item) => sum + item.quantity, 0)}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>VALOR TOTAL R$</span>
              <span>{lastReceipt.total.toFixed(2).replace('.', ',')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '5px' }}>
              <span>VALOR A PAGAR R$</span>
              <span>{lastReceipt.total.toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>FORMA DE PAGAMENTO</span>
              <span>VALOR PAGO R$</span>
            </div>
            {lastReceipt.payments.map((p, idx) => (
               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span>{p.method} {p.authCode ? `(${p.authCode})` : ''}</span>
                 <span>{p.value.toFixed(2).replace('.', ',')}</span>
               </div>
            ))}
            
            {(() => {
              const totalRecebidoFormat = lastReceipt.payments.reduce((sum, p) => sum + p.value, 0);
              const trocoFormat = Math.max(0, totalRecebidoFormat - lastReceipt.total);
              return (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', marginTop: '5px' }}>
                  <span>TROCO R$</span>
                  <span>{trocoFormat.toFixed(2).replace('.', ',')}</span>
                </div>
              );
            })()}
          </div>

          <div style={{ borderTop: '1px dashed black', borderBottom: '1px dashed black', margin: '10px 0', padding: '10px 0', textAlign: 'center' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Consulte pela Chave de Acesso em:</p>
            <p style={{ margin: 0, fontSize: '10px' }}>http://dec.fazenda.df.gov.br/AConsulta</p>
            {lastReceipt.chave_acesso ? (
              <p style={{ margin: '5px 0 0 0', fontSize: '10px', wordWrap: 'break-word', letterSpacing: '1px' }}>
                {lastReceipt.chave_acesso.match(/.{1,4}/g)?.join(' ')}
              </p>
            ) : (
              <p style={{ margin: '5px 0 0 0', fontSize: '10px', wordWrap: 'break-word', letterSpacing: '1px' }}>
                5326 0906 0572 2303 4157 6500 8000 2762 7210 8218 9735
              </p>
            )}
            
            <div style={{ display: 'flex', marginTop: '10px', alignItems: 'center', gap: '10px' }}>
              {/* QR Code Fake para manter o design igual a foto */}
              <img src="https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=NFCe_TAILANDIA" alt="QR Code NFC-e" style={{ width: '80px', height: '80px' }} />
              <div style={{ fontSize: '9px', textAlign: 'left' }}>
                <p style={{ fontWeight: 'bold' }}>{lastReceipt.cpfCnpj ? `CONSUMIDOR: ${lastReceipt.cpfCnpj}` : 'CONSUMIDOR NAO IDENTIFICADO'}</p>
                <p>NFC-e n. 276272 Serie 9</p>
                <p>Emissao: {lastReceipt.date}</p>
                <p>Protocolo de Autorizacao: 353240</p>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '10px', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Procon-DF: 151 - End: SCS Q.08 Ed. Venancio 2000 B.B-60</p>
            <p style={{ margin: 0 }}>Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ {(lastReceipt.total * 0.18).toFixed(2).replace('.', ',')} Federal e Estadual</p>
            <p style={{ margin: 0 }}>Fonte: IBPT</p>
          </div>
          
          <p style={{ textAlign: 'center', fontWeight: 'bold', margin: 0 }}>
            Lj: 0101 Cx: 001 Operador: {operatorName || 'PADRAO'}
          </p>
        </div>
      )}
    </div>
  );
}
