import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { apiRequest, normalizeAddress } from "../lib/api";
import { useAuth } from "./AuthContext";

const AddressContext = createContext(null);

export function AddressProvider({ children }) {
  const { currentUser, isAuthenticated } = useAuth();
  const [addresses, setAddresses] = useState([]);
  const [defaultId, setDefaultId] = useState(null);
  const [addressesError, setAddressesError] = useState(null);

  const loadAddresses = async () => {
    if (!isAuthenticated) {
      setAddresses([]);
      setDefaultId(null);
      return;
    }

    try {
      setAddressesError(null);
      const response = await apiRequest("/addresses", { authRequired: true });
      const items = (response.items || []).map((address) => normalizeAddress(address));
      setAddresses(items);
      const defaultAddress = items.find((address) => address.isDefault) || items[0] || null;
      setDefaultId(defaultAddress?.id || null);
    } catch (error) {
      setAddressesError(error);
    }
  };

  useEffect(() => {
    loadAddresses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser, isAuthenticated]);

  const api = useMemo(() => ({
    addresses,
    addressesError,
    defaultId,
    refreshAddresses: loadAddresses,
    addAddress: async (address) => {
      const payload = {
        fullName: address.name || "",
        phone: address.phone || "",
        line1: address.line1 || "",
        line2: address.line2 || "",
        city: address.city || "",
        state: address.state || "",
        pincode: address.pincode || "",
        gstin: address.gstin || "",
        country: address.country || "India",
        isDefault: Boolean(address.isDefault),
      };

      const response = await apiRequest("/addresses", {
        method: "POST",
        body: payload,
        authRequired: true,
      });

      const newAddress = normalizeAddress(response.address);
      setAddresses((prev) => [newAddress, ...prev.filter((item) => item.id !== newAddress.id)]);
      if (newAddress.isDefault) setDefaultId(newAddress.id);
      return newAddress;
    },
    updateAddress: async (id, patch) => {
      const payload = {
        ...(patch.name ? { fullName: patch.name } : {}),
        ...(patch.phone ? { phone: patch.phone } : {}),
        ...(patch.line1 ? { line1: patch.line1 } : {}),
        ...(patch.line2 !== undefined ? { line2: patch.line2 || "" } : {}),
        ...(patch.city ? { city: patch.city } : {}),
        ...(patch.state ? { state: patch.state } : {}),
        ...(patch.pincode ? { pincode: patch.pincode } : {}),
        ...(patch.gstin !== undefined ? { gstin: patch.gstin || "" } : {}),
        ...(patch.country ? { country: patch.country } : {}),
        ...(patch.isDefault !== undefined ? { isDefault: Boolean(patch.isDefault) } : {}),
      };

      const response = await apiRequest(`/addresses/${id}`, {
        method: "PATCH",
        body: payload,
        authRequired: true,
      });
      const updated = normalizeAddress(response.address);
      setAddresses((prev) => prev.map((item) => (item.id === updated.id ? updated : item)));
      if (updated.isDefault) setDefaultId(updated.id);
      return updated;
    },
    removeAddress: async (id) => {
      await apiRequest(`/addresses/${id}`, {
        method: "DELETE",
        authRequired: true,
      });
      setAddresses((prev) => {
        const next = prev.filter((item) => item.id !== id);
        if (defaultId === id) setDefaultId(next[0]?.id || null);
        return next;
      });
      return true;
    },
    setDefaultAddress: async (id) => {
      const response = await apiRequest(`/addresses/${id}`, {
        method: "PATCH",
        body: { isDefault: true },
        authRequired: true,
      });
      const updated = normalizeAddress(response.address);
      setAddresses((prev) => prev.map((item) => ({ ...item, isDefault: item.id === updated.id }))); 
      setDefaultId(updated.id);
      return updated;
    },
  }), [addresses, defaultId, currentUser, isAuthenticated]);

  return <AddressContext.Provider value={api}>{children}</AddressContext.Provider>;
}

export function useAddresses() {
  const ctx = useContext(AddressContext);
  if (!ctx) throw new Error("useAddresses must be used within an AddressProvider");
  return ctx;
}
