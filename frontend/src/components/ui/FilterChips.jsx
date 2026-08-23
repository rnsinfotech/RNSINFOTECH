import React from "react";
import Icon from "../Icon";

/**
 * FilterChips — row of removable pills reflecting currently active
 * filters, e.g. [{key:"brand:Wacom", label:"Brand: Wacom", onRemove}].
 * Renders nothing when the list is empty.
 */
export default function FilterChips({ chips = [], onClearAll }) {
  if (!chips.length) return null;
  return (
    <div className="rns-chips" role="group" aria-label="Active filters">
      {chips.map((chip) => (
        <button key={chip.key} type="button" className="rns-chip" onClick={chip.onRemove}>
          {chip.label}
          <Icon name="close" size={11} />
        </button>
      ))}
      {chips.length > 1 && (
        <button type="button" className="rns-chip rns-chip--clear" onClick={onClearAll}>
          Clear all
        </button>
      )}
    </div>
  );
}
