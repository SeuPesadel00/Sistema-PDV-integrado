import type { Metadata } from 'next';
import './globals.css';
import { CartProvider } from '../context/CartContext';
import CartDrawer from '../components/CartDrawer';
import LocationModal from '../components/LocationModal';
import QuickViewModal from '../components/QuickViewModal';
import FloatingWhatsApp from '../components/FloatingWhatsApp';

export const metadata: Metadata = {
  title: 'Tailândia Distribuidora & Tabacaria | Delivery de Bebidas 24h em Brasília',
  description: 'A maior distribuidora de bebidas e tabacaria de Taguatinga e DF. Cervejas trincando de geladas, combos de whisky e gin, essências, carvão e jantinhas com entrega expressa!',
  keywords: [
    'delivery de bebidas',
    'distribuidora taguatinga',
    'bebida gelada brasilia',
    'combos de whisky',
    'tabacaria 24 horas',
    'tailandia distribuidora',
    'cerveja delivery',
    'red bull combo'
  ],
  authors: [{ name: 'Tailândia Distribuidora' }],
  icons: {
    icon: '/favicon.ico',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="bg-slate-950 text-slate-100 antialiased min-h-screen selection:bg-amber-500 selection:text-slate-950">
        <CartProvider>
          {children}
          <CartDrawer />
          <LocationModal />
          <QuickViewModal />
          <FloatingWhatsApp />
        </CartProvider>
      </body>
    </html>
  );
}
