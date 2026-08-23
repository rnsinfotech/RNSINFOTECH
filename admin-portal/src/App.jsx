import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import AdminLayout from "./layouts/AdminLayout";
import ErrorBoundary from "./components/ErrorBoundary";
import PageLoader from "./components/PageLoader";
import LoginPage from "./pages/LoginPage";
import ForgotPasswordPage from "./pages/ForgotPasswordPage";
import ResetPasswordPage from "./pages/ResetPasswordPage";
import AcceptInvitationPage from "./pages/AcceptInvitationPage";
import { navItemsFlat } from "./config/navConfig";
const DashboardPage = lazy(() => import("./pages/DashboardPage"));
const StubPage = lazy(() => import("./pages/StubPage"));
const NotFoundPage = lazy(() => import("./pages/NotFoundPage"));
const ProductsListPage = lazy(() => import("./pages/products/ProductsListPage"));
const ProductFormPage = lazy(() => import("./pages/products/ProductFormPage"));
const ProductDetailPage = lazy(() => import("./pages/products/ProductDetailPage"));
const CategoriesListPage = lazy(() => import("./pages/categories/CategoriesListPage"));
const BrandsListPage = lazy(() => import("./pages/brands/BrandsListPage"));
const InventoryPage = lazy(() => import("./pages/inventory/InventoryPage"));
const OrdersListPage = lazy(() => import("./pages/orders/OrdersListPage"));
const OrderDetailPage = lazy(() => import("./pages/orders/OrderDetailPage"));
const PaymentsListPage = lazy(() => import("./pages/payments/PaymentsListPage"));
const PaymentDetailPage = lazy(() => import("./pages/payments/PaymentDetailPage"));
const CustomersListPage = lazy(() => import("./pages/customers/CustomersListPage"));
const CustomerDetailPage = lazy(() => import("./pages/customers/CustomerDetailPage"));
const LeadsListPage = lazy(() => import("./pages/leads/LeadsListPage"));
const ChatPage = lazy(() => import("./pages/chat/ChatPage"));
const WebsitePage = lazy(() => import("./pages/website/WebsitePage"));
const CouponsListPage = lazy(() => import("./pages/coupons/CouponsListPage"));
const ReviewsListPage = lazy(() => import("./pages/reviews/ReviewsListPage"));
const ContentPage = lazy(() => import("./pages/content/ContentPage"));
const SettingsPage = lazy(() => import("./pages/settings/SettingsPage"));
const StaffPage = lazy(() => import("./pages/StaffPage"));
const AuditLogPage = lazy(() => import("./pages/AuditLogPage"));

import { getCurrentAdmin, onAdminUnauthorized } from "./lib/adminApi";

const BUILT_PATHS = new Set(["/products", "/categories", "/brands", "/inventory", "/orders", "/payments", "/customers", "/leads", "/chat", "/website", "/coupons", "/reviews", "/content", "/settings", "/staff", "/audit"]);

