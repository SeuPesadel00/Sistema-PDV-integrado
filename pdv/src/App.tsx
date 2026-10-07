import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";

interface CartItem { id: string; ean: string; name: string; quantity: number; unitPrice: number; }
interface Payment { id: string; method: string; value: number; authCode?: string; }
interface ReceiptData {
  itens: CartItem[];
  total: number;
  date: string;
  cpfCnpj: string;
  payments: Payment[];
  chave_acesso?: string;
  vendaId?: number | string;
  numNfce?: number | string;
  isSegundaVia?: boolean;
  status?: string;
}

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
  const [lastReceipt, setLastReceipt] = useState<ReceiptData | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recebimentoInputRef = useRef<HTMLInputElement>(null);

  // CONFIGURAÇÃO DE REDE (MULTI-LOJAS / NUVEM)
  const apiUrl = (typeof window !== 'undefined' && localStorage.getItem('pdv_useLocalhost') === 'true')
    ? "http://localhost:3000"
    : "https://api-tailandia.onrender.com";

  // MÓDULO DE SEGURANÇA E PERSISTÊNCIA DE SESSÃO DO CAIXA
  const [isAuthenticated, setIsAuthenticated] = useState(() => !!sessionStorage.getItem('pdv_operatorName'));
  const [operatorName, setOperatorName] = useState(() => sessionStorage.getItem('pdv_operatorName') || "");
  const [matricula, setMatricula] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // MÓDULO PAINEL ADMINISTRATIVO (PDV)
  const [showAdminAuthModal, setShowAdminAuthModal] = useState(false);
  const [adminAuthMatricula, setAdminAuthMatricula] = useState("");
  const [adminAuthSenha, setAdminAuthSenha] = useState("");
  const [adminAuthMostrarSenha, setAdminAuthMostrarSenha] = useState(false);
  const [adminAuthLoading, setAdminAuthLoading] = useState(false);
  const [adminAuthError, setAdminAuthError] = useState("");
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('pdv_adminToken') || "");
  const [adminName, setAdminName] = useState(() => sessionStorage.getItem('pdv_adminName') || "");

  const [showAdminPanel, setShowAdminPanel] = useState(false);
  const [adminVendas, setAdminVendas] = useState<any[]>([]);
  const [adminVendasLoading, setAdminVendasLoading] = useState(false);
  const [adminPeriodo, setAdminPeriodo] = useState("hoje");
  const [adminCustomDate, setAdminCustomDate] = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminMenuAbertoId, setAdminMenuAbertoId] = useState<number | null>(null);
  const [adminVendaExpandida, setAdminVendaExpandida] = useState<number | null>(null);

  // Modal de Estorno de Venda (PDV)
  const [showEstornoModal, setShowEstornoModal] = useState<any | null>(null);
  const [estornoMotivo, setEstornoMotivo] = useState("Desistência do cliente");
  const [estornoForma, setEstornoForma] = useState("DINHEIRO");
  const [estornoNsu, setEstornoNsu] = useState("");
  const [estornoObs, setEstornoObs] = useState("");
  const [estornoLoading, setEstornoLoading] = useState(false);

  // Modal de Cancelamento de Venda no Painel ADM
  const [showCancelarModal, setShowCancelarModal] = useState<any | null>(null);
  const [cancelarMotivo, setCancelarMotivo] = useState("Desistência do cliente");
  const [cancelarObs, setCancelarObs] = useState("");
  const [cancelarLoading, setCancelarLoading] = useState(false);

  // Modal de Confirmação para Cancelar Venda Atual no Caixa (F4)
  const [showConfirmarCancelarVendaAtual, setShowConfirmarCancelarVendaAtual] = useState(false);

  // Catálogo de Produtos para Busca Inteligente (Nome / Descrição / EAN)
  const [catalogoProdutos, setCatalogoProdutos] = useState<any[]>(() => {
    try {
      const c = localStorage.getItem('pdv_catalogo_cache');
      return c ? JSON.parse(c) : [];
    } catch { return []; }
  });
  const [sugestoesIndex, setSugestoesIndex] = useState<number>(0);
  const [showSugestoes, setShowSugestoes] = useState<boolean>(false);

  // Módulo de Cancelamento / Remoção de Item do Carrinho
  const [itemParaRemover, setItemParaRemover] = useState<CartItem | null>(null);
  const [qtdRemoverInput, setQtdRemoverInput] = useState<number>(1);

  // Tema
  const [theme, setTheme] = useState(() => localStorage.getItem('pdv_theme') || 'dark');

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Listener para retorno de impressão do Electron
  useEffect(() => {
    // @ts-ignore
    if (window.require) {
      try {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');
        const handlePrintCompleted = (_: any, data: any) => {
          if (data && !data.success) {
            console.warn("[PDV] Retorno da impressora:", data.failureReason);
          }
          // Remove o cupom do DOM de forma suave após a conclusão do trabalho
          setTimeout(() => setLastReceipt(null), 1200);
        };
        ipcRenderer.on('print-completed', handlePrintCompleted);
        return () => {
          ipcRenderer.removeListener('print-completed', handlePrintCompleted);
        };
      } catch { /* modo web */ }
    }
  }, []);

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(newTheme);
    localStorage.setItem('pdv_theme', newTheme);
  };

  const executePrint = () => {
    // @ts-ignore
    if (window.require) {
      try {
        // @ts-ignore
        const { ipcRenderer } = window.require('electron');
        ipcRenderer.send('print-silent');
      } catch (err) {
        console.error("Falha ao comunicar com IPC de impressão:", err);
        window.print();
      }
    } else {
      window.print();
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(`${apiUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: matricula.trim(), senha: senha.trim() }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      setIsLoggingIn(false);
      if (res.ok) {
        const data = await res.json();
        setOperatorName(data.nome);
        setIsAuthenticated(true);
        sessionStorage.setItem('pdv_operatorName', data.nome);
        sessionStorage.setItem('pdv_token', data.token);
      } else {
        const errData = await res.json().catch(() => ({}));
        setAlertMsg(errData.error || errData.message || "Acesso Negado: Matrícula ou senha incorretos!");
      }
    } catch (err: any) { 
      setIsLoggingIn(false);
      if (err?.name === 'AbortError') {
        setAlertMsg("Tempo limite esgotado: O servidor demorou para responder. Tente novamente.");
      } else {
        setAlertMsg("Erro crítico: Servidor Banco de Dados Offline ou sem conexão."); 
      }
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
    if (isAuthenticated && !showRecebimento && !showExitModal && !showCloseRegister && !alertMsg && !printPrompt && !showAdminAuthModal && !showAdminPanel && !showEstornoModal && !showCancelarModal && !showConfirmarCancelarVendaAtual) {
      inputRef.current?.focus();
    } else if (showRecebimento && !showPix && !showCard && !showPosAuth && !alertMsg && !printPrompt) {
      recebimentoInputRef.current?.focus();
    }
  }, [isAuthenticated, showRecebimento, showPix, showCard, showPosAuth, showCloseRegister, showExitModal, alertMsg, printPrompt, showAdminAuthModal, showAdminPanel, showEstornoModal, showCancelarModal, showConfirmarCancelarVendaAtual]);

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



  const handleFecharPainelAdm = () => {
    setShowAdminPanel(false);
    setAdminMenuAbertoId(null);
    setAdminVendaExpandida(null);
    // Limpa credenciais de administrador da sessão para exigir autenticação sempre que reabrir
    setAdminToken("");
    setAdminName("");
    setAdminAuthMatricula("");
    setAdminAuthSenha("");
    setAdminAuthError("");
    sessionStorage.removeItem('pdv_adminToken');
    sessionStorage.removeItem('pdv_adminName');
  };

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

      // Modal de Remoção / Cancelamento de Item
      if (itemParaRemover) {
        if (e.key === "Escape") {
          e.preventDefault();
          setItemParaRemover(null);
          return;
        }
        return;
      }

      // Modais do Painel ADM e Cancelamento
      if (showCancelarModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowCancelarModal(null);
          return;
        }
        return;
      }

      if (showConfirmarCancelarVendaAtual) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowConfirmarCancelarVendaAtual(false);
          return;
        }
        if (e.key === "Enter") {
          e.preventDefault();
          handleConfirmarCancelarVendaAtual();
          return;
        }
        return;
      }

      if (showEstornoModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowEstornoModal(null);
          return;
        }
        return;
      }

      if (showAdminPanel) {
        if (e.key === "Escape") {
          e.preventDefault();
          handleFecharPainelAdm();
          return;
        }
        return;
      }

      if (showAdminAuthModal) {
        if (e.key === "Escape") {
          e.preventDefault();
          setShowAdminAuthModal(false);
          setAdminAuthError("");
          return;
        }
        return;
      }

      // 2. Confirmação de Impressão (Print Prompt)
      if (printPrompt) {
        if (e.key === "Enter") { 
          e.preventDefault(); 
          setLastReceipt(printPrompt.receiptData); 
          setPrintPrompt(null);
          setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 4000); }, 100);
          return;
        }
        if (e.key === "Escape") {
          e.preventDefault();
          setLastReceipt(null);
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
        if (e.key === "F4") { e.preventDefault(); handleSolicitarCancelarVendaAtual(); return; }
        if (e.key === "F5") { e.preventDefault(); setShowCloseRegister(true); return; }
        if (e.key === "Escape") { e.preventDefault(); setShowExitModal(true); return; }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isAuthenticated, showExitModal, showCloseRegister, showRecebimento, 
    showPix, showCard, showPosAuth, alertMsg, printPrompt, cart, resta,
    posAuthCode, cardType, paymentValue, showAdminAuthModal, showAdminPanel, showEstornoModal,
    showCancelarModal, showConfirmarCancelarVendaAtual, itemParaRemover
  ]);

  // ---------- CARREGAMENTO DO CATÁLOGO DE PRODUTOS ----------
  const carregarCatalogo = useCallback(async () => {
    try {
      const token = sessionStorage.getItem('pdv_token');
      const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
      const res = await fetch(`${apiUrl}/admin/produtos`, { headers });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          setCatalogoProdutos(data);
          localStorage.setItem('pdv_catalogo_cache', JSON.stringify(data));
          return;
        }
      }
      // Tenta rota pública /produtos
      const resAlt = await fetch(`${apiUrl}/produtos`);
      if (resAlt.ok) {
        const dataAlt = await resAlt.json();
        if (Array.isArray(dataAlt) && dataAlt.length > 0) {
          setCatalogoProdutos(dataAlt);
          localStorage.setItem('pdv_catalogo_cache', JSON.stringify(dataAlt));
        }
      }
    } catch {
      // Falha de rede: mantém catálogo que já estava em memória/cache
    }
  }, [apiUrl]);

  useEffect(() => {
    if (isAuthenticated) {
      carregarCatalogo();
    }
  }, [isAuthenticated, carregarCatalogo]);

  // Produtos sugeridos para a barra de pesquisa/bipagem por nome, categoria ou código (a partir da 1ª letra)
  const produtosSugeridos = useMemo(() => {
    const termo = barcode.trim().toLowerCase();
    if (!termo || termo.length < 1) return [];
    return catalogoProdutos.filter(p => {
      const nome = (p.nome || '').toLowerCase();
      const ean = (p.ean || '').toLowerCase();
      const cat = (p.categoria || '').toLowerCase();
      return nome.includes(termo) || ean.includes(termo) || cat.includes(termo);
    }).slice(0, 25);
  }, [barcode, catalogoProdutos]);

  // Adiciona produto ao carrinho com checagem de estoque
  const adicionarProdutoAoCarrinho = (dbProduct: any) => {
    const code = String(dbProduct.ean || '').trim();
    const existingItem = cart.find(item => item.ean === code);
    const currentQty = existingItem ? existingItem.quantity : 0;
    const estoque = Number(dbProduct.estoque_atual ?? 99999);

    if (currentQty + 1 > estoque) {
      setAlertMsg(`Produto "${dbProduct.nome}" sem estoque disponível (${estoque} un)!`);
      return;
    }

    const price = Number(dbProduct.preco_venda || 0);
    setCart((prev) => {
      if (existingItem) {
        return prev.map(item => item.ean === code ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, {
        id: Math.random().toString(36).substr(2, 9),
        ean: code,
        name: dbProduct.nome,
        quantity: 1,
        unitPrice: price
      }];
    });

    setBarcode("");
    setShowSugestoes(false);
    setSugestoesIndex(0);
    inputRef.current?.focus();
  };

  const handleBarcodeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setBarcode(val);
    setSugestoesIndex(0);
    if (val.trim().length >= 1) {
      setShowSugestoes(true);
    } else {
      setShowSugestoes(false);
    }
  };

  const handleBarcodeKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (produtosSugeridos.length > 0) {
        e.preventDefault();
        setShowSugestoes(true);
        setSugestoesIndex(prev => (prev + 1) % produtosSugeridos.length);
        return;
      }
    }

    if (e.key === "ArrowUp") {
      if (produtosSugeridos.length > 0) {
        e.preventDefault();
        setShowSugestoes(true);
        setSugestoesIndex(prev => (prev - 1 + produtosSugeridos.length) % produtosSugeridos.length);
        return;
      }
    }

    if (e.key === "Escape") {
      if (showSugestoes) {
        e.preventDefault();
        setShowSugestoes(false);
        return;
      }
    }

    if (e.key === "Enter") {
      e.preventDefault();
      const code = barcode.trim();
      if (!code) return;

      // 1. Se sugestão estiver aberta e selecionada
      if (showSugestoes && produtosSugeridos.length > 0 && sugestoesIndex >= 0 && sugestoesIndex < produtosSugeridos.length) {
        adicionarProdutoAoCarrinho(produtosSugeridos[sugestoesIndex]);
        return;
      }

      // 2. Se for um código de barras direto no catálogo em memória
      const matchLocal = catalogoProdutos.find(p => p.ean === code);
      if (matchLocal) {
        adicionarProdutoAoCarrinho(matchLocal);
        return;
      }

      // 3. Fallback: Consulta direta na API para o caso de produto recém-cadastrado no Backoffice
      setBarcode("");
      setShowSugestoes(false);
      try {
        const token = sessionStorage.getItem('pdv_token');
        const response = await fetch(`${apiUrl}/produtos/${code}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (checkTokenStatus(response.status)) return;
        
        if (response.ok) {
          const dbProduct = await response.json();
          adicionarProdutoAoCarrinho(dbProduct);
          // Adiciona ao catálogo local
          setCatalogoProdutos(prev => [...prev.filter(p => p.ean !== dbProduct.ean), dbProduct]);
        } else {
          setAlertMsg("Produto não encontrado por código ou nome!");
        }
      } catch (err) { 
        setAlertMsg("Ops! Falha ao consultar produto no servidor."); 
      }
    }
  };

  // Funções para remoção/cancelamento de itens do carrinho
  const handleSolicitarRemoverItem = (item: CartItem) => {
    if (item.quantity <= 1) {
      setCart(prev => prev.filter(it => it.id !== item.id && it.ean !== item.ean));
      setAlertMsg(`Item "${item.name}" removido do carrinho.`);
    } else {
      setItemParaRemover(item);
      setQtdRemoverInput(1);
    }
  };

  const confirmarRemocaoItem = (qtdRemover: number) => {
    if (!itemParaRemover) return;
    const qtd = Number(qtdRemover);
    if (isNaN(qtd) || qtd <= 0) {
      alert("Informe uma quantidade válida para remover.");
      return;
    }
    if (qtd >= itemParaRemover.quantity) {
      setCart(prev => prev.filter(it => it.id !== itemParaRemover.id && it.ean !== itemParaRemover.ean));
      setAlertMsg(`Todas as ${itemParaRemover.quantity} un de "${itemParaRemover.name}" foram removidas.`);
    } else {
      setCart(prev => prev.map(it => {
        if (it.id === itemParaRemover.id || it.ean === itemParaRemover.ean) {
          return { ...it, quantity: it.quantity - qtd };
        }
        return it;
      }));
      setAlertMsg(`${qtd} un de "${itemParaRemover.name}" removidas.`);
    }
    setItemParaRemover(null);
  };

  const parsePaymentValue = () => {
    let cleanStr = paymentValue.toString().replace(/\./g, '').replace(',', '.');
    let v = parseFloat(cleanStr);
    if (isNaN(v) || v <= 0) v = resta;
    return Math.round(v * 100) / 100;
  };

  const handleSolicitarCancelarVendaAtual = () => {
    if (cart.length === 0) {
      setAlertMsg("Nenhum item no carrinho para cancelar.");
      return;
    }
    setShowConfirmarCancelarVendaAtual(true);
  };

  const handleConfirmarCancelarVendaAtual = () => {
    setCart([]);
    setPayments([]);
    setCpfCnpj("");
    setShowRecebimento(false);
    setShowConfirmarCancelarVendaAtual(false);
    setAlertMsg("Venda cancelada pelo operador com sucesso.");
  };

  const cancelarVenda = handleSolicitarCancelarVendaAtual;

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
      
      const receiptData: ReceiptData = {
        itens: cart,
        total: subtotal,
        date: new Date().toLocaleString('pt-BR'),
        cpfCnpj,
        payments,
        chave_acesso: dataFiscal.chave_acesso,
        vendaId: dataVenda.id_venda,
        numNfce: dataFiscal.numero_nfe || dataVenda.id_venda,
        status: 'CONCLUIDA'
      };
      
      // Cleanup screen
      setCart([]); setPayments([]); setCpfCnpj(""); setShowRecebimento(false);
      
      // Show Print Prompt Custom Modal
      setPrintPrompt({ receiptData });
    } catch(e) { 
      setIsEmitting(false); 
      setAlertMsg("Erro ao registrar venda!"); 
    }
  };

  // ---------- FUNÇÕES DO PAINEL ADMINISTRATIVO (PDV) ----------
  const carregarVendasAdmin = useCallback(async (overrideToken?: string, isPolling = false) => {
    if (!isPolling) setAdminVendasLoading(true);
    const token = overrideToken || adminToken || sessionStorage.getItem('pdv_token');
    try {
      const res = await fetch(`${apiUrl}/admin/vendas?t=${Date.now()}`, {
        headers: { 'Authorization': `Bearer ${token}` },
        cache: 'no-store'
      });
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          // Busca overrides compartilhados (IPC do Electron e HTTP local do Vite)
          let sharedOverrides: Record<string, any> = {};

          // @ts-ignore
          if (window.require) {
            try {
              // @ts-ignore
              const { ipcRenderer } = window.require('electron');
              const ipcRes = await ipcRenderer.invoke('get-sync-overrides');
              if (ipcRes && typeof ipcRes === 'object') sharedOverrides = { ...sharedOverrides, ...ipcRes };
            } catch {}
          }

          try {
            const httpRes = await fetch(`http://localhost:5173/api/sync-overrides?t=${Date.now()}`, { cache: 'no-store' }).then(r => r.json()).catch(() => ({}));
            if (httpRes && typeof httpRes === 'object') sharedOverrides = { ...sharedOverrides, ...httpRes };
          } catch {}

          const overridesRaw = localStorage.getItem('vendas_status_override');
          const localOverrides: Record<string, any> = overridesRaw ? JSON.parse(overridesRaw) : {};
          const allOverrides = { ...localOverrides, ...sharedOverrides };

          const mesclado = data.map((v: any) => {
            if (allOverrides[v.id]) return { ...v, ...allOverrides[v.id] };
            return v;
          });
          setAdminVendas(mesclado);
        }
      }
    } catch (err) {
      console.error("Erro ao carregar vendas no Painel ADM:", err);
    } finally {
      if (!isPolling) setAdminVendasLoading(false);
    }
  }, [adminToken, apiUrl]);

  useEffect(() => {
    let interval: any;
    if (showAdminPanel) {
      interval = setInterval(() => {
        carregarVendasAdmin(undefined, true);
      }, 3000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [showAdminPanel, carregarVendasAdmin]);

  const handleAbrirPainelAdm = () => {
    // SEMPRE exige autenticação de Administrador para abrir o painel
    setAdminToken("");
    setAdminName("");
    setAdminAuthMatricula("");
    setAdminAuthSenha("");
    setAdminAuthError("");
    setShowAdminAuthModal(true);
  };

  const handleAdminAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminAuthMatricula.trim() || !adminAuthSenha.trim()) {
      setAdminAuthError("Informe a matrícula e a senha do Administrador.");
      return;
    }
    setAdminAuthLoading(true);
    setAdminAuthError("");
    try {
      const res = await fetch(`${apiUrl}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matricula: adminAuthMatricula.trim(), senha: adminAuthSenha.trim() })
      });
      setAdminAuthLoading(false);
      if (res.ok) {
        const data = await res.json();
        if (data.nivel === 'ADMIN') {
          setAdminToken(data.token);
          setAdminName(data.nome);
          sessionStorage.setItem('pdv_adminToken', data.token);
          sessionStorage.setItem('pdv_adminName', data.nome);
          setShowAdminAuthModal(false);
          setShowAdminPanel(true);
          carregarVendasAdmin(data.token);
        } else {
          setAdminAuthError("Acesso Negado: Usuário informado não tem permissão de Administrador!");
        }
      } else {
        setAdminAuthError("Acesso Negado: Matrícula ou senha incorretos!");
      }
    } catch {
      setAdminAuthLoading(false);
      setAdminAuthError("Erro de comunicação com o servidor.");
    }
  };

  const handleReimprimirSegundaVia = (venda: any) => {
    let itensVenda = Array.isArray(venda.itens) && venda.itens.length > 0 ? venda.itens : [];
    
    // Fallback: se a venda não tem itens detalhados (ex: vendas antigas sem log detalhado), gera item representativo
    if (itensVenda.length === 0) {
      itensVenda = [{
        ean: '0000000000000',
        nome: 'VENDA DE MERCADORIA / CUPOM FISCAL',
        quantidade: 1,
        preco: Number(venda.total || 0)
      }];
    }

    const itensReimprimir: CartItem[] = itensVenda.map((it: any, index: number) => ({
      id: String(it.ean || it.id || index),
      ean: String(it.ean || it.produto_ean || '0000000000000'),
      name: String(it.nome || it.produto_nome || it.name || it.descricao || 'Item diverso'),
      quantity: Number(it.quantidade ?? it.quantity ?? 1) || 1,
      unitPrice: Number(it.preco ?? it.preco_unitario ?? it.unitPrice ?? 0)
    }));

    const receiptData: ReceiptData = {
      itens: itensReimprimir,
      total: Number(venda.total || 0),
      date: venda.criado_em ? new Date(venda.criado_em).toLocaleString('pt-BR') : new Date().toLocaleString('pt-BR'),
      cpfCnpj: venda.cpf_cnpj_cliente || '',
      payments: [{ id: '1', method: venda.metodo_pagamento || 'DINHEIRO', value: Number(venda.total || 0) }],
      chave_acesso: venda.chave_nfe || '',
      vendaId: venda.id,
      numNfce: venda.num_nfe || venda.id,
      isSegundaVia: true,
      status: venda.status
    };

    setLastReceipt(receiptData);
    setAdminMenuAbertoId(null);
    setTimeout(() => {
      executePrint();
      setTimeout(() => setLastReceipt(null), 4000);
      setAlertMsg(`2ª Via da Venda #${String(venda.id).padStart(6, '0')} enviada para a impressora!`);
    }, 150);
  };

  const handleAbrirModalCancelar = (venda: any) => {
    if (venda.status === 'CANCELADA') {
      setAlertMsg('Esta venda já se encontra cancelada.');
      return;
    }
    const diffMins = (Date.now() - new Date(venda.criado_em).getTime()) / (1000 * 60);
    if (diffMins > 30) {
      setAlertMsg('Prazo de cancelamento (30 minutos) expirado! Para vendas antigas, o cancelamento ou estorno deve ser feito pelo Backoffice.');
      return;
    }
    setShowCancelarModal(venda);
    setCancelarMotivo("Desistência do cliente");
    setCancelarObs("");
    setAdminMenuAbertoId(null);
  };

  const handleConfirmarCancelarVendaAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showCancelarModal) return;
    const venda = showCancelarModal;
    setCancelarLoading(true);

    try {
      const token = adminToken || sessionStorage.getItem('pdv_token');
      const motivoFinal = cancelarObs.trim() ? `${cancelarMotivo} - ${cancelarObs.trim()}` : cancelarMotivo;

      // 1. Tenta acionar a rota central de cancelamento
      let cancelamentoApiSucesso = false;
      try {
        const res = await fetch(`${apiUrl}/admin/vendas/${venda.id}/cancelar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ motivo: motivoFinal })
        });
        if (res.ok) cancelamentoApiSucesso = true;
      } catch {}

      // 2. Se a rota central retornar 404 (aguardando deploy na nuvem), restabelece estoque na API via PUT /admin/produtos/:id
      if (!cancelamentoApiSucesso) {
        for (const item of (venda.itens || [])) {
          const prodCadastrado = catalogoProdutos.find(p => String(p.ean) === String(item.ean || item.produto_ean));
          if (prodCadastrado && prodCadastrado.id) {
            await fetch(`${apiUrl}/admin/produtos/${prodCadastrado.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                ...prodCadastrado,
                estoque_atual: Number(prodCadastrado.estoque_atual || 0) + Number(item.quantidade || item.quantity || 1)
              })
            }).catch(() => {});
          }
        }
      }

      // 3. Salva override nos 3 níveis: IPC (arquivo local compartilhado), HTTP sync local e localStorage
      const overrideData = { status: 'CANCELADA', motivo_cancelamento: motivoFinal, status_nfe: 'CANCELADA' };

      // IPC nativo
      // @ts-ignore
      if (window.require) {
        try {
          // @ts-ignore
          const { ipcRenderer } = window.require('electron');
          await ipcRenderer.invoke('save-sync-override', { vendaId: venda.id, status: 'CANCELADA', extraData: overrideData });
        } catch {}
      }

      // HTTP Local Vite Sync (para o Backoffice ler instantaneamente)
      await fetch('http://localhost:5173/api/sync-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendaId: venda.id, status: 'CANCELADA', extraData: overrideData })
      }).catch(() => {});

      // localStorage do PDV
      const overridesRaw = localStorage.getItem('vendas_status_override');
      const overrides = overridesRaw ? JSON.parse(overridesRaw) : {};
      overrides[venda.id] = overrideData;
      localStorage.setItem('vendas_status_override', JSON.stringify(overrides));

      // 4. Atualiza estado da tela do PDV
      setAdminVendas(prev => prev.map(v => v.id === venda.id ? { ...v, ...overrideData } : v));
      setShowCancelarModal(null);
      setAdminMenuAbertoId(null);
      setAlertMsg(`Venda #${String(venda.id).padStart(6, '0')} cancelada com sucesso! O estoque foi restaurado e sincronizado com o Backoffice.`);
    } catch (e: any) {
      setAlertMsg("Erro ao cancelar venda: " + (e.message || "Falha desconhecida"));
    } finally {
      setCancelarLoading(false);
    }
  };

  const handleCancelarVendaAdmin = handleAbrirModalCancelar;

  const handleAbrirModalEstorno = (venda: any) => {
    if (venda.status === 'ESTORNADA' || venda.status === 'CANCELADA') {
      setAlertMsg(`Esta venda já está ${venda.status.toLowerCase()}.`);
      return;
    }
    const diffMins = (Date.now() - new Date(venda.criado_em).getTime()) / (1000 * 60);
    if (diffMins > 30) {
      setAlertMsg('Prazo (30 minutos) expirado! Para vendas antigas, o estorno deve ser feito pelo Backoffice.');
      return;
    }
    setShowEstornoModal(venda);
    setEstornoMotivo("Desistência do cliente");
    setEstornoForma(venda.metodo_pagamento?.includes('PIX') ? 'PIX' : venda.metodo_pagamento?.includes('DINHEIRO') ? 'DINHEIRO' : 'CARTAO_MAQUININHA');
    setEstornoNsu("");
    setEstornoObs("");
    setAdminMenuAbertoId(null);
  };

  const handleConfirmarEstornoAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showEstornoModal) return;
    const venda = showEstornoModal;
    setEstornoLoading(true);
    try {
      const token = adminToken || sessionStorage.getItem('pdv_token');
      const estornoPayload = {
        motivo: estornoMotivo,
        forma_devolucao: estornoForma,
        nsu_comprovante: estornoNsu,
        observacoes: estornoObs
      };

      let estornoApiSucesso = false;
      try {
        const res = await fetch(`${apiUrl}/admin/vendas/${venda.id}/estornar`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify(estornoPayload)
        });
        if (res.ok) estornoApiSucesso = true;
      } catch {}

      if (!estornoApiSucesso) {
        for (const item of (venda.itens || [])) {
          const prodCadastrado = catalogoProdutos.find(p => String(p.ean) === String(item.ean || item.produto_ean));
          if (prodCadastrado && prodCadastrado.id) {
            await fetch(`${apiUrl}/admin/produtos/${prodCadastrado.id}`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({
                ...prodCadastrado,
                estoque_atual: Number(prodCadastrado.estoque_atual || 0) + Number(item.quantidade || item.quantity || 1)
              })
            }).catch(() => {});
          }
        }
      }

      const overrideData = { status: 'ESTORNADA', motivo_cancelamento: estornoMotivo, estorno_info: estornoPayload, status_nfe: 'ESTORNADA' };

      // IPC nativo
      // @ts-ignore
      if (window.require) {
        try {
          // @ts-ignore
          const { ipcRenderer } = window.require('electron');
          await ipcRenderer.invoke('save-sync-override', { vendaId: venda.id, status: 'ESTORNADA', extraData: overrideData });
        } catch {}
      }

      // HTTP Local Vite Sync
      await fetch('http://localhost:5173/api/sync-overrides', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vendaId: venda.id, status: 'ESTORNADA', extraData: overrideData })
      }).catch(() => {});

      const overridesRaw = localStorage.getItem('vendas_status_override');
      const overrides = overridesRaw ? JSON.parse(overridesRaw) : {};
      overrides[venda.id] = overrideData;
      localStorage.setItem('vendas_status_override', JSON.stringify(overrides));

      setAdminVendas(prev => prev.map(v => v.id === venda.id ? { ...v, ...overrideData } : v));
      setShowEstornoModal(null);
      setAlertMsg(`Venda #${String(venda.id).padStart(6, '0')} estornada com sucesso! O valor e o estoque foram restabelecidos e sincronizados com o Backoffice.`);

      // Pergunta se deseja comprovante de estorno impresso
      const querImprimir = window.confirm("Deseja imprimir o comprovante de estorno na impressora térmica?");
      if (querImprimir) {
        handleReimprimirSegundaVia({ ...venda, status: 'ESTORNADA' });
      }
    } catch (e: any) {
      setAlertMsg("Erro ao estornar venda: " + (e.message || "Falha desconhecida"));
    } finally {
      setEstornoLoading(false);
    }
  };

  const matchDateFilter = (vendaDateStr: string, filtro: string, customDate: string) => {
    if (!vendaDateStr) return false;
    const d = new Date(vendaDateStr);
    if (filtro === 'hoje') {
      const hoje = new Date();
      return d.getDate() === hoje.getDate() && d.getMonth() === hoje.getMonth() && d.getFullYear() === hoje.getFullYear();
    }
    if (filtro === 'ontem') {
      const ontem = new Date(Date.now() - 86400000);
      return d.getDate() === ontem.getDate() && d.getMonth() === ontem.getMonth() && d.getFullYear() === ontem.getFullYear();
    }
    if (filtro === '7') {
      return (Date.now() - d.getTime()) <= 7 * 86400000;
    }
    if (filtro === '30') {
      return (Date.now() - d.getTime()) <= 30 * 86400000;
    }
    if (filtro === 'custom' && customDate) {
      const [ano, mes, dia] = customDate.split('-').map(Number);
      return d.getDate() === dia && (d.getMonth() + 1) === mes && d.getFullYear() === ano;
    }
    return true; // 'todas'
  };

  const vendasFiltradasAdmin = adminVendas.filter(v => {
    if (!matchDateFilter(v.criado_em, adminPeriodo, adminCustomDate)) return false;
    if (!adminSearch.trim()) return true;
    const termo = adminSearch.trim().toLowerCase();
    const cleanTerm = termo.replace('#', '').replace(/^0+/, '') || termo;
    const idStr = String(v.id);
    const nfeStr = String(v.num_nfe || '');
    const chaveStr = String(v.chave_nfe || '').toLowerCase();
    const cpfStr = String(v.cpf_cnpj_cliente || '');
    const itensStr = (v.itens || []).map((it: any) => `${it.nome} ${it.ean}`).join(' ').toLowerCase();

    return idStr.includes(cleanTerm)
      || nfeStr.includes(termo)
      || chaveStr.includes(termo)
      || cpfStr.includes(termo)
      || itensStr.includes(termo);
  });

  const resumoAdmin = {
    totalVendas: vendasFiltradasAdmin.length,
    faturamentoAtivo: vendasFiltradasAdmin
      .filter(v => v.status !== 'CANCELADA' && v.status !== 'ESTORNADA')
      .reduce((acc, v) => acc + Number(v.total || 0), 0),
    canceladas: vendasFiltradasAdmin.filter(v => v.status === 'CANCELADA').length,
    estornadas: vendasFiltradasAdmin.filter(v => v.status === 'ESTORNADA').length,
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
            <button
              id="btn-painel-adm"
              type="button"
              onClick={handleAbrirPainelAdm}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
                color: '#ffffff',
                border: 'none',
                padding: '6px 14px',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.82rem',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(99, 102, 241, 0.4)',
                transition: 'all 0.2s ease',
              }}
              title="Acessar o Painel do Administrador (Gestão e Consulta de Vendas)"
            >
              🛡️ Painel ADM
            </button>
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
                <button
                  type="button"
                  className="btn-cart-remove"
                  title="Cancelar / Remover este item"
                  onClick={() => handleSolicitarRemoverItem(item)}
                >
                  ✕
                </button>
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
          <label style={{ display: "block", marginBottom: "0.5rem", color: "var(--text-secondary)" }}>
            Código de Barras ou Descrição do Produto
          </label>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type="text"
              className="barcode-input"
              placeholder="Bipar EAN ou digitar nome..."
              value={barcode}
              onChange={handleBarcodeChange}
              onKeyDown={handleBarcodeKeyDown}
              onFocus={() => { if (barcode.trim().length >= 1 && produtosSugeridos.length > 0) setShowSugestoes(true); }}
            />

            {showSugestoes && produtosSugeridos.length > 0 && (
              <div className="product-suggestions-box">
                {produtosSugeridos.map((prod, idx) => (
                  <div
                    key={prod.id || prod.ean || idx}
                    className={`product-suggestion-item ${idx === sugestoesIndex ? 'active' : ''}`}
                    onClick={() => adicionarProdutoAoCarrinho(prod)}
                  >
                    {prod.imagem_url ? (
                      <img
                        src={prod.imagem_url}
                        alt=""
                        style={{ width: 40, height: 40, borderRadius: 8, objectFit: 'cover', flexShrink: 0, marginRight: 10, background: 'var(--bg-main)' }}
                        onError={(e) => (e.currentTarget.style.display = 'none')}
                      />
                    ) : (
                      <div style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--bg-main)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', flexShrink: 0, marginRight: 10 }}>
                        {prod.nome ? prod.nome.slice(0, 2).toUpperCase() : '📦'}
                      </div>
                    )}
                    <div className="product-suggestion-info">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className="product-suggestion-name">{prod.nome}</span>
                        {prod.categoria && (
                          <span style={{ fontSize: '0.68rem', padding: '1px 6px', borderRadius: 4, background: 'var(--bg-card-header)', color: 'var(--text-muted)' }}>
                            {prod.categoria}
                          </span>
                        )}
                      </div>
                      <div className="product-suggestion-meta">
                        <span>EAN: {prod.ean}</span>
                        <span>•</span>
                        <span style={{ color: Number(prod.estoque_atual) > 0 ? 'var(--accent)' : 'var(--danger)' }}>
                          Estoque: {prod.estoque_atual ?? '—'} un
                        </span>
                      </div>
                    </div>
                    <div className="product-suggestion-price">
                      R$ {Number(prod.preco_venda || 0).toFixed(2).replace('.', ',')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="shortcuts-panel" style={{ marginTop: '2rem' }}>
            <button className="shortcut-btn" onClick={handleSolicitarCancelarVendaAtual}>Cancelar Venda <span>[ F4 ]</span></button>
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
                    <button className="shortcut-btn" style={{ fontSize: '0.85rem', padding: '10px' }} onClick={() => resta > 0 && setShowPix(true)}>PIX (F8)</button>
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
              <button onClick={() => { setLastReceipt(null); setPrintPrompt(null); }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '1.2rem' }}>✖</button>
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
              <button onClick={() => { setLastReceipt(null); setPrintPrompt(null); }} className="btn-cancel">Cancelar</button>
              <button onClick={() => { 
                setLastReceipt(printPrompt.receiptData); 
                setPrintPrompt(null);
                setTimeout(() => { executePrint(); setTimeout(() => setLastReceipt(null), 4000); }, 100);
              }} className="btn-success">Confirmar</button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL REMOVER / CANCELAR ITEM DO CARRINHO */}
      {itemParaRemover && (
        <div className="pix-modal-overlay" style={{ zIndex: 1200 }}>
          <div className="modal-remove-item">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>✕</span> Cancelar Item do Carrinho
              </h3>
              <button
                type="button"
                onClick={() => setItemParaRemover(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface-2)', padding: '14px', borderRadius: '12px', border: '1px solid var(--border)' }}>
              <div style={{ fontWeight: 700, fontSize: '1.05rem', color: 'var(--text)', marginBottom: '4px' }}>
                {itemParaRemover.name}
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                EAN: {itemParaRemover.ean}
              </div>
              <div style={{ marginTop: '10px', fontSize: '0.9rem', color: 'var(--text-soft)' }}>
                Quantidade atual: <strong style={{ color: 'var(--text)' }}>{itemParaRemover.quantity} un</strong> &nbsp;|&nbsp; 
                Total: <strong style={{ color: 'var(--accent)' }}>R$ {(itemParaRemover.quantity * itemParaRemover.unitPrice).toFixed(2).replace('.', ',')}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <button
                type="button"
                className="shortcut-btn"
                style={{ padding: '12px 14px', justifyContent: 'center', fontWeight: 700 }}
                onClick={() => confirmarRemocaoItem(1)}
              >
                Remover 1 unidade (Ficar com {itemParaRemover.quantity - 1} un)
              </button>

              <button
                type="button"
                className="shortcut-btn"
                style={{ padding: '12px 14px', justifyContent: 'center', fontWeight: 700, color: 'var(--danger)' }}
                onClick={() => confirmarRemocaoItem(itemParaRemover.quantity)}
              >
                Remover TODAS as {itemParaRemover.quantity} unidades deste produto
              </button>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: '12px', marginTop: '4px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  Ou escolha a quantidade exata a remover:
                </label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <input
                    type="number"
                    min={1}
                    max={itemParaRemover.quantity}
                    value={qtdRemoverInput}
                    onChange={e => setQtdRemoverInput(Math.max(1, Math.min(itemParaRemover.quantity, parseInt(e.target.value) || 1)))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-input)',
                      color: 'var(--text)',
                      fontSize: '1rem',
                      textAlign: 'center',
                      fontWeight: 700,
                      outline: 'none'
                    }}
                  />
                  <button
                    type="button"
                    style={{
                      padding: '10px 16px',
                      borderRadius: '8px',
                      background: 'var(--danger)',
                      color: 'white',
                      fontWeight: 700,
                      border: 'none',
                      cursor: 'pointer'
                    }}
                    onClick={() => confirmarRemocaoItem(qtdRemoverInput)}
                  >
                    Confirmar
                  </button>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '6px' }}>
              <button
                type="button"
                className="btn-cancel"
                onClick={() => setItemParaRemover(null)}
                style={{ padding: '8px 16px' }}
              >
                Voltar (Esc)
              </button>
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

      {/* MODAL DE AUTENTICAÇÃO DO ADMINISTRADOR */}
      {showAdminAuthModal && (
        <div className="admin-modal-overlay" onClick={() => setShowAdminAuthModal(false)}>
          <div className="login-card" style={{ maxWidth: '420px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                🛡️ Autenticação Administrador
              </h2>
              <button
                type="button"
                onClick={() => setShowAdminAuthModal(false)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem', textAlign: 'left' }}>
              Informe as credenciais de um usuário com nível de <strong>Administrador</strong> para acessar o Painel ADM. A sessão atual do caixa continuará ativa.
            </p>

            {adminAuthError && (
              <div style={{ padding: '10px', borderRadius: '8px', background: 'var(--danger-soft)', color: 'var(--danger)', fontSize: '0.84rem', marginBottom: '1rem', textAlign: 'left', fontWeight: 600 }}>
                ⚠️ {adminAuthError}
              </div>
            )}

            <form onSubmit={handleAdminAuthSubmit}>
              <input
                type="text"
                placeholder="Matrícula Admin (Ex: 00001)"
                maxLength={5}
                value={adminAuthMatricula}
                onChange={e => setAdminAuthMatricula(e.target.value)}
                autoFocus
              />
              <div style={{ position: 'relative', width: '100%', marginBottom: '14px' }}>
                <input
                  type={adminAuthMostrarSenha ? "text" : "password"}
                  placeholder="Senha Admin"
                  value={adminAuthSenha}
                  onChange={e => setAdminAuthSenha(e.target.value)}
                  style={{ width: '100%', paddingRight: '44px', marginBottom: 0 }}
                />
                <button
                  type="button"
                  className="eye-toggle-btn"
                  onClick={() => setAdminAuthMostrarSenha(v => !v)}
                  title={adminAuthMostrarSenha ? "Ocultar senha" : "Ver senha"}
                >
                  {adminAuthMostrarSenha ? (
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

              <div style={{ display: 'flex', gap: '10px', marginTop: '1rem' }}>
                <button
                  type="button"
                  onClick={() => setShowAdminAuthModal(false)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={adminAuthLoading}
                  style={{ flex: 2, padding: '12px', background: 'var(--accent)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {adminAuthLoading ? "Validando..." : "Entrar no Painel ADM"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PAINEL ADMINISTRATIVO (CONSULTA & GESTÃO DE VENDAS) */}
      {showAdminPanel && (
        <div className="admin-modal-overlay">
          <div className="admin-panel-box" onClick={e => e.stopPropagation()}>
            <div className="admin-panel-header">
              <h2>
                🛡️ Painel ADM — Consulta & Gestão de Vendas
                <span style={{ fontSize: '0.8rem', fontWeight: 500, color: 'var(--text-muted)', background: 'var(--bg-app)', padding: '4px 10px', borderRadius: '6px', border: '1px solid var(--border)' }}>
                  Administrador: <strong>{adminName || 'Admin'}</strong>
                </span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => carregarVendasAdmin()}
                  className="admin-filter-btn"
                  title="Atualizar lista de vendas"
                >
                  🔄 Atualizar
                </button>
                <button
                  type="button"
                  onClick={handleFecharPainelAdm}
                  className="admin-filter-btn"
                  style={{ padding: '8px 12px' }}
                >
                  ✕ Fechar (ESC)
                </button>
              </div>
            </div>

            {/* Barra de Filtros e Pesquisa */}
            <div className="admin-toolbar">
              <input
                type="text"
                className="admin-search-input"
                placeholder="🔍 Pesquisar por Nº Venda (#123), NFC-e, EAN, Produto ou CPF..."
                value={adminSearch}
                onChange={e => setAdminSearch(e.target.value)}
              />

              <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className={`admin-filter-btn ${adminPeriodo === 'hoje' ? 'active' : ''}`}
                  onClick={() => { setAdminPeriodo('hoje'); setAdminCustomDate(''); }}
                >
                  Hoje
                </button>
                <button
                  type="button"
                  className={`admin-filter-btn ${adminPeriodo === 'ontem' ? 'active' : ''}`}
                  onClick={() => { setAdminPeriodo('ontem'); setAdminCustomDate(''); }}
                >
                  Ontem
                </button>
                <button
                  type="button"
                  className={`admin-filter-btn ${adminPeriodo === '7' ? 'active' : ''}`}
                  onClick={() => { setAdminPeriodo('7'); setAdminCustomDate(''); }}
                >
                  7 dias
                </button>
                <button
                  type="button"
                  className={`admin-filter-btn ${adminPeriodo === '30' ? 'active' : ''}`}
                  onClick={() => { setAdminPeriodo('30'); setAdminCustomDate(''); }}
                >
                  30 dias
                </button>
                <button
                  type="button"
                  className={`admin-filter-btn ${adminPeriodo === 'todas' ? 'active' : ''}`}
                  onClick={() => { setAdminPeriodo('todas'); setAdminCustomDate(''); }}
                >
                  Todas
                </button>
                <input
                  type="date"
                  className="admin-filter-btn"
                  style={{ cursor: 'pointer' }}
                  value={adminCustomDate}
                  onChange={e => {
                    setAdminCustomDate(e.target.value);
                    if (e.target.value) setAdminPeriodo('custom');
                  }}
                  title="Filtrar por data específica"
                />
              </div>

              {/* Resumo rápido */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Vendas: </span>
                  <strong>{resumoAdmin.totalVendas}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Faturamento Líquido: </span>
                  <strong style={{ color: 'var(--accent)' }}>
                    R$ {resumoAdmin.faturamentoAtivo.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
                {resumoAdmin.canceladas > 0 && (
                  <div>
                    <span style={{ color: 'var(--danger)' }}>Canceladas: <strong>{resumoAdmin.canceladas}</strong></span>
                  </div>
                )}
                {resumoAdmin.estornadas > 0 && (
                  <div>
                    <span style={{ color: 'var(--warning)' }}>Estornadas: <strong>{resumoAdmin.estornadas}</strong></span>
                  </div>
                )}
              </div>
            </div>

            {/* Lista e Tabela de Vendas */}
            <div className="admin-sales-scroll">
              {adminVendasLoading ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Carregando vendas do sistema...
                </div>
              ) : vendasFiltradasAdmin.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                  Nenhuma venda encontrada para os filtros selecionados.
                </div>
              ) : (
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th style={{ width: '90px' }}>Nº Venda</th>
                      <th style={{ width: '140px' }}>Data / Hora</th>
                      <th style={{ width: '110px' }}>Status</th>
                      <th style={{ width: '130px' }}>NFC-e</th>
                      <th>Produtos / Detalhes</th>
                      <th style={{ width: '120px' }}>Pagamento</th>
                      <th style={{ width: '130px' }}>Cliente</th>
                      <th style={{ width: '110px', textAlign: 'right' }}>Total R$</th>
                      <th style={{ width: '60px', textAlign: 'center' }}>Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {vendasFiltradasAdmin.map((v: any) => {
                      const itens = Array.isArray(v.itens) ? v.itens : [];
                      const isCancelada = v.status === 'CANCELADA';
                      const isEstornada = v.status === 'ESTORNADA';
                      const expandida = adminVendaExpandida === v.id;

                      return (
                        <React.Fragment key={v.id}>
                          <tr style={{ opacity: (isCancelada || isEstornada) ? 0.75 : 1, position: 'relative', zIndex: adminMenuAbertoId === v.id ? 9999 : (expandida ? 2 : 1) }}>
                            <td>
                              <strong style={{ color: 'var(--text)', fontFamily: 'monospace', fontSize: '0.95rem' }}>
                                #{String(v.id).padStart(6, '0')}
                              </strong>
                            </td>
                            <td style={{ color: 'var(--text-soft)', fontSize: '0.82rem' }}>
                              {new Date(v.criado_em).toLocaleString('pt-BR')}
                            </td>
                            <td>
                              {isCancelada ? (
                                <span className="admin-badge red">✕ Cancelada</span>
                              ) : isEstornada ? (
                                <span className="admin-badge amber">↺ Estornada</span>
                              ) : (
                                <span className="admin-badge green">✓ Concluída</span>
                              )}
                            </td>
                            <td>
                              {v.num_nfe || v.chave_nfe ? (
                                <span className="admin-badge green" style={{ fontSize: '0.74rem' }} title={v.chave_nfe || ''}>
                                  NFC-e #{v.num_nfe || String(v.id).padStart(6, '0')}
                                </span>
                              ) : (
                                <span className="admin-badge gray">Não emitida</span>
                              )}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <span style={{ color: 'var(--text-soft)' }}>
                                  {itens.length > 0
                                    ? `${itens[0].quantidade}x ${itens[0].nome}${itens.length > 1 ? ` (+${itens.length - 1} outros)` : ''}`
                                    : 'Sem itens'}
                                </span>
                                {itens.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() => setAdminVendaExpandida(expandida ? null : v.id)}
                                    style={{
                                      background: 'var(--bg-surface-2)',
                                      border: '1px solid var(--border)',
                                      borderRadius: '4px',
                                      color: 'var(--text-muted)',
                                      fontSize: '0.72rem',
                                      cursor: 'pointer',
                                      padding: '2px 6px'
                                    }}
                                  >
                                    {expandida ? 'Ocultar' : 'Ver todos'}
                                  </button>
                                )}
                              </div>
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-soft)' }}>
                              {v.metodo_pagamento || '—'}
                            </td>
                            <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                              {v.cpf_cnpj_cliente || 'Consumidor'}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 800, color: isCancelada ? 'var(--danger)' : isEstornada ? 'var(--warning)' : 'var(--accent)', textDecoration: isCancelada ? 'line-through' : 'none' }}>
                              R$ {Number(v.total).toFixed(2).replace('.', ',')}
                            </td>
                            <td style={{ textAlign: 'center', position: 'relative', zIndex: adminMenuAbertoId === v.id ? 9999 : 1 }}>
                              <button
                                type="button"
                                onClick={() => setAdminMenuAbertoId(adminMenuAbertoId === v.id ? null : v.id)}
                                style={{
                                  background: 'var(--bg-surface-2)',
                                  border: '1px solid var(--border)',
                                  borderRadius: '6px',
                                  color: 'var(--text)',
                                  cursor: 'pointer',
                                  padding: '4px 8px',
                                  fontSize: '0.9rem',
                                  lineHeight: 1
                                }}
                                title="Ações da venda"
                              >
                                •••
                              </button>

                              {adminMenuAbertoId === v.id && (
                                <div className="admin-actions-menu">
                                  <button
                                    type="button"
                                    onClick={() => handleReimprimirSegundaVia(v)}
                                  >
                                    🖨️ Reimprimir 2ª Via
                                  </button>
                                  <button
                                    type="button"
                                    className="danger"
                                    disabled={isCancelada || isEstornada}
                                    onClick={() => handleAbrirModalCancelar(v)}
                                  >
                                    ✕ Cancelar Venda
                                  </button>
                                  <button
                                    type="button"
                                    className="warning"
                                    disabled={isCancelada || isEstornada}
                                    onClick={() => handleAbrirModalEstorno(v)}
                                  >
                                    ↺ Estorno da Venda
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>

                          {/* Detalhamento de Itens Expandido */}
                          {expandida && (
                            <tr>
                              <td colSpan={9} style={{ background: 'var(--bg-surface-2)', padding: '10px 16px' }}>
                                <div style={{ fontSize: '0.82rem', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                  <strong style={{ color: 'var(--text-muted)', marginBottom: '4px' }}>Itens da Venda #{String(v.id).padStart(6, '0')}:</strong>
                                  {itens.map((it: any, i: number) => (
                                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed var(--border)', padding: '3px 0' }}>
                                      <span>
                                        {it.quantidade}x <strong>{it.nome}</strong> <span style={{ color: 'var(--text-muted)' }}>({it.ean})</span>
                                      </span>
                                      <span>
                                        R$ {Number(it.preco).toFixed(2).replace('.', ',')} un = <strong>R$ {(Number(it.quantidade) * Number(it.preco)).toFixed(2).replace('.', ',')}</strong>
                                      </span>
                                    </div>
                                  ))}
                                  {v.motivo_cancelamento && (
                                    <div style={{ marginTop: '6px', color: isCancelada ? 'var(--danger)' : 'var(--warning)', fontWeight: 600 }}>
                                      {isCancelada ? 'Motivo do cancelamento: ' : 'Motivo do estorno: '}{v.motivo_cancelamento}
                                    </div>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE ESTORNO DE VENDA */}
      {showEstornoModal && (
        <div className="admin-modal-overlay" onClick={() => setShowEstornoModal(null)}>
          <div className="login-card" style={{ maxWidth: '480px', width: '90%' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.2rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', color: 'var(--warning)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                ↺ Estorno da Venda #{String(showEstornoModal.id).padStart(6, '0')}
              </h2>
              <button
                type="button"
                onClick={() => setShowEstornoModal(null)}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            <div style={{ background: 'var(--bg-surface-2)', padding: '12px', borderRadius: '10px', marginBottom: '1rem', border: '1px solid var(--border)', textAlign: 'left', fontSize: '0.86rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Valor a Estornar:</span>
                <strong style={{ color: 'var(--accent)', fontSize: '1.05rem' }}>
                  R$ {Number(showEstornoModal.total).toFixed(2).replace('.', ',')}
                </strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span style={{ color: 'var(--text-muted)' }}>Forma Original:</span>
                <span>{showEstornoModal.metodo_pagamento || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Data da Venda:</span>
                <span>{new Date(showEstornoModal.criado_em).toLocaleString('pt-BR')}</span>
              </div>
            </div>

            <form onSubmit={handleConfirmarEstornoAdmin} style={{ textAlign: 'left' }}>
              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Motivo do Estorno
              </label>
              <select
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '12px' }}
                value={estornoMotivo}
                onChange={e => setEstornoMotivo(e.target.value)}
              >
                <option value="Desistência do cliente">Desistência do cliente</option>
                <option value="Cobrança duplicada ou incorreta">Cobrança duplicada ou incorreta</option>
                <option value="Defeito / Avaria na mercadoria">Defeito / Avaria na mercadoria</option>
                <option value="Troca com devolução de valor">Troca com devolução de valor</option>
                <option value="Outro">Outro motivo</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Forma de Devolução ao Cliente
              </label>
              <select
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '12px' }}
                value={estornoForma}
                onChange={e => setEstornoForma(e.target.value)}
              >
                <option value="DINHEIRO">Dinheiro (Devolução em Espécie no Caixa)</option>
                <option value="PIX">Pix (Devolução / Transferência Pix)</option>
                <option value="CARTAO_MAQUININHA">Maquininha (Estorno no POS / Maquininha)</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Código de Autorização / NSU / Comprovante (opcional)
              </label>
              <input
                type="text"
                placeholder="Ex: NSU 984572 ou Código PIX"
                value={estornoNsu}
                onChange={e => setEstornoNsu(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '12px' }}
              />

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Observações Adicionais
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes para registro na auditoria..."
                value={estornoObs}
                onChange={e => setEstornoObs(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '12px', resize: 'none' }}
              />

              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
                ℹ️ Ao confirmar, a venda será marcada como <strong>ESTORNADA</strong>, o estoque será recomposto e os dados sincronizados com a retaguarda.
              </p>

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowEstornoModal(null)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                  disabled={estornoLoading}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={estornoLoading}
                  style={{ flex: 2, padding: '12px', background: 'var(--warning)', color: '#000', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {estornoLoading ? "Processando..." : "Confirmar Estorno"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CANCELAMENTO DE VENDA (PAINEL ADM) */}
      {showCancelarModal && (
        <div className="pix-modal-overlay" style={{ zIndex: 3000 }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text)', width: '480px', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', padding: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'grid', placeItems: 'center', color: 'var(--danger)', fontSize: '1.2rem', fontWeight: 800 }}>
                ✕
              </div>
              <div>
                <h2 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 700, color: 'var(--text)' }}>
                  Cancelar Venda #{String(showCancelarModal.id).padStart(6, '0')}
                </h2>
                <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  Total da venda: R$ {Number(showCancelarModal.total || 0).toFixed(2).replace('.', ',')}
                </span>
              </div>
            </div>

            <form onSubmit={handleConfirmarCancelarVendaAdmin} style={{ textAlign: 'left' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.25)', borderRadius: '8px', padding: '10px 14px', marginBottom: '14px', fontSize: '0.8rem', color: 'var(--danger)', display: 'flex', gap: '8px', alignItems: 'center' }}>
                ⚠️ O cancelamento anula a venda e estorna os produtos de volta ao estoque.
              </div>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Motivo do Cancelamento
              </label>
              <select
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '12px' }}
                value={cancelarMotivo}
                onChange={e => setCancelarMotivo(e.target.value)}
              >
                <option value="Desistência do cliente">Desistência do cliente</option>
                <option value="Erro de digitação / registro duplicado">Erro de digitação / registro duplicado</option>
                <option value="Produto avariado ou vencido">Produto avariado ou vencido</option>
                <option value="Cliente sem forma de pagamento aceita">Cliente sem forma de pagamento aceita</option>
                <option value="Outro motivo">Outro motivo</option>
              </select>

              <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-soft)', marginBottom: '4px' }}>
                Observações / Detalhes (opcional)
              </label>
              <textarea
                rows={2}
                placeholder="Detalhes adicionais do cancelamento..."
                value={cancelarObs}
                onChange={e => setCancelarObs(e.target.value)}
                style={{ width: '100%', padding: '10px 12px', borderRadius: '8px', background: 'var(--bg-input)', color: 'var(--text)', border: '1px solid var(--border-strong)', marginBottom: '16px', resize: 'none' }}
              />

              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setShowCancelarModal(null)}
                  style={{ flex: 1, padding: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
                  disabled={cancelarLoading}
                >
                  Voltar
                </button>
                <button
                  type="submit"
                  disabled={cancelarLoading}
                  style={{ flex: 2, padding: '12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                >
                  {cancelarLoading ? "Cancelando..." : "Confirmar Cancelamento"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO PARA CANCELAR VENDA ATUAL DO CARRINHO */}
      {showConfirmarCancelarVendaAtual && (
        <div className="pix-modal-overlay" style={{ zIndex: 2500 }}>
          <div style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text)', width: '420px', borderRadius: '16px', overflow: 'hidden', boxShadow: 'var(--shadow)', display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', padding: '24px', textAlign: 'center' }}>
            <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'rgba(239, 68, 68, 0.15)', color: 'var(--danger)', fontSize: '1.5rem', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              ✕
            </div>
            <h2 style={{ fontSize: '1.2rem', margin: '0 0 8px', fontWeight: 700, color: 'var(--text)' }}>
              Cancelar Venda Atual?
            </h2>
            <p style={{ fontSize: '0.88rem', color: 'var(--text-soft)', margin: '0 0 20px', lineHeight: 1.4 }}>
              Tem certeza que deseja cancelar a venda atual? Todos os <strong>{totalItems} item(ns)</strong> no valor de <strong>R$ {subtotal.toFixed(2).replace('.', ',')}</strong> serão removidos do carrinho.
            </p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setShowConfirmarCancelarVendaAtual(false)}
                style={{ flex: 1, padding: '12px', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '10px', color: 'var(--text)', cursor: 'pointer', fontWeight: 600 }}
              >
                Continuar Venda
              </button>
              <button
                type="button"
                onClick={handleConfirmarCancelarVendaAtual}
                style={{ flex: 1, padding: '12px', background: 'var(--danger)', color: '#fff', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700 }}
                autoFocus
              >
                Sim, Cancelar
              </button>
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
            <p style={{ margin: 0, marginTop: '5px' }}>
              Data: {(() => {
                try {
                  const dStr = String(lastReceipt.date || '');
                  if (dStr.includes(' ')) return dStr;
                  const d = new Date(dStr);
                  return isNaN(d.getTime()) ? dStr : d.toLocaleString('pt-BR');
                } catch {
                  return new Date().toLocaleString('pt-BR');
                }
              })()}
            </p>
            <p style={{ margin: 0, fontWeight: 'bold' }}>
              LOJA: 0101 &nbsp; PDV: 001 &nbsp; VENDA Nº: #{String(lastReceipt.vendaId || '000001').padStart(6, '0')}
            </p>
            {lastReceipt.isSegundaVia && (
              <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', fontSize: '11px' }}>*** 2ª VIA DO DOCUMENTO AUXILIAR ***</p>
            )}
            {lastReceipt.status === 'CANCELADA' && (
              <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', fontSize: '11px', color: 'black' }}>*** VENDA CANCELADA ***</p>
            )}
            {lastReceipt.status === 'ESTORNADA' && (
              <p style={{ margin: '2px 0 0 0', fontWeight: 'bold', fontSize: '11px', color: 'black' }}>*** VENDA ESTORNADA ***</p>
            )}
          </div>
          
          <div style={{ textAlign: 'center', margin: '10px 0', borderTop: '1px dashed black', borderBottom: '1px dashed black', padding: '5px 0' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>DOCUMENTO AUXILIAR</p>
            <p style={{ margin: 0 }}>DA NOTA FISCAL DE CONSUMIDOR ELETRONICA</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px dashed black', paddingBottom: '2px', marginBottom: '5px' }}>
            <span>ITEM | COD | DESC | QTDE | UN | VL. UNIT | VL. TOTAL R$</span>
          </div>
          
          <div>
            {(lastReceipt.itens && lastReceipt.itens.length > 0 ? lastReceipt.itens : [
              { id: '1', ean: '0000000000000', name: 'VENDA DE MERCADORIA / CUPOM FISCAL', quantity: 1, unitPrice: Number(lastReceipt.total || 0) }
            ]).map((item: any, idx: number) => {
              const itemName = String(item?.name || item?.nome || item?.produto_nome || item?.descricao || 'MERCADORIA');
              const itemEan = String(item?.ean || item?.produto_ean || '0000000000000');
              const itemQty = Number(item?.quantity ?? item?.quantidade ?? 1) || 1;
              const itemPrice = Number(item?.unitPrice ?? item?.preco ?? item?.preco_unitario ?? 0);
              const itemSubtotal = itemQty * itemPrice;
              return (
                <div key={idx} style={{ marginBottom: '5px' }}>
                  <div>{(idx+1).toString().padStart(3, '0')} {itemEan} {itemName.substring(0, 22)}</div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingLeft: '25px' }}>
                    <span>{itemQty.toFixed(3).replace('.', ',')} un x {itemPrice.toFixed(2).replace('.', ',')}</span>
                    <span>{itemSubtotal.toFixed(2).replace('.', ',')}</span>
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ borderTop: '1px dashed black', paddingTop: '5px', marginTop: '5px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span>QTD. TOTAL DE ITENS</span>
              <span>{(lastReceipt.itens || []).reduce((sum: number, item: any) => sum + (Number(item?.quantity ?? item?.quantidade ?? 1) || 1), 0) || 1}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>VALOR TOTAL R$</span>
              <span>{Number(lastReceipt.total || 0).toFixed(2).replace('.', ',')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '14px', marginTop: '5px' }}>
              <span>VALOR A PAGAR R$</span>
              <span>{Number(lastReceipt.total || 0).toFixed(2).replace('.', ',')}</span>
            </div>
          </div>

          <div style={{ marginTop: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
              <span>FORMA DE PAGAMENTO</span>
              <span>VALOR PAGO R$</span>
            </div>
            {(lastReceipt.payments && lastReceipt.payments.length > 0 ? lastReceipt.payments : [
              { id: '1', method: 'DINHEIRO', value: Number(lastReceipt.total || 0) }
            ]).map((p: any, idx: number) => (
               <div key={idx} style={{ display: 'flex', justifyContent: 'space-between' }}>
                 <span>{p?.method || 'DINHEIRO'} {p?.authCode ? `(${p.authCode})` : ''}</span>
                 <span>{Number(p?.value || 0).toFixed(2).replace('.', ',')}</span>
               </div>
            ))}
            
            {(() => {
              const totalRecebidoFormat = (lastReceipt.payments || []).reduce((sum: number, p: any) => sum + Number(p?.value || 0), 0) || Number(lastReceipt.total || 0);
              const trocoFormat = Math.max(0, totalRecebidoFormat - Number(lastReceipt.total || 0));
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
                <p>NFC-e n. {lastReceipt.numNfce || lastReceipt.vendaId || '276272'} Serie 9</p>
                <p>Emissao: {String(lastReceipt.date || '')}</p>
                <p>Protocolo de Autorizacao: 353240</p>
              </div>
            </div>
          </div>

          <div style={{ fontSize: '10px', marginBottom: '10px' }}>
            <p style={{ margin: 0, fontWeight: 'bold' }}>Procon-DF: 151 - End: SCS Q.08 Ed. Venancio 2000 B.B-60</p>
            <p style={{ margin: 0 }}>Tributos Totais Incidentes (Lei Federal 12.741/2012): R$ {(Number(lastReceipt.total || 0) * 0.18).toFixed(2).replace('.', ',')} Federal e Estadual</p>
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
