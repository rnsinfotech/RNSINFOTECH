import React, { useState } from "react";
import { Link } from "react-router-dom";

import AnnouncementBar from "./components/AnnouncementBar";
import Navbar from "./components/Navbar";
import Footer from "./components/Footer";
import SEO from "./components/SEO";
import Icon from "./components/Icon";
import Avatar from "./components/Avatar";
import AddressForm from "./components/AddressForm";
import { useAddresses } from "./context/AddressContext";
import { useAuth } from "./context/AuthContext";
import { useOrders } from "./context/OrdersContext";
import { useCart } from "./context/CartContext";

import { nav, footer } from "./data/siteData";

/**
 * ProfilePage — the Amazon-style account hub: who you are (with an
 * auto-generated avatar, since there's no photo upload here), quick
 * links into Orders and Cart, account detail editing, saved
 * addresses, and Logout — all living on this one page rather than
 * scattered across the navbar.
 */
export default function ProfilePage() {
  const { currentUser, logout, updateProfile } = useAuth();
  const { orders } = useOrders();
  const { itemCount } = useCart();
  const { addresses, defaultId, addAddress, updateAddress, removeAddress, setDefaultAddress } = useAddresses();

  const [editing, setEditing] = useState(false);
  const [nameDraft, setNameDraft] = useState(currentUser.name);
  const [phoneDraft, setPhoneDraft] = useState(currentUser.phone);
  const [phoneError, setPhoneError] = useState("");

  const [adding, setAdding] = useState(false);
  const [editingAddrId, setEditingAddrId] = useState(null);

  function handleSaveProfile() {
    if (!nameDraft.trim()) return;
    if (!/^\d{10}$/.test(phoneDraft.trim())) {
      setPhoneError("Enter a valid 10-digit phone number");
      return;
    }
    updateProfile({ name: nameDraft.trim(), phone: phoneDraft.trim() });
    setPhoneError("");
    setEditing(false);
  }

  function handleCancelEdit() {
    setNameDraft(currentUser.name);
    setPhoneDraft(currentUser.phone);
    setPhoneError("");
    setEditing(false);
  }

  return (
    <>
      <SEO title="Your profile" noindex />
      <AnnouncementBar />
      <Navbar {...nav} />

      <section className="rns-section" style={{ paddingBottom: 12 }}>
        <div className="rns-container">
          <span className="rns-eyebrow">Account</span>
          <h1 className="rns-section-title" style={{ marginTop: 8 }}>
            Your account
          </h1>
        </div>
      </section>

      <section className="rns-container" style={{ paddingBottom: 64, maxWidth: 780, display: "grid", gap: 18 }}>
        {/* Identity + account details */}
        <div className="rns-card" style={{ padding: 22 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <Avatar name={currentUser.name} size={60} />
              <div>
                <div style={{ fontSize: 17, fontWeight: 600, fontFamily: "var(--rns-font-display)" }}>{currentUser.name}</div>
                <div style={{ fontSize: 13, color: "var(--rns-ink-soft)", marginTop: 2 }}>{currentUser.email}</div>
              </div>
            </div>
            <button onClick={logout} className="rns-btn rns-btn--ghost" style={{ fontSize: 12.5, padding: "8px 12px" }}>
              <Icon name="logout" size={14} />
              Log out
            </button>
          </div>

          <div style={{ marginTop: 20, paddingTop: 18, borderTop: "1px solid var(--rns-line)" }}>
            {!editing ? (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
                <div style={{ display: "grid", gap: 6, fontSize: 13.5 }}>
                  <div>
                    <span style={{ color: "var(--rns-ink-faint)" }}>Name: </span>
                    {currentUser.name}
                  </div>
                  <div>
                    <span style={{ color: "var(--rns-ink-faint)" }}>Email: </span>
                    {currentUser.email}
                  </div>
                  <div>
                    <span style={{ color: "var(--rns-ink-faint)" }}>Phone: </span>
                    {currentUser.phone}
                  </div>
                </div>
                <button onClick={() => setEditing(true)} className="rns-btn rns-btn--ghost" style={{ padding: "6px 10px", fontSize: 12 }}>
                  <Icon name="edit" size={13} />
                  Edit details
                </button>
              </div>
            ) : (
              <div style={{ display: "grid", gap: 12, maxWidth: 360 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Name</label>
                  <input
                    value={nameDraft}
                    onChange={(e) => setNameDraft(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: 6, border: "1px solid var(--rns-line-strong)", fontSize: 13.5 }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Phone number</label>
                  <input
                    value={phoneDraft}
                    onChange={(e) => {
                      setPhoneDraft(e.target.value);
                      if (phoneError) setPhoneError("");
                    }}
                    inputMode="numeric"
                    maxLength={10}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: 6,
                      border: `1px solid ${phoneError ? "#d64545" : "var(--rns-line-strong)"}`,
                      fontSize: 13.5,
                    }}
                  />
                  {phoneError && <div style={{ fontSize: 11.5, color: "#d64545", marginTop: 4 }}>{phoneError}</div>}
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, color: "var(--rns-ink-soft)", marginBottom: 6 }}>Email</label>
                  <div style={{ fontSize: 13, color: "var(--rns-ink-faint)" }}>{currentUser.email} (can't be changed)</div>
                </div>
                <div style={{ display: "flex", gap: 10 }}>
                  <button onClick={handleSaveProfile} className="rns-btn rns-btn--primary" style={{ fontSize: 13 }}>
                    Save changes
                  </button>
                  <button onClick={handleCancelEdit} className="rns-btn rns-btn--ghost" style={{ fontSize: 13 }}>
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Quick links */}
        <div className="rns-profile-tiles">
          <Link to="/orders" className="rns-card rns-profile-tile">
            <Icon name="package" size={20} style={{ color: "var(--rns-ink-soft)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Your orders</div>
              <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                {orders.length} order{orders.length === 1 ? "" : "s"} placed
              </div>
            </div>
          </Link>
          <Link to="/cart" className="rns-card rns-profile-tile">
            <Icon name="cart" size={20} style={{ color: "var(--rns-ink-soft)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Your cart</div>
              <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                {itemCount} item{itemCount === 1 ? "" : "s"} waiting
              </div>
            </div>
          </Link>
          <a href="#addresses" className="rns-card rns-profile-tile">
            <Icon name="mapPin" size={20} style={{ color: "var(--rns-ink-soft)" }} />
            <div>
              <div style={{ fontWeight: 600, fontSize: 13.5 }}>Addresses</div>
              <div style={{ fontSize: 12, color: "var(--rns-ink-faint)", marginTop: 2 }}>
                {addresses.length} saved
              </div>
            </div>
          </a>
        </div>

        {/* Saved addresses */}
        <div className="rns-card" style={{ padding: 22 }} id="addresses">
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Icon name="mapPin" size={16} style={{ color: "var(--rns-ink-soft)" }} />
              <h2 style={{ fontSize: 15, fontFamily: "var(--rns-font-display)", fontWeight: 600 }}>
                Saved addresses
              </h2>
            </div>
            {!adding && (
              <button onClick={() => setAdding(true)} className="rns-btn rns-btn--ghost">
                <Icon name="plus" size={15} />
                Add new address
              </button>
            )}
          </div>

          <div style={{ marginTop: 18, display: "grid", gap: 12 }}>
            {addresses.length === 0 && !adding && (
              <p style={{ fontSize: 13.5, color: "var(--rns-ink-soft)" }}>
                No addresses saved yet. Add one so it's ready to pick at checkout.
              </p>
            )}

            {addresses.map((addr) =>
              editingAddrId === addr.id ? (
                <div key={addr.id} style={{ border: "1px solid var(--rns-line)", borderRadius: "var(--rns-r-sm)", padding: 16 }}>
                  <AddressForm
                    initial={addr}
                    saveLabel="Save changes"
                    onCancel={() => setEditingAddrId(null)}
                    onSave={(next) => {
                      updateAddress(addr.id, next);
                      setEditingAddrId(null);
                    }}
                  />
                </div>
              ) : (
                <div
                  key={addr.id}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 12,
                    border: "1px solid var(--rns-line)",
                    borderRadius: "var(--rns-r-sm)",
                    padding: "14px 16px",
                  }}
                >
                  <div style={{ fontSize: 13.5, lineHeight: 1.7 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ fontWeight: 600 }}>{addr.name}</span>
                      {defaultId === addr.id && (
                        <span className="rns-tag" style={{ fontSize: 10.5 }}>
                          Default
                        </span>
                      )}
                    </div>
                    <div style={{ color: "var(--rns-ink-soft)" }}>{addr.line1}</div>
                    <div style={{ color: "var(--rns-ink-soft)" }}>
                      {[addr.city, addr.state, addr.pincode].filter(Boolean).join(", ")}
                    </div>
                    <div style={{ color: "var(--rns-ink-soft)" }}>Phone: {addr.phone}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, flexShrink: 0 }}>
                    {defaultId !== addr.id && (
                      <button
                        onClick={() => setDefaultAddress(addr.id)}
                        className="rns-btn rns-btn--ghost"
                        style={{ padding: "6px 10px", fontSize: 12 }}
                      >
                        Set default
                      </button>
                    )}
                    <button
                      onClick={() => setEditingAddrId(addr.id)}
                      className="rns-btn rns-btn--ghost"
                      style={{ padding: "6px 10px", fontSize: 12 }}
                    >
                      <Icon name="edit" size={13} />
                      Edit
                    </button>
                    <button
                      onClick={() => removeAddress(addr.id)}
                      className="rns-btn rns-btn--ghost"
                      style={{ padding: "6px 10px", fontSize: 12, color: "#d64545" }}
                    >
                      <Icon name="trash" size={13} />
                      Remove
                    </button>
                  </div>
                </div>
              )
            )}

            {adding && (
              <div style={{ border: "1px solid var(--rns-line)", borderRadius: "var(--rns-r-sm)", padding: 16 }}>
                <AddressForm
                  onCancel={() => setAdding(false)}
                  onSave={(next) => {
                    addAddress(next);
                    setAdding(false);
                  }}
                />
              </div>
            )}
          </div>
        </div>
      </section>

      <Footer logo={nav.logo} {...footer} />

      <style>{`
        .rns-profile-tiles {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 14px;
        }
        .rns-profile-tile {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          color: inherit;
        }
        .rns-profile-tile:hover { border-color: var(--rns-ink); }
        @media (max-width: 620px) {
          .rns-profile-tiles { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </>
  );
}
