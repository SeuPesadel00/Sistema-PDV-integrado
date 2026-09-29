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
  const [showConfig, setShowConfig] = useState(false);
  const [apiUrl, setApiUrl] = useState(() => localStorage.getItem('pdv_apiUrl') || "http://localhost:3000");

  // MÓDULO DE SEGURANÇA E PERSISTÊNCIA DE SESSÃO
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('pdv_operatorName'));
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem('pdv_operatorName') || "");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");

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
    try {
      const res = await fetch(`${apiUrl}/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula, senha })
      });
      if (res.ok) {
        const data = await res.json();
        setOperatorName(data.nome);
        setIsAuthenticated(true);
        localStorage.setItem('pdv_operatorName', data.nome);
        localStorage.setItem('pdv_token', data.token);
      } else { setAlertMsg("Acesso Negado: Matrícula ou senha incorretos!"); }
    } catch (err) { setAlertMsg("Erro crítico: Servidor Banco de Dados Offline."); }
  };

  const handleCloseRegister = () => {
    localStorage.removeItem('pdv_operatorName');
    localStorage.removeItem('pdv_token');
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
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
  const totalRecebido = payments.reduce((sum, p) => sum + p.value, 0);
  const resta = Math.max(0, subtotal - totalRecebido);

  // Pre-fill payment value when screen opens or changes
  useEffect(() => {
    if (showRecebimento && !showPix && !showCard && !showPosAuth) {
      setPaymentValue(resta.toFixed(2).replace('.', ','));
    }
  }, [showRecebimento, resta, showPix, showCard, showPosAuth]);

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-main)', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        <div 
          onDoubleClick={() => setShowConfig(true)}
          style={{ position: 'absolute', top: 0, right: 0, width: '50px', height: '50px', cursor: 'default' }}
          title="Área Administrativa"
        />
        <form onSubmit={handleLogin} style={{ backgroundColor: 'var(--bg-panel)', padding: '3rem', borderRadius: '16px', border: '1px solid var(--bg-input)', textAlign: 'center', minWidth: '350px' }}>
          <h2 style={{ color: 'var(--accent)', marginBottom: '2rem' }}>🔒 ACESSO RESTRITO (PDV)</h2>
          <input type="text" placeholder="Matrícula (Ex: 12345)" maxLength={5} value={matricula} onChange={e => setMatricula(e.target.value)} style={{ width: '100%', padding: '1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-input)', color: 'white', border: 'none', borderRadius: '8px' }} />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '1rem', marginBottom: '2rem', backgroundColor: 'var(--bg-input)', color: 'white', border: 'none', borderRadius: '8px' }} />
          <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ENTRAR NO CAIXA</button>
        </form>

        {showConfig && (
          <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
            <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '8px', width: '400px', color: 'white' }}>
              <h2 style={{ marginBottom: '20px', color: 'var(--accent)' }}>Configuração do Servidor</h2>
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-secondary)' }}>URL da API (Matriz)</label>
                <input 
                  type="text" 
                  value={apiUrl}
                  onChange={e => setApiUrl(e.target.value)}
                  style={{ width: '100%', padding: '12px', borderRadius: '6px', border: '1px solid #374151', backgroundColor: '#111827', color: 'white' }}
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" onClick={() => setShowConfig(false)} style={{ padding: '10px 20px', borderRadius: '6px', backgroundColor: '#374151', color: 'white', border: 'none', cursor: 'pointer' }}>Cancelar</button>
                <button type="button" onClick={() => { localStorage.setItem('pdv_apiUrl', apiUrl); setShowConfig(false); }} style={{ padding: '10px 20px', borderRadius: '6px', backgroundColor: 'var(--accent)', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Salvar</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Sair do modal de Exit
      if (showExitModal && e.key === "Escape") { e.preventDefault(); setShowExitModal(false); return; }
      
      // Tela de fechamento
      if (showCloseRegister) {
        if (e.key === "F5") { e.preventDefault(); handleCloseRegister(); }
        if (e.key === "Escape") { e.preventDefault(); setShowCloseRegister(false); }
        return;
      }

      // Tela de recebimento
      if (showRecebimento) {
        if (!showPix && !showCard && !showPosAuth && !alertMsg && !printPrompt) {
          if (e.key === "F2") { e.preventDefault(); if (resta > 0) setShowCard(true); }
          if (e.key === "F4") { e.preventDefault(); if (resta > 0) addPayment('Dinheiro'); }
          if (e.key === "F6") { e.preventDefault(); if (resta > 0) setShowPosAuth(true); }
          if (e.key === "F8") { e.preventDefault(); if (resta > 0) setShowPix(true); }
          if (e.key === "F10") {
            e.preventDefault();
            if (resta <= 0) finalizarVenda();
            else setAlertMsg("O valor total da venda não foi atingido.");
          }
          if (e.key === "Escape") { e.preventDefault(); setShowRecebimento(false); }
        }
        return;
      }

      // Alertas e Print
      if (alertMsg && e.key === "Enter") { e.preventDefault(); setAlertMsg(""); return; }
      if (printPrompt && e.key === "Enter") { 
        e.preventDefault(); 
        setLastReceipt(printPrompt.receiptData); 
        setPrintPrompt(null);
        setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 1000); }, 100);
        return;
      }
      if (printPrompt && e.key === "Escape") {
        e.preventDefault();
        setLastReceipt(printPrompt.receiptData); setTimeout(() => setLastReceipt(null), 100); setPrintPrompt(null);
        return;
      }

      // Main Screen
      if (isAuthenticated && !alertMsg && !printPrompt) {
        if (e.key === "F3") { e.preventDefault(); if (cart.length > 0) setShowRecebimento(true); return; }
        if (e.key === "F4") { e.preventDefault(); setCart([]); return; }
        if (e.key === "F5") { e.preventDefault(); setShowCloseRegister(true); return; }
        if (e.key === "Escape") { e.preventDefault(); setShowExitModal(true); return; }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  });

  const handleBarcodeSubmit = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcode.trim();
      setBarcode("");
      if (!code) return;

      try {
        const token = localStorage.getItem('pdv_token');
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
    return v;
  };

  const addPayment = (method: string, authCode?: string) => {
    const v = parsePaymentValue();
    if (v <= 0) return;
    setPayments(prev => [...prev, { id: Math.random().toString(), method, value: v, authCode }]);
  };

  // handleRecebimentoKey removido (substituído pelo global keydown listener)

  const finalizarVenda = async () => {
    try {
      const token = localStorage.getItem('pdv_token');
      // Passa os metodos separados por virgula para o banco registrar
      const methodStr = payments.map(p => p.authCode ? `${p.method}(${p.authCode})` : p.method).join(', ');
      
      const resDb = await fetch(`${apiUrl}/vendas`, { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
        body: JSON.stringify({ itens: cart, total: subtotal, metodo_pagamento: methodStr }) 
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

  return (
    <div className="pos-container">
      {/* PAINEL ESQUERDO: CARRINHO */}
      <div className="pos-left">
        <header className="pos-header">
          <h1>TAILÂNDIA SMART-POS</h1>
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
                <div className="cart-item-qty">{item.quantity} x R$ {item.unitPrice.toFixed(2)}</div>
                <div className="cart-item-price">R$ {(item.quantity * item.unitPrice).toFixed(2)}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* PAINEL DIREITO: TOTAIS E CONTROLES */}
      <div className="pos-right">
        <div className="totals-panel">
          <div className="total-row"><span>Qtd. Itens:</span><span>{totalItems}</span></div>
          <div className="total-row"><span>Subtotal:</span><span>R$ {subtotal.toFixed(2)}</span></div>
          <div className="total-row grand-total"><span>TOTAL</span><span>R$ {subtotal.toFixed(2)}</span></div>
        </div>

        <div className="input-panel">
          <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>Código de Barras / EAN</label>
          <input ref={inputRef} type="text" className="barcode-input" placeholder="Bipar o produto..." value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={handleBarcodeSubmit} />

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>CPF/CNPJ do Cliente na Nota (Opcional)</label>
            <input type="text" className="barcode-input" style={{ fontSize: '1.2rem', padding: '0.75rem' }} placeholder="Apenas números..." value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
          </div>

          <div className="shortcuts-panel">
            <button className="shortcut-btn" onClick={() => setCart([])}>Cancelar Item <span>[ F4 ]</span></button>
            <button className="shortcut-btn" style={{ gridColumn: "span 2" }} onClick={() => cart.length > 0 && setShowRecebimento(true)}>Recebimento <span>[ F3 ]</span></button>
            <button className="shortcut-btn" style={{ gridColumn: "span 2" }} onClick={() => setShowCloseRegister(true)}>Fechar Caixa <span>[ F5 ]</span></button>
          </div>
        </div>
      </div>

      {/* TELA DE RECEBIMENTO (F3) */}
      {showRecebimento && (
        <div className="pix-modal-overlay" style={{ zIndex: 1000, backgroundColor: 'rgba(0,0,0,0.85)' }}>
          <div style={{ backgroundColor: '#2d324c', color: 'white', width: '700px', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ backgroundColor: '#1e223b', padding: '15px 20px', textAlign: 'center', fontWeight: 'bold', fontSize: '1.2rem', letterSpacing: '2px' }}>RECEBIMENTO</div>
            
            <div style={{ padding: '20px', display: 'flex', gap: '20px' }}>
              <div style={{ flex: 1 }}>
                <div style={{ backgroundColor: '#1e223b', padding: '15px', borderRadius: '6px', marginBottom: '15px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Total da Venda R$</span><span>{subtotal.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}><span>Total Recebido R$</span><span>{totalRecebido.toFixed(2)}</span></div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: resta > 0 ? '#e17055' : '#00b894', fontSize: '1.2rem' }}><span>Resta R$</span><span>{resta.toFixed(2)}</span></div>
                </div>

                <div style={{ marginBottom: '15px', border: '1px solid #4b5563', padding: '15px', borderRadius: '6px' }}>
                  <label style={{ display: 'block', marginBottom: '10px', color: '#b2bec3' }}>Pagamento</label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '15px' }}>
                    <span>Valor R$:</span>
                    <input ref={recebimentoInputRef} type="text" value={paymentValue} onChange={e => setPaymentValue(e.target.value)} style={{ flex: 1, padding: '8px', fontSize: '1.1rem', textAlign: 'right', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px' }} onClick={() => resta > 0 && setShowCard(true)}>TEF (F2)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px' }} onClick={() => resta > 0 && addPayment('Dinheiro')}>Dinheiro (F4)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px' }}>Voucher (F5)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px' }} onClick={() => resta > 0 && setShowPosAuth(true)}>POS (F6)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px', backgroundColor: '#e17055' }} onClick={() => resta > 0 && setShowPix(true)}>PIX (F8)</button>
                    <button className="shortcut-btn" style={{ fontSize: '0.8rem', padding: '10px' }}>Convênio (F7)</button>
                  </div>
                </div>
              </div>

              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ flex: 1, border: '1px solid #4b5563', borderRadius: '6px', padding: '10px', backgroundColor: '#1e223b', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.9rem' }}>
                    <thead>
                      <tr style={{ color: '#b2bec3', borderBottom: '1px solid #4b5563' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '8px' }}>Forma de Pagamento</th>
                        <th style={{ textAlign: 'right', paddingBottom: '8px' }}>Valor R$</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map(p => (
                        <tr key={p.id}>
                          <td style={{ paddingTop: '8px' }}>{p.method} {p.authCode ? `(${p.authCode})` : ''}</td>
                          <td style={{ textAlign: 'right', paddingTop: '8px' }}>{p.value.toFixed(2)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                  <button onClick={() => { if (resta <= 0) finalizarVenda(); else setAlertMsg("Finalize o pagamento restante!"); }} style={{ flex: 2, padding: '15px', backgroundColor: resta <= 0 ? '#00b894' : '#636e72', color: 'white', border: 'none', fontWeight: 'bold', cursor: resta <= 0 ? 'pointer' : 'not-allowed', borderRadius: '6px' }}>Confirma (F10)</button>
                  <button onClick={() => setShowRecebimento(false)} style={{ flex: 1, padding: '15px', backgroundColor: '#4b5563', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', borderRadius: '6px' }}>Cancela (Esc)</button>
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
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Código de Autorização (NSU/Aut):</label>
              <input autoFocus type="text" value={posAuthCode} onChange={e => setPosAuthCode(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '1.2rem', borderRadius: '4px', border: '1px solid #ccc', color: '#000' }} />
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
            <div className="pix-value">R$ {parsePaymentValue().toFixed(2)}</div>
            <div style={{ margin: '15px 0', padding: '10px', backgroundColor: 'white', borderRadius: '8px', display: 'inline-block' }}>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020101021226580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865405${parsePaymentValue().toFixed(2)}5802BR5913Tailandia%20Distribuidora6008BRASILIA62070503***6304`} alt="QR Code PIX" style={{ width: '150px', height: '150px' }} />
            </div>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowPix(false)}>Cancelar</button>
              <button className="btn-success" onClick={() => { addPayment('PIX'); setShowPix(false); }}>Simular Pagamento PIX</button>
            </div>
          </div>
        </div>
      )}
      
      {showCard && (
        <div className="pix-modal-overlay" style={{ zIndex: 1100 }}>
          <div className="pix-modal" style={{ width: '400px' }}>
            <h2 style={{ color: '#eab308' }}>TEF / MÁQUINA DE CARTÃO</h2>
            <div className="pix-value">R$ {parsePaymentValue().toFixed(2)}</div>
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Selecione a Modalidade:</label>
              <select value={cardType} onChange={e => setCardType(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="CARTAO_CREDITO">Crédito</option>
                <option value="CARTAO_DEBITO">Débito</option>
              </select>
            </div>
            <p style={{ color: "var(--text-secondary)", marginBottom: '20px' }}>Aguardando o cliente inserir o cartão e digitar a senha...</p>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowCard(false)}>Cancelar</button>
              <button className="btn-success" style={{ backgroundColor: '#eab308' }} onClick={() => { addPayment(cardType === 'CARTAO_CREDITO' ? 'TEF_Crédito' : 'TEF_Débito'); setShowCard(false); }}>Simular Aprovação TEF</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PRINT CUSTOMIZADO (Entrega do Documento) */}
      {printPrompt && (
        <div className="pix-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="pix-modal" style={{ textAlign: 'left', width: '450px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
              <h3 style={{ margin: 0, color: 'var(--text-primary)' }}>Entrega do Documento</h3>
              <button onClick={() => { setLastReceipt(printPrompt.receiptData); setTimeout(() => setLastReceipt(null), 100); setPrintPrompt(null); }} style={{ background: 'none', border: 'none', color: '#b2bec3', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '15px' }}>Como entregar o documento fiscal ao cliente?</p>
            
            <div style={{ border: '1px solid #4b5563', borderRadius: '6px', padding: '15px', marginBottom: '20px' }}>
              <label style={{ display: 'block', marginBottom: '10px', color: 'white', cursor: 'pointer' }}>
                <input type="radio" name="delivery" defaultChecked style={{ marginRight: '10px' }} /> Imprimir
              </label>
              <label style={{ display: 'block', color: 'white', cursor: 'pointer' }}>
                <input type="radio" name="delivery" disabled style={{ marginRight: '10px' }} /> Enviar por WhatsApp (Em breve)
              </label>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
              <button onClick={() => { setLastReceipt(printPrompt.receiptData); setTimeout(() => setLastReceipt(null), 100); setPrintPrompt(null); }} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#b2bec3', color: '#2d3436', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Cancelar</button>
              <button onClick={() => { 
                setLastReceipt(printPrompt.receiptData); 
                setPrintPrompt(null);
                setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 1000); }, 100);
              }} style={{ padding: '10px 20px', borderRadius: '4px', backgroundColor: '#e17055', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL ALERTA CUSTOMIZADO (Produto Não Encontrado) */}
      {alertMsg && (
        <div className="pix-modal-overlay" style={{ zIndex: 9999 }}>
          <div className="pix-modal" style={{ width: '400px', textAlign: 'center' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#1e223b', margin: '-30px -30px 20px -30px', padding: '10px 20px', borderRadius: '12px 12px 0 0' }}>
              <span style={{ fontWeight: 'bold', color: 'white' }}>Atenção</span>
              <button onClick={() => setAlertMsg("")} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer' }}>✖</button>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px', margin: '20px 0 30px 0' }}>
              <div style={{ fontSize: '3rem' }}>⚠️</div>
              <div style={{ fontSize: '1.2rem', color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>{alertMsg}</div>
            </div>
            <button onClick={() => setAlertMsg("")} style={{ padding: '10px 40px', borderRadius: '6px', backgroundColor: '#e17055', color: 'white', border: 'none', cursor: 'pointer', fontWeight: 'bold' }}>OK</button>
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
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ backgroundColor: 'var(--bg-panel)', padding: '30px', borderRadius: '12px', border: '1px solid var(--border-color)', width: '450px', textAlign: 'center', color: 'white' }}>
            <h2 style={{ marginBottom: '20px', color: 'var(--text-primary)' }}>Finalizar PDV</h2>
            <p style={{ marginBottom: '30px', fontSize: '1.2rem', color: 'var(--text-secondary)' }}>O que você deseja fazer?</p>
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'center' }}>
              <button onClick={() => window.close()} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: '#e17055', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Sair do PDV</button>
              <button onClick={() => { setShowExitModal(false); setShowCloseRegister(true); }} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: '#636e72', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Fechar o Caixa</button>
              <button onClick={() => setShowExitModal(false)} style={{ padding: '12px 20px', borderRadius: '6px', backgroundColor: '#b2bec3', color: '#2d3436', border: 'none', fontWeight: 'bold', cursor: 'pointer', flex: 1 }}>Cancelar</button>
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

      {/* IMPRESSÃO DO CUPOM TÉRMICO */}
      {lastReceipt && (
        <div className="print-receipt" style={{ display: 'none' }}>
           {/* Para o electron silent print, o print-receipt precisa estar visível apenas para a impressora via @media print */}
          <div style={{ textAlign: 'center', marginBottom: '10px', color: 'black', fontFamily: 'monospace' }}>
            <h3 style={{ margin: 0 }}>TAILÂNDIA DISTRIBUIDORA</h3>
            <p style={{ fontSize: '12px', margin: 0 }}>CNPJ: 00.000.000/0001-00</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Extrato No. 012345</p>
            <p style={{ fontSize: '12px', margin: 0 }}>CUPOM FISCAL ELETRÔNICO - SAT</p>
            <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Data: {lastReceipt.date}</p>
            {lastReceipt.cpfCnpj && <p style={{ fontSize: '12px', margin: 0, fontWeight: 'bold' }}>CPF/CNPJ Consumidor: {lastReceipt.cpfCnpj}</p>}
            {lastReceipt.chave_acesso && (
              <div style={{ marginTop: '5px' }}>
                <p style={{ fontSize: '10px', margin: 0, color: '#333' }}>CHAVE DE ACESSO</p>
                <p style={{ fontSize: '10px', margin: 0, wordWrap: 'break-word' }}>
                  {lastReceipt.chave_acesso.match(/.{1,4}/g)?.join(' ')}
                </p>
              </div>
            )}
          </div>
          <p style={{ fontSize: '12px', margin: 0, color: 'black' }}>--------------------------------</p>
          <div style={{ fontSize: '12px', color: 'black' }}>
            {lastReceipt.itens.map((item, idx) => (
              <div key={idx} style={{ marginBottom: '5px' }}>
                <div>{item.ean} - {item.name}</div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span>{item.quantity} un X {item.unitPrice.toFixed(2)}</span>
                  <span>R$ {(item.quantity * item.unitPrice).toFixed(2)}</span>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: '12px', margin: 0, color: 'black' }}>--------------------------------</p>
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', margin: '10px 0', color: 'black' }}>
            <span>TOTAL R$</span>
            <span>{lastReceipt.total.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: '12px', margin: 0, color: 'black' }}>--------------------------------</p>
          
          <div style={{ fontSize: '12px', color: 'black', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>PAGAMENTOS:</p>
            {lastReceipt.payments.map((p, idx) => (
               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span>{p.method} {p.authCode ? `(${p.authCode})` : ''}</span>
                 <span>R$ {p.value.toFixed(2)}</span>
               </div>
            ))}
          </div>

          <p style={{ fontSize: '12px', textAlign: 'center', marginTop: '10px', color: 'black' }}>Consulte o QR Code pelo aplicativo</p>
          <p style={{ fontSize: '10px', textAlign: 'center', marginTop: '5px', color: 'black' }}>Sistema PDV Integrado</p>
        </div>
      )}
    </div>
  );
}
