import { OrderPayload } from '../types';

export function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(amount);
}

export function generateWhatsAppOrderMessage(order: OrderPayload): string {
  const dataHora = new Date().toLocaleString('pt-BR');
  
  let msg = `🛒 *NOVO PEDIDO - TAILÂNDIA DISTRIBUIDORA*\n`;
  msg += `📅 *Data:* ${dataHora}\n`;
  msg += `👤 *Cliente:* ${order.cliente.nome}\n`;
  msg += `📱 *Telefone:* ${order.cliente.telefone}\n`;
  if (order.cliente.cpfCnpj) {
    msg += `📄 *CPF/CNPJ na Nota:* ${order.cliente.cpfCnpj}\n`;
  }
  msg += `\n📦 *ITENS DO PEDIDO:*\n`;

  order.itens.forEach((item, index) => {
    const totalItem = item.product.preco_venda * item.quantity;
    msg += `${index + 1}. *${item.quantity}x* ${item.product.nome}\n`;
    msg += `   └ Valor: ${formatBRL(totalItem)} (${formatBRL(item.product.preco_venda)} un)\n`;
  });

  msg += `\n💰 *RESUMO FINANCEIRO:*\n`;
  msg += `• Subtotal: ${formatBRL(order.subtotal)}\n`;
  if (order.desconto > 0) {
    msg += `• Desconto (Cupom ${order.cupom || ''}): -${formatBRL(order.desconto)}\n`;
  }
  
  if (order.tipoEntrega === 'DELIVERY') {
    msg += `• Taxa de Entrega: ${formatBRL(order.taxaEntrega)}\n`;
  } else {
    msg += `• Retirada no Balcão: Grátis\n`;
  }
  
  msg += `👉 *TOTAL A PAGAR: ${formatBRL(order.total)}*\n`;

  msg += `\n💳 *FORMA DE PAGAMENTO:* ${order.metodoPagamento}`;
  if (order.metodoPagamento === 'DINHEIRO' && order.trocoPara) {
    msg += ` (Troco para ${formatBRL(order.trocoPara)})`;
  }
  msg += `\n`;

  if (order.tipoEntrega === 'DELIVERY' && order.endereco) {
    msg += `\n📍 *ENDEREÇO DE ENTREGA:*\n`;
    msg += `${order.endereco.rua}, Nº ${order.endereco.numero}\n`;
    if (order.endereco.complemento) msg += `Complemento: ${order.endereco.complemento}\n`;
    msg += `Bairro: ${order.endereco.bairro} - Taguatinga/DF\n`;
    msg += `CEP: ${order.endereco.cep}\n`;
  } else {
    msg += `\n🏪 *RETIRADA:* Na loja física da Tailândia (Taguatinga/DF).\n`;
  }

  if (order.observacoes) {
    msg += `\n💬 *Observações:* ${order.observacoes}\n`;
  }

  msg += `\n_Pedido enviado automaticamente pela Loja Virtual Tailândia._`;

  return encodeURIComponent(msg);
}

export function generateWhatsAppLink(
  items: { product: any; quantity: number }[],
  deliveryType: 'DELIVERY' | 'RETIRADA',
  location: string,
  coupon?: string,
  discount: number = 0,
  fee: number = 0,
  total: number = 0,
  customerName?: string
): string {
  const dataHora = new Date().toLocaleString('pt-BR');
  let msg = `🛒 *NOVO PEDIDO - TAILÂNDIA DISTRIBUIDORA*\n`;
  msg += `📅 *Data:* ${dataHora}\n`;
  if (customerName) {
    msg += `👤 *Cliente:* ${customerName}\n`;
  }
  msg += `📍 *Modalidade:* ${deliveryType === 'DELIVERY' ? `Entrega em ${location}` : 'Retirada no Balcão'}\n\n`;
  
  msg += `📦 *ITENS DO PEDIDO:*\n`;
  items.forEach((item, index) => {
    const itemTotal = item.product.preco_venda * item.quantity;
    msg += `${index + 1}. *${item.quantity}x* ${item.product.nome}\n`;
    msg += `   └ Valor: ${formatBRL(itemTotal)}\n`;
  });

  msg += `\n💰 *VALOR FINAL:*\n`;
  if (discount > 0) {
    msg += `• Desconto (Cupom ${coupon || ''}): -${formatBRL(discount)}\n`;
  }
  if (deliveryType === 'DELIVERY') {
    msg += `• Taxa de Entrega: ${fee === 0 ? 'Grátis' : formatBRL(fee)}\n`;
  }
  msg += `👉 *TOTAL: ${formatBRL(total)}*\n\n`;
  msg += `Gostaria de confirmar a forma de pagamento e o envio!`;

  return `https://wa.me/5561999999999?text=${encodeURIComponent(msg)}`;
}

