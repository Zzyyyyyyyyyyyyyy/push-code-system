import type { ReactNode } from "react";
import "./page-header.css";

export interface PageHeaderProps {
  /** Mono parenthetical-style eyebrow (auto-uppercased). */
  eyebrow?: string;
  /** H1 — Darky display per Design.md § 3.1. */
  title: string;
  /** Mono body subtitle below the title. */
  subtitle?: string;
  /** Right-side action slot — typically a CTA or button cluster. */
  action?: ReactNode;
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  action,
}: PageHeaderProps) {
  return (
    <header className="ms-page-header">
      <div className="ms-page-header-left">
        {eyebrow ? <p className="ms-page-header-eyebrow">{eyebrow}</p> : null}
        <h1 className="ms-page-header-title">{title}</h1>
        {subtitle ? (
          <p className="ms-page-header-subtitle">{subtitle}</p>
        ) : null}
      </div>
      {action ? <div className="ms-page-header-action">{action}</div> : null}
    </header>
  );
}
