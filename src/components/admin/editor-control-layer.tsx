"use client";

import { ArrowDown, ArrowUp, Copy, Pencil, Settings, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

type EditorControlLayerProps = {
  title: string;
  detail?: string;
  anchorKey?: string;
  onEdit: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onDelete: () => void;
  onSettings: () => void;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  canDuplicate?: boolean;
  canDelete?: boolean;
};

type SelectedElementOverlayProps = {
  active: boolean;
  anchorKey?: string;
  children: ReactNode;
  className?: string;
  hidden?: boolean;
  onClick?: () => void;
  style?: CSSProperties;
};

export function EditorControlLayer(props: EditorControlLayerProps) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [floatingStyle, setFloatingStyle] = useState<CSSProperties | undefined>();

  useEffect(() => {
    function updatePosition() {
      if (!props.anchorKey || window.innerWidth <= 768) {
        setFloatingStyle(undefined);
        return;
      }

      const anchor = document.querySelector<HTMLElement>(`[data-builder-control-anchor="${cssEscape(props.anchorKey)}"]`);
      const toolbar = toolbarRef.current;
      if (!anchor || !toolbar) {
        setFloatingStyle({
          left: "50%",
          position: "fixed",
          top: 88,
          transform: "translateX(-50%)"
        });
        return;
      }

      const rect = anchor.getBoundingClientRect();
      const toolbarHeight = toolbar.offsetHeight || 52;
      const gap = 10;
      const top = rect.top > toolbarHeight + 24 ? rect.top - toolbarHeight - gap : Math.min(window.innerHeight - toolbarHeight - 20, rect.bottom + gap);
      const center = Math.min(window.innerWidth - 360, Math.max(360, rect.left + rect.width / 2));

      setFloatingStyle({
        left: center,
        position: "fixed",
        top: Math.max(16, top),
        transform: "translateX(-50%)"
      });
    }

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [props.anchorKey]);

  return (
    <div ref={toolbarRef} className="editor-control-layer" style={floatingStyle}>
      <EditorMasterToolbar {...props} />
    </div>
  );
}

export function EditorMasterToolbar({
  title,
  detail,
  onEdit,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDelete,
  onSettings,
  canMoveUp = true,
  canMoveDown = true,
  canDuplicate = true,
  canDelete = true
}: EditorControlLayerProps) {
  return (
    <div className="editor-master-toolbar" role="toolbar" aria-label="Ausgewähltes Element bearbeiten">
      <div className="editor-master-toolbar-label">
        <strong>{title}</strong>
        {detail ? <span>{detail}</span> : null}
      </div>
      <div className="editor-master-toolbar-actions">
        <MasterToolbarButton label="Bearbeiten" onClick={onEdit}>
          <Pencil className="h-3.5 w-3.5" />
        </MasterToolbarButton>
        <MasterToolbarButton label="Einstellungen" onClick={onSettings}>
          <Settings className="h-3.5 w-3.5" />
        </MasterToolbarButton>
        <MasterToolbarDivider />
        <MasterToolbarButton label="Nach oben" onClick={onMoveUp} disabled={!canMoveUp}>
          <ArrowUp className="h-3.5 w-3.5" />
        </MasterToolbarButton>
        <MasterToolbarButton label="Nach unten" onClick={onMoveDown} disabled={!canMoveDown}>
          <ArrowDown className="h-3.5 w-3.5" />
        </MasterToolbarButton>
        <MasterToolbarButton label="Duplizieren" onClick={onDuplicate} disabled={!canDuplicate}>
          <Copy className="h-3.5 w-3.5" />
        </MasterToolbarButton>
        <MasterToolbarButton label="Löschen" onClick={onDelete} disabled={!canDelete} destructive>
          <Trash2 className="h-3.5 w-3.5" />
        </MasterToolbarButton>
      </div>
    </div>
  );
}

export function SelectedElementOverlay({
  active,
  anchorKey,
  children,
  className = "",
  hidden,
  onClick,
  style
}: SelectedElementOverlayProps) {
  return (
    <section
      data-builder-control-anchor={anchorKey}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
      className={`selected-element-overlay ${active ? "selected-element-overlay-active" : ""} ${hidden ? "selected-element-overlay-muted" : ""} ${className}`}
      style={style}
    >
      {children}
    </section>
  );
}

function MasterToolbarButton({
  children,
  destructive,
  disabled,
  label,
  onClick
}: {
  children: ReactNode;
  destructive?: boolean;
  disabled?: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
      className={`editor-master-toolbar-button ${destructive ? "editor-master-toolbar-button-danger" : ""}`}
    >
      {children}
      <span>{label}</span>
    </button>
  );
}

function MasterToolbarDivider() {
  return <span className="editor-master-toolbar-divider" aria-hidden="true" />;
}

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") return CSS.escape(value);
  return value.replace(/["\\]/g, "\\$&");
}
