import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import PanelLayout from '@/components/layout/PanelLayout';
import PublicLayout from '@/components/layout/PublicLayout';
import ProtectedRoute from '@/components/ProtectedRoute';
import { PageLoader } from '@/components/ui';

/* ---- public pages (home eagerly, baaki lazy) ---- */
import Home from '@/pages/Home';

const Restaurants = lazy(() => import('@/pages/Restaurants'));
const RestaurantDetail = lazy(() => import('@/pages/RestaurantDetail'));
const Dining = lazy(() => import('@/pages/Dining'));
const PartyHalls = lazy(() => import('@/pages/PartyHalls'));
const HallDetail = lazy(() => import('@/pages/HallDetail'));
const Offers = lazy(() => import('@/pages/Offers'));
const Login = lazy(() => import('@/pages/Login'));
const Register = lazy(() => import('@/pages/Register'));
const NotFound = lazy(() => import('@/pages/NotFound'));

/* ---- customer pages ---- */
const Checkout = lazy(() => import('@/pages/Checkout'));
const MyOrders = lazy(() => import('@/pages/MyOrders'));
const OrderDetail = lazy(() => import('@/pages/OrderDetail'));
const MyBookings = lazy(() => import('@/pages/MyBookings'));
const Profile = lazy(() => import('@/pages/Profile'));

/* ---- shared manage pages (admin + employee) ---- */
const MenuManager = lazy(() => import('@/pages/manage/MenuManager'));
const OrdersManager = lazy(() => import('@/pages/manage/OrdersManager'));
const BookingsManager = lazy(() => import('@/pages/manage/BookingsManager'));

/* ---- admin ---- */
const AdminDashboard = lazy(() => import('@/pages/admin/AdminDashboard'));
const AdminRestaurants = lazy(() => import('@/pages/admin/AdminRestaurants'));
const AdminEmployees = lazy(() => import('@/pages/admin/AdminEmployees'));
const AdminCoupons = lazy(() => import('@/pages/admin/AdminCoupons'));
const AdminReviews = lazy(() => import('@/pages/admin/AdminReviews'));
const AdminTestimonials = lazy(() => import('@/pages/admin/AdminTestimonials'));
const AdminPayments = lazy(() => import('@/pages/admin/AdminPayments'));
const AdminSettings = lazy(() => import('@/pages/admin/AdminSettings'));

/* ---- employee ---- */
const EmployeeDashboard = lazy(() => import('@/pages/employee/EmployeeDashboard'));
const EmployeeDeliveries = lazy(() => import('@/pages/employee/EmployeeDeliveries'));

export default function App() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ==================== PUBLIC + CUSTOMER ==================== */}
        <Route element={<PublicLayout />}>
          <Route index element={<Home />} />

          <Route path="restaurants" element={<Restaurants />} />
          <Route path="restaurant/:slug" element={<RestaurantDetail />} />
          <Route path="dining" element={<Dining />} />
          <Route path="party-halls" element={<PartyHalls />} />
          <Route path="party-halls/:hallId" element={<HallDetail />} />
          <Route path="offers" element={<Offers />} />

          <Route path="login" element={<Login />} />
          <Route path="register" element={<Register />} />

          {/* login zaroori */}
          <Route element={<ProtectedRoute />}>
            <Route path="checkout" element={<Checkout />} />
            <Route path="my-orders" element={<MyOrders />} />
            <Route path="my-orders/:orderId" element={<OrderDetail />} />
            <Route path="my-bookings" element={<MyBookings />} />
            <Route path="profile" element={<Profile />} />
          </Route>

          <Route path="*" element={<NotFound />} />
        </Route>

        {/* ======================== ADMIN PANEL ======================== */}
        <Route element={<ProtectedRoute roles={['Admin']} />}>
          <Route path="admin" element={<PanelLayout variant="admin" />}>
            <Route index element={<AdminDashboard />} />
            <Route path="restaurants" element={<AdminRestaurants />} />
            <Route path="menu" element={<MenuManager />} />
            <Route path="orders" element={<OrdersManager />} />
            <Route path="bookings" element={<BookingsManager />} />
            <Route path="employees" element={<AdminEmployees />} />
            <Route path="coupons" element={<AdminCoupons />} />
            <Route path="reviews" element={<AdminReviews />} />
            <Route path="testimonials" element={<AdminTestimonials />} />
            <Route path="payments" element={<AdminPayments />} />
            <Route path="settings" element={<AdminSettings />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Route>

        {/* ====================== EMPLOYEE PANEL ======================= */}
        <Route element={<ProtectedRoute roles={['Employee', 'Admin']} />}>
          <Route path="employee" element={<PanelLayout variant="employee" />}>
            <Route index element={<EmployeeDashboard />} />
            <Route path="orders" element={<OrdersManager />} />
            <Route path="menu" element={<MenuManager />} />
            <Route path="bookings" element={<BookingsManager />} />
            <Route path="deliveries" element={<EmployeeDeliveries />} />
            <Route path="*" element={<Navigate to="/employee" replace />} />
          </Route>
        </Route>
      </Routes>
    </Suspense>
  );
}