function RequireAdmin() {
  const location = useLocation();
  const navigate = useNavigate();
  const [status, setStatus] = useState("checking");
  // Tracks the latest location without making it an effect dependency —
  // the session check below only needs to run once per mount, but a
  // redirect to /login (whenever it happens) should still carry the
  // *current* location as `from`, not the one captured when the effect
  // first ran.
  const locationRef = useRef(location);
  useEffect(() => {
    locationRef.current = location;
  }, [location]);

  // navigate() from plain useNavigate() (non-data-router BrowserRouter,
  // which is what this app uses) is memoized on
  // [basename, navigator, routePathnamesJson, locationPathname, dataRouterContext]
  // internally — locationPathname is in that list, so `navigate` gets a
  // new identity on every route change. Using it as an effect dependency
  // (even just [navigate]) therefore still reruns the effect on every
  // navigation. Track it in a ref, same as location, so the mount-only
  // effect below can depend on truly nothing.
  const navigateRef = useRef(navigate);
  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  useEffect(() => {
    let active = true;
    const redirectToLogin = (reason) => {
      const { pathname, search, hash } = locationRef.current;
      navigateRef.current("/login", { replace: true, state: { from: `${pathname}${search}${hash}`, ...(reason ? { reason } : {}) } });
    };
    const cleanupUnauthorized = onAdminUnauthorized(() => {
      if (active) redirectToLogin("session-expired");
    });
    setStatus("checking");
    getCurrentAdmin().then((admin) => {
      if (!active) return;
      if (admin) setStatus("authenticated");
      else redirectToLogin();
    });
    return () => { active = false; cleanupUnauthorized(); };
    // Deliberately mount-only ([] deps): this used to depend on
    // [location.pathname, location.search, location.hash], which meant a
    // fresh GET /auth/me network call — and a "Checking admin session…"
    // flash replacing the whole outlet — fired on every in-app
    // navigation. A later attempt to fix this depended on [navigate]
    // instead, but under plain BrowserRouter that function's identity
    // *also* changes on every route change (see navigateRef comment
    // above), so that attempt still re-fired on navigation. Both location
    // and navigate are read through refs instead, so this effect
    // genuinely only runs once per mount. A live-revoked session is still
    // caught reactively via onAdminUnauthorized (fired by
    // adminApiRequest on any 401).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (status !== "authenticated") {
    return <PageLoader />;
  }

  return <ErrorBoundary resetKey={location.pathname}><Outlet /></ErrorBoundary>;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
        <Route element={<RequireAdmin />}>
          <Route element={<AdminLayout />}>
            <Route path="/" element={<Suspense fallback={<PageLoader />}><DashboardPage /></Suspense>} />
            <Route path="/products" element={<Suspense fallback={<PageLoader />}><ProductsListPage /></Suspense>} />
            <Route path="/products/new" element={<Suspense fallback={<PageLoader />}><ProductFormPage /></Suspense>} />
            <Route path="/products/:id" element={<Suspense fallback={<PageLoader />}><ProductDetailPage /></Suspense>} />
            <Route path="/products/:id/edit" element={<Suspense fallback={<PageLoader />}><ProductFormPage /></Suspense>} />
            <Route path="/categories" element={<Suspense fallback={<PageLoader />}><CategoriesListPage /></Suspense>} />
            <Route path="/brands" element={<Suspense fallback={<PageLoader />}><BrandsListPage /></Suspense>} />
            <Route path="/inventory" element={<Suspense fallback={<PageLoader />}><InventoryPage /></Suspense>} />
            <Route path="/orders" element={<Suspense fallback={<PageLoader />}><OrdersListPage /></Suspense>} />
            <Route path="/orders/:id" element={<Suspense fallback={<PageLoader />}><OrderDetailPage /></Suspense>} />
            <Route path="/payments" element={<Suspense fallback={<PageLoader />}><PaymentsListPage /></Suspense>} />
            <Route path="/payments/:id" element={<Suspense fallback={<PageLoader />}><PaymentDetailPage /></Suspense>} />
            <Route path="/customers" element={<Suspense fallback={<PageLoader />}><CustomersListPage /></Suspense>} />
            <Route path="/customers/:email" element={<Suspense fallback={<PageLoader />}><CustomerDetailPage /></Suspense>} />
            <Route path="/leads" element={<Suspense fallback={<PageLoader />}><LeadsListPage /></Suspense>} />
            <Route path="/chat" element={<Suspense fallback={<PageLoader />}><ChatPage /></Suspense>} />
            <Route path="/website" element={<Suspense fallback={<PageLoader />}><WebsitePage /></Suspense>} />
            <Route path="/coupons" element={<Suspense fallback={<PageLoader />}><CouponsListPage /></Suspense>} />
            <Route path="/reviews" element={<Suspense fallback={<PageLoader />}><ReviewsListPage /></Suspense>} />
            <Route path="/content" element={<Suspense fallback={<PageLoader />}><ContentPage /></Suspense>} />
            <Route path="/settings" element={<Suspense fallback={<PageLoader />}><SettingsPage /></Suspense>} />
            <Route path="/staff" element={<Suspense fallback={<PageLoader />}><StaffPage /></Suspense>} />
            <Route path="/audit" element={<Suspense fallback={<PageLoader />}><AuditLogPage /></Suspense>} />
            {navItemsFlat.filter((item) => item.path !== "/" && !BUILT_PATHS.has(item.path)).map((item) => (
              <Route key={item.path} path={`${item.path}/*`} element={<Suspense fallback={<PageLoader />}><StubPage /></Suspense>} />
            ))}
            <Route path="*" element={<Suspense fallback={<PageLoader />}><NotFoundPage /></Suspense>} />
          </Route>
        </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
