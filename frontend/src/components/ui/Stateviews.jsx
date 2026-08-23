import React from "react";
import { Link } from "react-router-dom";
import Icon from "../Icon";
import Button from "../Button";

/**
 * Internal paths (href starting with "/") render as router `Link`s so
 * navigating from an EmptyState/ErrorState action doesn't force a full
 * page reload — same convention as SectionHeader/CTASection/Navbar/Footer.
 */
function isInternal(href) {
  return typeof href === "string" && href.startsWith("/");
}

/**
 * StateBlock — shared shell for EmptyState / ErrorState so every
 * "nothing to show" moment in the app looks and behaves the same way.
 */
function StateBlock({ icon, tone = "neutral", title, message, action, secondaryAction, children }) {
  return (
    <div className={`rns-state rns-state--${tone}`} role={tone === "error" ? "alert" : "status"}>
      <div className="rns-state__icon" aria-hidden="true">
        <Icon name={icon} size={26} />
      </div>
      <div className="rns-state__title">{title}</div>
      {message && <p className="rns-state__message">{message}</p>}
      {children}
      {(action || secondaryAction) && (
        <div className="rns-state__actions">
          {action && (
            <Button
              variant="primary"
              as={action.href ? (isInternal(action.href) ? Link : "a") : "button"}
              to={isInternal(action.href) ? action.href : undefined}
              href={!isInternal(action.href) ? action.href : undefined}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="ghost"
              as={secondaryAction.href ? (isInternal(secondaryAction.href) ? Link : "a") : "button"}
              to={isInternal(secondaryAction.href) ? secondaryAction.href : undefined}
              href={!isInternal(secondaryAction.href) ? secondaryAction.href : undefined}
              onClick={secondaryAction.onClick}
            >
              {secondaryAction.label}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export function EmptyState({
  icon = "layers",
  title = "Nothing here yet",
  message,
  action,
  secondaryAction,
  children,
}) {
  return (
    <StateBlock
      icon={icon}
      tone="neutral"
      title={title}
      message={message}
      action={action}
      secondaryAction={secondaryAction}
    >
      {children}
    </StateBlock>
  );
}

export function ErrorState({
  icon = "alert",
  title = "Something went wrong",
  message = "That didn't load correctly. Please try again.",
  action,
  secondaryAction,
}) {
  return (
    <StateBlock
      icon={icon}
      tone="error"
      title={title}
      message={message}
      action={action || { label: "Try again", onClick: () => window.location.reload() }}
      secondaryAction={secondaryAction}
    />
  );
}

/** InlineSpinner — small spinner for buttons / inline loading states. */
export function InlineSpinner({ size = 16, label = "Loading" }) {
  return (
    <span
      className="rns-spinner"
      style={{ width: size, height: size }}
      role="status"
      aria-label={label}
    />
  );
}
