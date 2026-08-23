import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

/**
 * Button — variants: "primary" | "ghost" | "text"
 * Pass `as="a"` + `href` to render a link styled as a button.
 *
 * Internal hrefs (starting with "/") are routed through React Router's
 * <Link> even when as="a" is passed, so this always does a client-side
 * transition instead of a full page reload. A full reload sends the
 * browser straight to the static host for that path (e.g. /demo), and
 * since that's a client-only route with no matching file on disk, the
 * host returns a real 404 instead of ever handing control back to the
 * app. External/mailto/tel links still render as plain <a> tags.
 */
export default function Button({
  children,
  variant = "primary",
  icon,
  as = "button",
  className = "",
  href,
  ...rest
}) {
  const classes = `rns-btn rns-btn--${variant} ${className}`;

  if (as === "a" && href?.startsWith("/")) {
    return (
      <Link to={href} className={classes} {...rest}>
        {children}
        {icon && <Icon name={icon} size={16} />}
      </Link>
    );
  }

  const Tag = as;
  return (
    <Tag className={classes} href={href} {...rest}>
      {children}
      {icon && <Icon name={icon} size={16} />}
    </Tag>
  );
}
