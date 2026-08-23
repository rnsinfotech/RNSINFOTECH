import React, { Suspense, lazy } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import "./styles/base.css";

import ProtectedRoute from "./components/ProtectedRoute";
import LiveChatWidget from "./components/LiveChatWidget";
import FlashMessagePopup from "./components/FlashMessagePopup";
import ErrorBoundary from "./components/ErrorBoundary";
import PageLoader from "./components/PageLoader";
import { useScrollToTop } from "./hooks/useMisc";

import { AuthProvider } from "./context/AuthContext";
import { CartProvider } from "./context/CartContext";
import { CompareProvider } from "./context/CompareContext";
import { OrdersProvider } from "./context/OrdersContext";
import { AddressProvider } from "./context/AddressContext";
import { LiveChatProvider } from "./context/LiveChatContext";
import { ToastProvider } from "./context/ToastContext";
import { SiteSettingsProvider } from "./context/SiteSettingsContext";

// Route-level code splitting — every page is its own chunk, so the
// initial bundle only pays for the shell (nav/footer/context) plus
// whichever single page the visitor lands on.
const HomePage = lazy(() => import("./HomePage"));
const ProductsPage = lazy(() => import("./ProductsPage"));
const ProductDetailPage = lazy(() => import("./ProductDetailPage"));
const CartPage = lazy(() => import("./CartPage"));
const CheckoutPage = lazy(() => import("./CheckoutPage"));
const PaymentPage = lazy(() => import("./PaymentPage"));
const OrdersPage = lazy(() => import("./OrdersPage"));
const OrderDetailPage = lazy(() => import("./OrderDetailPage"));
const ProfilePage = lazy(() => import("./ProfilePage"));
const LoginPage = lazy(() => import("./LoginPage"));
const SignupPage = lazy(() => import("./SignupPage"));
const VerifyEmailPage = lazy(() => import("./VerifyEmailPage"));
const HelpPage = lazy(() => import("./HelpPage"));
const SearchResultsPage = lazy(() => import("./SearchResultsPage"));
const AdminChatPage = lazy(() => import("./AdminChatPage"));
const AboutPage = lazy(() => import("./AboutPage"));
const DemoPage = lazy(() => import("./DemoPage"));
const RequestQuotePage = lazy(() => import("./RequestQuotePage"));
const PrivacyPolicyPage = lazy(() => import("./PrivacyPolicyPage"));
const TermsPage = lazy(() => import("./TermsPage"));
const ReturnPolicyPage = lazy(() => import("./ReturnPolicyPage"));
const NotFoundPage = lazy(() => import("./NotFoundPage"));
const CorporateSalesPage = lazy(() => import("./CorporateSalesPage"));
const BlogPage = lazy(() => import("./BlogPage"));
const BlogPostPage = lazy(() => import("./BlogPostPage"));
const WarrantyPage = lazy(() => import("./WarrantyPage"));
const ComparePage = lazy(() => import("./ComparePage"));
// NOTE: FAQPage and ContactPage were deliberately not added — HelpPage.jsx
// already covers both (contact cards + form, and the <FAQs> block at
// /help#faqs) and Phase 6 decided not to duplicate that content into
// separate pages. See PROGRESS_NOTES.md's Phase 6 section for the reasoning.

/** RouteShell — resets scroll on navigation and gives ErrorBoundary a
 * key that changes per-route, so an error on one page doesn't stick
 * around after the visitor navigates away from it. */
function RouteShell({ children }) {
  const location = useLocation();
  useScrollToTop();
  return (
    <div id="main-content" tabIndex={-1} style={{ outline: "none" }}>
      <ErrorBoundary resetKey={location.pathname}>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </ErrorBoundary>
    </div>
  );
}

export default function App() {
  return (
    <SiteSettingsProvider>
    <AuthProvider>
      <AddressProvider>
        <OrdersProvider>
          <CartProvider>
          <CompareProvider>
            <LiveChatProvider>
              <ToastProvider>
                <BrowserRouter>
                  <a href="#main-content" className="rns-skip-link">
                    Skip to content
                  </a>
                  <RouteShell>
                    <Routes>
                      <Route path="/" element={<HomePage />} />
                      <Route path="/products" element={<ProductsPage />} />
                      <Route path="/products/:id" element={<ProductDetailPage />} />
                      <Route path="/cart" element={<CartPage />} />
                      <Route path="/help" element={<HelpPage />} />
                      <Route path="/support" element={<HelpPage />} />
                      <Route path="/search" element={<SearchResultsPage />} />
                      <Route path="/admin/chat" element={<AdminChatPage />} />
                      <Route path="/about" element={<AboutPage />} />
                      <Route path="/demo" element={<DemoPage />} />
                      <Route path="/request-quote" element={<RequestQuotePage />} />
                      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
                      <Route path="/terms" element={<TermsPage />} />
                      <Route path="/return-policy" element={<ReturnPolicyPage />} />
                      <Route path="/warranty" element={<WarrantyPage />} />
                      <Route path="/corporate-sales" element={<CorporateSalesPage />} />
                      <Route path="/blog" element={<BlogPage />} />
                      <Route path="/blog/:slug" element={<BlogPostPage />} />
                      <Route path="/compare" element={<ComparePage />} />
                      <Route path="/login" element={<LoginPage />} />
                      <Route path="/signup" element={<SignupPage />} />
                      <Route path="/verify-email" element={<VerifyEmailPage />} />
                      <Route
                        path="/checkout"
                        element={
                          <ProtectedRoute>
                            <CheckoutPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/checkout/payment"
                        element={
                          <ProtectedRoute>
                            <PaymentPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/orders"
                        element={
                          <ProtectedRoute>
                            <OrdersPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/orders/:orderId"
                        element={
                          <ProtectedRoute>
                            <OrderDetailPage />
                          </ProtectedRoute>
                        }
                      />
                      <Route
                        path="/profile"
                        element={
                          <ProtectedRoute>
                            <ProfilePage />
                          </ProtectedRoute>
                        }
                      />
                      <Route path="*" element={<NotFoundPage />} />
                    </Routes>
                  </RouteShell>
                  <LiveChatWidget />
                  <FlashMessagePopup />
                </BrowserRouter>
              </ToastProvider>
            </LiveChatProvider>
          </CompareProvider>
          </CartProvider>
        </OrdersProvider>
      </AddressProvider>
    </AuthProvider>
    </SiteSettingsProvider>
  );
}
