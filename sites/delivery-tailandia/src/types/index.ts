export type CategoryType = 
  | 'TODAS'
  | 'Cervejas'
  | 'Destilados'
  | 'Combos'
  | 'Vinhos'
  | 'Tabacaria'
  | 'Pods/Headshop'
  | 'Petiscos & Doces'
  | 'Gelo & Carvão'
  | 'Tailandia Grill';

export interface Product {
  id: number;
  ean: string;
  sku?: string;
  nome: string;
  categoria: string;
  subcategoria?: string;
  preco_venda: number;
  preco_promocional?: number;
  preco_custo?: number;
  estoque_atual: number;
  unidade_medida?: 'UN' | 'Lata' | 'Garrafa' | 'Fardo' | 'Caixa' | 'Pacote' | 'Maço';
  volume?: string;
  imagem_url: string;
  descricao: string;
  descricao_completa?: string;
  tags?: string[];
  destaque_home?: boolean;
  delivery_online?: boolean;
  selo_especial?: 'Gelada' | 'Mais Vendido' | 'Combo' | 'Promoção' | 'Novidade';
  ativo: boolean;
  wp_id?: number;
}

export interface CartItem {
  product: Product;
  quantity: number;
  observacao?: string;
}

export interface DeliveryAddress {
  cep: string;
  rua: string;
  bairro: string;
  numero: string;
  complemento?: string;
  cidade: string;
  estado: string;
  taxaEntrega: number;
}

export interface OrderPayload {
  tipoEntrega: 'DELIVERY' | 'RETIRADA';
  itens: CartItem[];
  subtotal: number;
  desconto: number;
  taxaEntrega: number;
  total: number;
  cupom?: string;
  endereco?: DeliveryAddress;
  metodoPagamento: 'PIX' | 'CARTAO_CREDITO' | 'CARTAO_DEBITO' | 'DINHEIRO';
  trocoPara?: number;
  cliente: {
    nome: string;
    telefone: string;
    cpfCnpj?: string;
  };
  observacoes?: string;
}
