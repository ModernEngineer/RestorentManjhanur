import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import CartDrawer from '../CartDrawer';
import WhatsAppButton from '../WhatsAppButton';
import Footer from './Footer';
import Navbar from './Navbar';

export default function PublicLayout() {
  const [cartOpen, setCartOpen] = useState(false);
  const { pathname } = useLocation();

  // Home page ka hero navbar ke neeche se shuru hota hai (transparent navbar),
  // baaki pages me navbar ki height ka padding chahiye.
  const isHome = pathname === '/';

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar onCartClick={() => setCartOpen(true)} />

      <main className={isHome ? '' : 'pt-16'}>
        <Outlet />
      </main>

      <Footer />

      <CartDrawer open={cartOpen} onClose={() => setCartOpen(false)} />
      <WhatsAppButton />
    </div>
  );
}
