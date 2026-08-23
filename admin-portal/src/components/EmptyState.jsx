import React from "react";
import Icon from "./Icon";

export default function EmptyState({ icon = "info", title, description, phase }) {
  return (
    <div className="admin-card admin-empty">
      <div className="admin-empty__icon">
        <Icon name={icon} size={20} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {phase && <span className="admin-empty__phase">Coming in Phase {phase}</span>}
    </div>
  );
}
