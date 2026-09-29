import React, { useState, useEffect, useRef } from "react";

interface CartItem { id: string; ean: string; name: string; quantity: number; unitPrice: number; }

export default function App() {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [barcode, setBarcode] = useState("");
  const [showPix, setShowPix] = useState(false);
  const [showCard, setShowCard] = useState(false);
  const [cardType, setCardType] = useState('CREDITO'); // CREDITO ou DEBITO
  const [showCloseRegister, setShowCloseRegister] = useState(false);
  const [cpfCnpj, setCpfCnpj] = useState("");
  const [lastReceipt, setLastReceipt] = useState<{itens: CartItem[], total: number, date: string, cpfCnpj: string, metodoPagamento: string} | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // MÓDULO DE SEGURANÇA E PERSISTÊNCIA DE SESSÃO
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!localStorage.getItem('pdv_operatorName'));
  const [operatorName, setOperatorName] = useState(() => localStorage.getItem('pdv_operatorName') || "");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch('http://localhost:3000/auth', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ matricula, senha })
      });
      if (res.ok) {
        const data = await res.json();
        setOperatorName(data.nome);
        setIsAuthenticated(true);
        localStorage.setItem('pdv_operatorName', data.nome);
        localStorage.setItem('pdv_token', data.token); // Persiste o JWT
      } else { alert("Acesso Negado: Matrícula ou senha incorretos!"); }
    } catch (err) { alert("Erro crítico: Servidor Banco de Dados Offline."); }
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
      alert("⚠️ Sua sessão expirou por inatividade (ou por atualização de segurança)!\n\nPor favor, faça login novamente no PDV para continuar vendendo.");
      handleCloseRegister();
      return true;
    }
    return false;
  };

  useEffect(() => {
    if (isAuthenticated && !showPix && !showCard && !showCloseRegister) {
      inputRef.current?.focus();
      const handleGlobalClick = () => inputRef.current?.focus();
      window.addEventListener("click", handleGlobalClick);
      return () => window.removeEventListener("click", handleGlobalClick);
    }
  }, [isAuthenticated, showPix, showCard, showCloseRegister]);

  if (!isAuthenticated) {
    return (
      <div style={{ display: 'flex', height: '100vh', width: '100vw', backgroundColor: 'var(--bg-main)', alignItems: 'center', justifyContent: 'center' }}>
        <form onSubmit={handleLogin} style={{ backgroundColor: 'var(--bg-panel)', padding: '3rem', borderRadius: '16px', border: '1px solid var(--bg-input)', textAlign: 'center', minWidth: '350px' }}>
          <h2 style={{ color: 'var(--accent)', marginBottom: '2rem' }}>🔒 ACESSO RESTRITO (PDV)</h2>
          <input type="text" placeholder="Matrícula (Ex: 12345)" maxLength={5} value={matricula} onChange={e => setMatricula(e.target.value)} style={{ width: '100%', padding: '1rem', marginBottom: '1rem', backgroundColor: 'var(--bg-input)', color: 'white', border: 'none', borderRadius: '8px' }} />
          <input type="password" placeholder="Senha" value={senha} onChange={e => setSenha(e.target.value)} style={{ width: '100%', padding: '1rem', marginBottom: '2rem', backgroundColor: 'var(--bg-input)', color: 'white', border: 'none', borderRadius: '8px' }} />
          <button type="submit" style={{ width: '100%', padding: '1rem', backgroundColor: 'var(--accent)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer' }}>ENTRAR NO CAIXA</button>
        </form>
      </div>
    );
  }

  const handleScan = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "F2") { e.preventDefault(); if (cart.length > 0) setShowPix(true); return; }
    if (e.key === "F6") { e.preventDefault(); if (cart.length > 0) setShowCard(true); return; }
    if (e.key === "F4") { e.preventDefault(); setCart([]); return; }
    if (e.key === "F5") { e.preventDefault(); setShowCloseRegister(true); return; }

    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcode.trim();
      setBarcode("");
      if (!code) return;

      try {
        const token = localStorage.getItem('pdv_token');
        const response = await fetch(`http://localhost:3000/produtos/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (checkTokenStatus(response.status)) return;
        
        let product = { name: `Produto Genérico (${code})`, price: 9.99 };
        if (response.ok) {
          const dbProduct = await response.json();
          product = { name: dbProduct.nome, price: Number(dbProduct.preco_venda) };
        }

        setCart((prev) => {
          const existingItem = prev.find(item => item.ean === code);
          if (existingItem) return prev.map(item => item.ean === code ? { ...item, quantity: item.quantity + 1 } : item);
          return [...prev, { id: Math.random().toString(36).substr(2, 9), ean: code, name: product.name, quantity: 1, unitPrice: product.price }];
        });
      } catch (err) { alert("Ops! O PDV perdeu conexão com o Banco de Dados Local."); }
    }
  };

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

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
          <input ref={inputRef} type="text" className="barcode-input" placeholder="Bipar o produto..." value={barcode} onChange={(e) => setBarcode(e.target.value)} onKeyDown={handleScan} />

          <div style={{ marginTop: '1rem' }}>
            <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>CPF/CNPJ do Cliente na Nota (Opcional)</label>
            <input type="text" className="barcode-input" style={{ fontSize: '1.2rem', padding: '0.75rem' }} placeholder="Apenas números..." value={cpfCnpj} onChange={(e) => setCpfCnpj(e.target.value)} />
          </div>

          <div className="shortcuts-panel">
            <button className="shortcut-btn" onClick={() => setCart([])}>Cancelar Item <span>[ F4 ]</span></button>
            <button className="shortcut-btn" onClick={() => cart.length > 0 && setShowPix(true)}>Pagamento Pix <span>[ F2 ]</span></button>
            <button className="shortcut-btn" onClick={() => cart.length > 0 && setShowCard(true)}>Pagamento Cartão <span>[ F6 ]</span></button>
            <button className="shortcut-btn">Pagamento Dinheiro <span>[ F3 ]</span></button>
            <button className="shortcut-btn" style={{ gridColumn: "span 2" }} onClick={() => setShowCloseRegister(true)}>Fechar Caixa <span>[ F5 ]</span></button>
          </div>
        </div>
      </div>

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
                    { label: 'Convenio', sis: '0,00' },
                    { label: 'Voucher', sis: '0,00' },
                    { label: 'Sangria', sis: '0,00' },
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

              <div style={{ marginBottom: '20px' }}>
                <span style={{ fontSize: '0.85rem', color: '#555' }}>Observacao</span>
                <textarea style={{ width: '100%', height: '50px', border: '1px solid #ccc', resize: 'none' }}></textarea>
              </div>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button onClick={handleCloseRegister} style={{ flex: 1, padding: '12px', backgroundColor: '#4b5563', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>F5 | Fechar Caixa</button>
                <button onClick={() => setShowCloseRegister(false)} style={{ flex: 1, padding: '12px', backgroundColor: '#4b5563', color: 'white', border: 'none', fontWeight: 'bold', cursor: 'pointer' }}>ESC | Sair</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL PIX (mantido) */}
      {showPix && (
        <div className="pix-modal-overlay">
          <div className="pix-modal">
            <h2>PAGAMENTO VIA PIX</h2>
            <div className="pix-value">R$ {subtotal.toFixed(2)}</div>
            <div style={{ margin: '15px 0', padding: '10px', backgroundColor: 'white', borderRadius: '8px', display: 'inline-block' }}>
               <img src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=00020101021226580014br.gov.bcb.pix0136123e4567-e12b-12d1-a456-4266554400005204000053039865405${subtotal.toFixed(2)}5802BR5913Tailandia%20Distribuidora6008BRASILIA62070503***6304`} alt="QR Code PIX" style={{ width: '150px', height: '150px' }} />
            </div>
            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowPix(false)}>Cancelar (Esc)</button>
              <button className="btn-success" onClick={async () => {
                try {
                  const token = localStorage.getItem('pdv_token');
                  const resDb = await fetch('http://localhost:3000/vendas', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ itens: cart, total: subtotal, metodo_pagamento: 'PIX' }) 
                  });
                  
                  if (checkTokenStatus(resDb.status)) return;
                  if (!resDb.ok) throw new Error("Falha no Banco");
                  
                  if (window.confirm("Venda PIX finalizada com sucesso!\nDeseja imprimir a via do cliente (Cupom)?")) {
                    setLastReceipt({ itens: cart, total: subtotal, date: new Date().toLocaleString('pt-BR'), cpfCnpj, metodoPagamento: 'PIX' });
                    setTimeout(() => window.print(), 100);
                  }
                  
                  setCart([]); setCpfCnpj(""); setShowPix(false);
                } catch(e) { alert("Erro ao registrar venda!"); }
              }}>Simular Pagamento</button>
            </div>
          </div>
        </div>
      )}
      {/* MODAL CARTAO (TEF) */}
      {showCard && (
        <div className="pix-modal-overlay">
          <div className="pix-modal" style={{ width: '400px' }}>
            <h2 style={{ color: '#eab308' }}>TEF / MÁQUINA DE CARTÃO</h2>
            <div className="pix-value">R$ {subtotal.toFixed(2)}</div>
            
            <div style={{ margin: '20px 0', textAlign: 'left' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold' }}>Selecione a Modalidade:</label>
              <select value={cardType} onChange={e => setCardType(e.target.value)} style={{ width: '100%', padding: '10px', fontSize: '1.1rem', borderRadius: '4px', border: '1px solid #ccc' }}>
                <option value="CARTAO_CREDITO">Crédito</option>
                <option value="CARTAO_DEBITO">Débito</option>
              </select>
            </div>

            <p style={{ color: "var(--text-secondary)", marginBottom: '20px' }}>Aguardando o cliente inserir o cartão e digitar a senha...</p>

            <div className="pix-actions">
              <button className="btn-cancel" onClick={() => setShowCard(false)}>Cancelar (Esc)</button>
              <button className="btn-success" style={{ backgroundColor: '#eab308' }} onClick={async () => {
                try {
                  const token = localStorage.getItem('pdv_token');
                  const resDb = await fetch('http://localhost:3000/vendas', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, 
                    body: JSON.stringify({ itens: cart, total: subtotal, metodo_pagamento: cardType }) 
                  });
                  
                  if (checkTokenStatus(resDb.status)) return;
                  if (!resDb.ok) throw new Error("Falha no Banco");
                  
                  if (window.confirm(`CARTÃO APROVADO! Venda via ${cardType === 'CARTAO_CREDITO' ? 'Crédito' : 'Débito'}\nDeseja imprimir a via do cliente (Cupom)?`)) {
                    setLastReceipt({ itens: cart, total: subtotal, date: new Date().toLocaleString('pt-BR'), cpfCnpj, metodoPagamento: cardType });
                    setTimeout(() => window.print(), 100);
                  }
                  
                  setCart([]); setCpfCnpj(""); setShowCard(false);
                } catch(e) { alert("Erro ao registrar venda!"); }
              }}>Simular Aprovação</button>
            </div>
          </div>
        </div>
      )}

      {/* IMPRESSÃO DO CUPOM TÉRMICO */}
      {lastReceipt && (
        <div className="print-receipt">
          <div style={{ textAlign: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0 }}>TAILÂNDIA DISTRIBUIDORA</h3>
            <p style={{ fontSize: '12px', margin: 0 }}>CNPJ: 00.000.000/0001-00</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Extrato No. 012345</p>
            <p style={{ fontSize: '12px', margin: 0, fontWeight: 'bold' }}>CUPOM FISCAL ELETRÔNICO - SAT</p>
            <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
            <p style={{ fontSize: '12px', margin: 0 }}>Data: {lastReceipt.date}</p>
            {lastReceipt.cpfCnpj && <p style={{ fontSize: '12px', margin: 0, fontWeight: 'bold' }}>CPF/CNPJ Consumidor: {lastReceipt.cpfCnpj}</p>}
          </div>
          <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
          <div style={{ fontSize: '12px' }}>
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
          <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
          <div style={{ fontSize: '16px', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', margin: '10px 0' }}>
            <span>TOTAL R$</span>
            <span>{lastReceipt.total.toFixed(2)}</span>
          </div>
          <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
          <p style={{ fontSize: '12px', textAlign: 'center', marginTop: '10px' }}>Consulte o QR Code pelo aplicativo</p>
          <p style={{ fontSize: '10px', textAlign: 'center', marginTop: '5px' }}>Sistema PDV Integrado</p>

          {/* VIA DO CLIENTE (CARTÃO TEF) */}
          {(lastReceipt.metodoPagamento === 'CARTAO_CREDITO' || lastReceipt.metodoPagamento === 'CARTAO_DEBITO') && (
            <div style={{ marginTop: '25px', borderTop: '1px dashed black', paddingTop: '20px', textAlign: 'center' }}>
              <h3 style={{ margin: 0 }}>COMPROVANTE TEF</h3>
              <p style={{ fontSize: '12px', margin: 0 }}>TAILÂNDIA DISTRIBUIDORA</p>
              <p style={{ fontSize: '12px', margin: 0 }}>REDE - {lastReceipt.metodoPagamento === 'CARTAO_CREDITO' ? 'CRÉDITO' : 'DÉBITO'}</p>
              <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px' }}>
                 <span>VALOR:</span>
                 <span>R$ {lastReceipt.total.toFixed(2)}</span>
              </div>
              <p style={{ fontSize: '12px', margin: 0 }}>--------------------------------</p>
              <p style={{ fontSize: '12px', margin: '10px 0' }}>Via do Cliente</p>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
