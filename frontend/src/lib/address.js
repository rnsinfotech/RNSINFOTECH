export const EMPTY_ADDRESS = {
  name: "",
  line1: "",
  city: "",
  state: "",
  pincode: "",
  phone: "",
  gstin: "",
};

/**
 * validateAddress — same rules the old CartPage checkout form used,
 * lifted out so both ProfilePage (saving to the address book) and
 * CheckoutPage (adding an address inline) validate identically.
 */
export function validateAddress(address) {
  const required = ["name", "line1", "city", "state", "pincode", "phone"];
  const errors = {};
  required.forEach((f) => {
    if (!address[f] || !address[f].trim()) errors[f] = "Required";
  });
  if (address.pincode && !/^\d{6}$/.test(address.pincode.trim())) {
    errors.pincode = "Enter a valid 6-digit pincode";
  }
  if (address.phone && !/^\d{10}$/.test(address.phone.trim())) {
    errors.phone = "Enter a valid 10-digit phone number";
  }
  return errors;
}
