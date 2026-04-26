"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TextAlign from "@tiptap/extension-text-align";
import { TextStyle } from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { Table } from "@tiptap/extension-table";
import TableRow from "@tiptap/extension-table-row";
import TableCell from "@tiptap/extension-table-cell";
import TableHeader from "@tiptap/extension-table-header";
import CharacterCount from "@tiptap/extension-character-count";
import Subscript from "@tiptap/extension-subscript";
import Superscript from "@tiptap/extension-superscript";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import Typography from "@tiptap/extension-typography";
import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";

// ─── Build theme tokens from dark prop (mirrors UserManagement pattern) ───────
function buildTheme(dark) {
  return {
    // Layout
    bg:      dark ? "#080b12"  : "#f8fafc",
    surface: dark ? "#0e1420"  : "#ffffff",
    card:    dark ? "#111827"  : "#f1f5f9",
    // Borders
    border:  dark ? "#1a2233"  : "#e2e8f0",
    border2: dark ? "#1e2d42"  : "#cbd5e1",
    // Text
    text:    dark ? "#e2e8f0"  : "#1e293b",
    muted:   dark ? "#4d6080"  : "#64748b",
    muted2:  dark ? "#374760"  : "#94a3b8",
    // Inputs
    inputBg: dark ? "#070a10"  : "#ffffff",
    // Accents
    green:   "#34d058",
    greenBg: dark ? "rgba(52,208,88,0.1)"  : "rgba(34,197,94,0.08)",
    greenBd: dark ? "rgba(52,208,88,0.35)" : "rgba(34,197,94,0.3)",
    blue:    dark ? "#58a6ff"  : "#3b82f6",
    blueBg:  dark ? "rgba(88,166,255,0.12)" : "rgba(59,130,246,0.08)",
    blueBd:  dark ? "rgba(88,166,255,0.35)" : "rgba(59,130,246,0.3)",
    red:     dark ? "#f85149"  : "#ef4444",
    redBg:   dark ? "rgba(248,81,73,0.1)"  : "rgba(239,68,68,0.08)",
    redBd:   dark ? "rgba(248,81,73,0.3)"  : "rgba(239,68,68,0.25)",
    yellow:  dark ? "#e3b341"  : "#d97706",
    purple:  dark ? "#bc8cff"  : "#7c3aed",
    cyan:    dark ? "#79c0ff"  : "#0ea5e9",
    // Skeleton
    skeleton: dark ? "#1e2535" : "#e2e8f0",
    // Row hover
    rowHover: dark ? "rgba(255,255,255,0.02)" : "#f8fafc",
    // Head bg
    headBg:  dark ? "#0a0d14"  : "#f1f5f9",
  };
}

const SlashCommands = Extension.create({
  name: "slashCommands",
  addProseMirrorPlugins() {
    return [new Plugin({ key: new PluginKey("slashCommands") })];
  },
});

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status, T }) {
  const published = status === "published";
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      padding: "3px 10px", borderRadius: 100,
      background: published ? T.greenBg : "rgba(77,96,128,0.15)",
      border: `1px solid ${published ? T.greenBd : "rgba(77,96,128,0.25)"}`,
      color: published ? T.green : T.muted,
      fontSize: 10, fontWeight: 700, letterSpacing: 0.5, textTransform: "uppercase",
      whiteSpace: "nowrap",
    }}>
      <span style={{
        width: 5, height: 5, borderRadius: "50%",
        background: published ? T.green : T.muted,
        boxShadow: published ? `0 0 6px ${T.green}` : "none",
      }} />
      {status}
    </span>
  );
}

// ─── Slash Command Menu ───────────────────────────────────────────────────────
function SlashMenu({ position, onSelect, onClose, T }) {
  const groups = [
    {
      label: "Text",
      items: [
        { label: "Heading 1", icon: "H1", desc: "Large heading",     cmd: "h1",    color: T.blue },
        { label: "Heading 2", icon: "H2", desc: "Medium heading",    cmd: "h2",    color: T.blue },
        { label: "Heading 3", icon: "H3", desc: "Small heading",     cmd: "h3",    color: T.blue },
        { label: "Paragraph", icon: "¶",  desc: "Plain text block",  cmd: "p",     color: T.muted },
      ],
    },
    {
      label: "Lists",
      items: [
        { label: "Bullet List",  icon: "•",  desc: "Unordered list",      cmd: "ul",   color: T.green },
        { label: "Ordered List", icon: "1.", desc: "Numbered list",        cmd: "ol",   color: T.green },
        { label: "Task List",    icon: "☑",  desc: "Interactive checklist",cmd: "task", color: T.green },
      ],
    },
    {
      label: "Blocks",
      items: [
        { label: "Blockquote", icon: '"',   desc: "Highlighted quote", cmd: "quote", color: T.yellow },
        { label: "Code Block", icon: "</>", desc: "Code with syntax",  cmd: "code",  color: T.cyan },
        { label: "Table",      icon: "⊞",   desc: "3×3 data table",   cmd: "table", color: T.purple },
        { label: "Divider",    icon: "—",   desc: "Horizontal rule",  cmd: "hr",    color: T.muted },
        { label: "Image",      icon: "🖼",  desc: "Embed an image",   cmd: "image", color: T.blue },
      ],
    },
  ];

  const flat = groups.flatMap(g => g.items);
  const [active, setActive] = useState(0);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === "ArrowDown")  { e.preventDefault(); setActive(a => Math.min(a + 1, flat.length - 1)); }
      if (e.key === "ArrowUp")    { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
      if (e.key === "Enter")      { e.preventDefault(); onSelect(flat[active].cmd); }
      if (e.key === "Escape")     onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, flat]);

  // Clamp position to viewport
  const menuRef = useRef(null);
  const [pos, setPos] = useState(position);
  useEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let x = position.x;
    let y = position.y;
    if (x + rect.width > vw - 8) x = vw - rect.width - 8;
    if (y + rect.height > vh - 8) y = position.y - rect.height - 8;
    setPos({ x: Math.max(8, x), y: Math.max(8, y) });
  }, []);

  let globalIdx = 0;
  return (
    <div ref={menuRef} style={{
      position: "fixed", zIndex: 9999,
      top: pos.y, left: pos.x,
      background: T.surface,
      border: `1px solid ${T.border2}`,
      borderRadius: 14, padding: 8, minWidth: 240, maxWidth: "calc(100vw - 16px)",
      boxShadow: "0 20px 60px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.03)",
      maxHeight: "60vh", overflowY: "auto",
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: T.muted, letterSpacing: 1.2,
        textTransform: "uppercase", padding: "4px 10px 8px",
        borderBottom: `1px solid ${T.border}`, marginBottom: 6 }}>
        ⌘ Insert Block
      </div>
      {groups.map((g) => (
        <div key={g.label}>
          <div style={{ fontSize: 9, fontWeight: 700, color: T.muted2, letterSpacing: 1,
            textTransform: "uppercase", padding: "6px 10px 3px" }}>{g.label}</div>
          {g.items.map((c) => {
            const idx = globalIdx++;
            const isActive = idx === active;
            return (
              <div key={c.cmd}
                onMouseEnter={() => setActive(idx)}
                onClick={() => onSelect(c.cmd)}
                style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "6px 8px", borderRadius: 8, cursor: "pointer",
                  background: isActive ? `${c.color}18` : "transparent",
                  transition: "background .1s",
                }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: isActive ? `${c.color}22` : T.border,
                  border: `1px solid ${isActive ? `${c.color}44` : "transparent"}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 800, color: isActive ? c.color : T.muted,
                  transition: "all .1s",
                }}>{c.icon}</div>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: isActive ? c.color : T.text }}>{c.label}</div>
                  <div style={{ fontSize: 10.5, color: T.muted, marginTop: 1 }}>{c.desc}</div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ─── Toolbar ──────────────────────────────────────────────────────────────────
function TGroup({ children }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 1 }}>{children}</div>;
}

function TB({ onClick, active, title, children, danger, wide, T }) {
  const [hov, setHov] = useState(false);
  return (
    <button type="button" title={title}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: wide ? "0 10px" : "0 6px",
        borderRadius: 6, cursor: "pointer",
        background: active ? T.blueBg : hov ? "rgba(127,127,127,0.08)" : "transparent",
        color: active ? T.blue : danger ? (hov ? T.red : T.muted) : (hov ? T.text : T.muted),
        fontSize: 11.5, fontWeight: 700, transition: "all .1s",
        display: "flex", alignItems: "center", justifyContent: "center",
        height: 28, minWidth: 28,
        border: active ? `1px solid ${T.blueBd}` : "1px solid transparent",
        outline: "none",
      }}
    >{children}</button>
  );
}

const VSep = ({ T }) => (
  <div style={{ width: 1, height: 16, background: T.border2, margin: "0 3px", flexShrink: 0, opacity: 0.6 }} />
);

function EditorToolbar({ editor, onImageInsert, T }) {
  if (!editor) return null;

  const setLink = () => {
    const prev = editor.getAttributes("link").href || "";
    const url = window.prompt("Enter URL (leave empty to remove):", prev || "https://");
    if (url === null) return;
    if (url === "") { editor.chain().focus().unsetLink().run(); return; }
    editor.chain().focus().setLink({ href: url, target: "_blank" }).run();
  };

  const tbProps = { T };

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", alignItems: "center",
      gap: 2, padding: "5px 10px",
      borderBottom: `1px solid ${T.border}`,
      background: T.headBg, flexShrink: 0, rowGap: 3,
      position: "sticky", top: 0, zIndex: 10,
      overflowX: "auto",
    }}>
      {/* History */}
      <TGroup>
        <TB {...tbProps} title="Undo (⌘Z)" onClick={() => editor.chain().focus().undo().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/></svg>
        </TB>
        <TB {...tbProps} title="Redo (⌘Y)" onClick={() => editor.chain().focus().redo().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/></svg>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Headings */}
      <TGroup>
        {[1, 2, 3].map(l => (
          <TB key={l} {...tbProps} title={`Heading ${l}`}
            active={editor.isActive("heading", { level: l })}
            onClick={() => editor.chain().focus().toggleHeading({ level: l }).run()}>
            <span style={{ fontSize: l === 1 ? 12 : l === 2 ? 11 : 10 }}>H{l}</span>
          </TB>
        ))}
        <TB {...tbProps} title="Paragraph" active={editor.isActive("paragraph")}
          onClick={() => editor.chain().focus().setParagraph().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M13 4v16M7 4h9a4 4 0 0 1 0 8H7V4z"/></svg>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Inline styles */}
      <TGroup>
        <TB {...tbProps} title="Bold (⌘B)" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/><path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z"/></svg>
        </TB>
        <TB {...tbProps} title="Italic (⌘I)" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="19" y1="4" x2="10" y2="4"/><line x1="14" y1="20" x2="5" y2="20"/><line x1="15" y1="4" x2="9" y2="20"/></svg>
        </TB>
        <TB {...tbProps} title="Underline (⌘U)" active={editor.isActive("underline")} onClick={() => editor.chain().focus().toggleUnderline().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M6 3v7a6 6 0 0 0 6 6 6 6 0 0 0 6-6V3"/><line x1="4" y1="21" x2="20" y2="21"/></svg>
        </TB>
        <TB {...tbProps} title="Strikethrough" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><path d="M16 6C16 6 14.5 4 12 4s-5 1.5-5 4c0 2 1.5 3 3 3.5"/><path d="M8 18c0 0 1.5 2 4 2s5-1.5 5-4c0-1.5-1-2.5-2-3"/></svg>
        </TB>
        <TB {...tbProps} title="Inline Code" active={editor.isActive("code")} onClick={() => editor.chain().focus().toggleCode().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
        </TB>
        <TB {...tbProps} title="Highlight" active={editor.isActive("highlight")} onClick={() => editor.chain().focus().toggleHighlight().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M15.232 5.232l3.536 3.536-9.192 9.192a2 2 0 0 1-.966.54l-4.243 1.061 1.06-4.243a2 2 0 0 1 .54-.966l9.265-9.12zm1.414-1.414l2.121 2.121a1 1 0 0 1 0 1.414L6.232 19.788a4 4 0 0 1-1.931 1.081L1 22l1.131-3.3a4 4 0 0 1 1.08-1.932L15.232 3.818a1 1 0 0 1 1.414 0z"/></svg>
        </TB>
        <TB {...tbProps} title="Subscript" active={editor.isActive("subscript")} onClick={() => editor.chain().focus().toggleSubscript().run()}>
          <span style={{ fontSize: 10 }}>X<sub>2</sub></span>
        </TB>
        <TB {...tbProps} title="Superscript" active={editor.isActive("superscript")} onClick={() => editor.chain().focus().toggleSuperscript().run()}>
          <span style={{ fontSize: 10 }}>X<sup>2</sup></span>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Alignment */}
      <TGroup>
        {[
          { align: "left",    icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="15" y2="12"/><line x1="3" y1="18" x2="18" y2="18"/></svg> },
          { align: "center",  icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="6" y1="12" x2="18" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg> },
          { align: "right",   icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="9" y1="12" x2="21" y2="12"/><line x1="6" y1="18" x2="21" y2="18"/></svg> },
          { align: "justify", icon: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/></svg> },
        ].map(({ align, icon }) => (
          <TB key={align} {...tbProps} title={align.charAt(0).toUpperCase() + align.slice(1)}
            active={editor.isActive({ textAlign: align })}
            onClick={() => editor.chain().focus().setTextAlign(align).run()}>
            {icon}
          </TB>
        ))}
      </TGroup>
      <VSep T={T} />

      {/* Lists */}
      <TGroup>
        <TB {...tbProps} title="Bullet List" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="9" y1="6" x2="20" y2="6"/><line x1="9" y1="12" x2="20" y2="12"/><line x1="9" y1="18" x2="20" y2="18"/><circle cx="4" cy="6" r="1" fill="currentColor"/><circle cx="4" cy="12" r="1" fill="currentColor"/><circle cx="4" cy="18" r="1" fill="currentColor"/></svg>
        </TB>
        <TB {...tbProps} title="Ordered List" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="10" y1="6" x2="21" y2="6"/><line x1="10" y1="12" x2="21" y2="12"/><line x1="10" y1="18" x2="21" y2="18"/><path d="M4 6h1v4" strokeLinecap="round"/><path d="M4 10h2" strokeLinecap="round"/><path d="M6 18H4c0-1 2-2 2-3s-1-1.5-2-1"/></svg>
        </TB>
        <TB {...tbProps} title="Task List" active={editor.isActive("taskList")} onClick={() => editor.chain().focus().toggleTaskList().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Blocks */}
      <TGroup>
        <TB {...tbProps} title="Blockquote" active={editor.isActive("blockquote")} onClick={() => editor.chain().focus().toggleBlockquote().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M3 21c3 0 7-1 7-8V5c0-1.25-.756-2.017-2-2H4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2 1 0 1 0 1 1v1c0 1-1 2-2 2s-1 .008-1 1.031V20c0 1 0 1 1 1zm12 0c3 0 7-1 7-8V5c0-1.25-.757-2.017-2-2h-4c-1.25 0-2 .75-2 1.972V11c0 1.25.75 2 2 2h.75c0 2.25.25 4-2.75 4v3c0 1 0 1 1 1z"/></svg>
        </TB>
        <TB {...tbProps} title="Code Block" active={editor.isActive("codeBlock")} onClick={() => editor.chain().focus().toggleCodeBlock().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="2" y="3" width="20" height="18" rx="3"/><line x1="2" y1="9" x2="22" y2="9"/><polyline points="8 15 11 18 8 21" transform="translate(0 -6)"/><line x1="15" y1="14" x2="17" y2="14" transform="translate(0 -1)"/></svg>
        </TB>
        <TB {...tbProps} title="Horizontal Rule" onClick={() => editor.chain().focus().setHorizontalRule().run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/><line x1="5" y1="7" x2="19" y2="7" opacity="0.4"/><line x1="5" y1="17" x2="19" y2="17" opacity="0.4"/></svg>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Table */}
      <TGroup>
        <TB {...tbProps} title="Insert Table" onClick={() => editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="21" y2="15"/><line x1="9" y1="3" x2="9" y2="21"/><line x1="15" y1="3" x2="15" y2="21"/></svg>
        </TB>
        {editor.isActive("table") && (
          <>
            <TB {...tbProps} title="Add Column After" onClick={() => editor.chain().focus().addColumnAfter().run()} wide>+col</TB>
            <TB {...tbProps} title="Add Row After" onClick={() => editor.chain().focus().addRowAfter().run()} wide>+row</TB>
            <TB {...tbProps} title="Delete Table" danger onClick={() => editor.chain().focus().deleteTable().run()}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </TB>
          </>
        )}
      </TGroup>
      <VSep T={T} />

      {/* Link & Image */}
      <TGroup>
        <TB {...tbProps} title={editor.isActive("link") ? "Edit Link" : "Add Link"} active={editor.isActive("link")} onClick={setLink}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
        </TB>
        <TB {...tbProps} title="Insert Image" onClick={onImageInsert}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </TB>
      </TGroup>
      <VSep T={T} />

      {/* Color */}
      <label title="Text Color" style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.2" strokeLinecap="round">
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
        <input type="color" title="Text color" defaultValue={T.text}
          onChange={(e) => editor.chain().focus().setColor(e.target.value).run()}
          style={{ width: 22, height: 22, border: `1px solid ${T.border2}`, borderRadius: 5,
            cursor: "pointer", background: "none", padding: 1 }} />
      </label>
    </div>
  );
}

// ─── Image Modal ──────────────────────────────────────────────────────────────
function ImageModal({ onInsert, onClose, T }) {
  const [url, setUrl] = useState("");
  const [alt, setAlt] = useState("");
  const [file, setFile] = useState(null);
  const [tab, setTab] = useState("url");
  const [preview, setPreview] = useState(null);
  const fileRef = useRef();

  const handleFileChange = (f) => {
    setFile(f);
    if (f) {
      const reader = new FileReader();
      reader.onload = (e) => setPreview(e.target.result);
      reader.readAsDataURL(f);
    }
  };

  const handleInsert = () => {
    if (tab === "url" && url.trim()) onInsert({ src: url.trim(), alt });
    else if (tab === "upload" && file) onInsert({ src: preview, alt });
  };

  const inp = {
    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 2000,
      background: "rgba(0,0,0,0.75)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: T.surface, border: `1px solid ${T.border2}`,
        borderRadius: 16, width: "100%", maxWidth: 420, padding: "20px 20px",
        boxShadow: "0 32px 96px rgba(0,0,0,0.5)",
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: T.text }}>Insert Image</div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: T.muted,
            cursor: "pointer", fontSize: 18, lineHeight: 1, padding: 4 }}>×</button>
        </div>

        <div style={{ display: "flex", gap: 4, marginBottom: 16, background: T.inputBg,
          borderRadius: 10, padding: 4, border: `1px solid ${T.border}` }}>
          {["url", "upload"].map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              flex: 1, padding: "7px", borderRadius: 7, border: "none", cursor: "pointer",
              background: tab === t ? T.blueBg : "transparent",
              color: tab === t ? T.blue : T.muted,
              fontSize: 12, fontWeight: 700, fontFamily: "inherit",
              border: tab === t ? `1px solid ${T.blueBd}` : "1px solid transparent",
              transition: "all .15s",
            }}>{t === "url" ? "🔗 From URL" : "📁 Upload"}</button>
          ))}
        </div>

        {tab === "url" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Image URL</label>
              <input value={url} onChange={e => setUrl(e.target.value)}
                placeholder="https://example.com/image.png" style={inp}
                onFocus={e => e.target.style.borderColor = T.blue}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>
            {url && (
              <div style={{ borderRadius: 10, overflow: "hidden", border: `1px solid ${T.border}`, maxHeight: 140 }}>
                <img src={url} alt="preview" style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }}
                  onError={e => e.target.style.display = "none"} />
              </div>
            )}
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted,
                letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>Alt Text</label>
              <input value={alt} onChange={e => setAlt(e.target.value)}
                placeholder="Describe the image…" style={inp}
                onFocus={e => e.target.style.borderColor = T.blue}
                onBlur={e => e.target.style.borderColor = T.border} />
            </div>
          </div>
        ) : (
          <div>
            <input ref={fileRef} type="file" accept="image/*" style={{ display: "none" }}
              onChange={e => handleFileChange(e.target.files[0])} />
            <div onClick={() => fileRef.current?.click()} style={{
              border: `2px dashed ${preview ? T.blueBd : T.border2}`,
              borderRadius: 12, padding: preview ? 0 : "32px 16px",
              textAlign: "center", cursor: "pointer",
              background: preview ? "transparent" : T.inputBg,
              overflow: "hidden", transition: "all .2s",
            }}>
              {preview ? (
                <img src={preview} style={{ width: "100%", height: 140, objectFit: "cover", display: "block" }} />
              ) : (
                <>
                  <div style={{ fontSize: 26, marginBottom: 8 }}>🖼</div>
                  <div style={{ fontSize: 13, color: T.text, fontWeight: 600, marginBottom: 4 }}>Drop image or click</div>
                  <div style={{ fontSize: 11, color: T.muted }}>PNG, JPG, GIF, WEBP</div>
                </>
              )}
            </div>
            {file && <div style={{ fontSize: 11, color: T.muted, marginTop: 8, textAlign: "center" }}>✓ {file.name}</div>}
          </div>
        )}

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "none", border: `1px solid ${T.border}`, color: T.muted,
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={handleInsert} disabled={!((tab === "url" && url.trim()) || (tab === "upload" && file))} style={{
            padding: "8px 20px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: T.blueBg, border: `1px solid ${T.blueBd}`,
            color: T.blue, cursor: "pointer", fontFamily: "inherit",
            opacity: ((tab === "url" && url.trim()) || (tab === "upload" && file)) ? 1 : 0.4,
          }}>Insert</button>
        </div>
      </div>
    </div>
  );
}

// ─── Page Editor Panel ────────────────────────────────────────────────────────
// ─── Page Editor Panel ────────────────────────────────────────────────────────
function PageEditor({ page, onClose, onSaved, T }) {
  const isNew = !page?.id;
  const [title, setTitle]     = useState(page?.title ?? "");
  const [slug, setSlug]       = useState(page?.slug ?? "");
  const [status, setStatus]   = useState(page?.publishStatus ?? "draft");
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [err, setErr]         = useState(null);
  const [loading, setLoading] = useState(!isNew);
  const [showImg, setShowImg] = useState(false);
  const [slashMenu, setSlashMenu] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  // ── NEW: mode toggle ──────────────────────────────────────────────────────
  const [mode, setMode]       = useState("editor"); // "editor" | "html"
  const [htmlContent, setHtmlContent] = useState("");
  // ─────────────────────────────────────────────────────────────────────────

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ history: true }),
      Underline, TextStyle, Color,
      Highlight.configure({ multicolor: true }),
      Subscript, Superscript, Typography,
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false, HTMLAttributes: { target: "_blank", rel: "noopener noreferrer" } }),
      Image.configure({ HTMLAttributes: { class: "tiptap-img" } }),
      Table.configure({ resizable: true }),
      TableRow, TableHeader, TableCell,
      TaskList,
      TaskItem.configure({ nested: true }),
      CharacterCount,
      Placeholder.configure({ placeholder: 'Start writing… or type "/" for commands' }),
    ],
    content: "",
    onUpdate: ({ editor }) => {
      const { from } = editor.state.selection;
      const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, "\n");
      const slashMatch = textBefore.match(/\/(\w*)$/);
      if (slashMatch) {
        const domRect = editor.view.coordsAtPos(from);
        setSlashMenu({ x: domRect.left, y: domRect.bottom + 8 });
      } else {
        setSlashMenu(null);
      }
    },
  });

  useEffect(() => {
    if (!isNew && page?.id && editor) {
      (async () => {
        try {
          const res = await fetch("/api/website/cms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "get", id: page.id }),
          });
          const json = await res.json();
          // ── NEW: restore mode and content ──────────────────────────────
          const savedMode = json.data?.mode ?? "editor";
          setMode(savedMode);
          if (savedMode === "html") {
            setHtmlContent(json.data?.content ?? "");
          } else {
            if (json.data?.content) editor.commands.setContent(json.data.content);
          }
          // ───────────────────────────────────────────────────────────────
          setTitle(json.data.title ?? "");
          setSlug(json.data.slug ?? "");
          setStatus(json.data.publishStatus ?? "draft");
        } catch {}
        finally { setLoading(false); }
      })();
    }
  }, [page?.id, editor]);

  const handleTitleChange = (v) => {
    setTitle(v);
    if (isNew) setSlug(v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""));
  };

  const execSlash = (cmd) => {
    if (!editor) return;
    const { from } = editor.state.selection;
    const textBefore = editor.state.doc.textBetween(Math.max(0, from - 30), from, "\n");
    const slashMatch = textBefore.match(/\/(\w*)$/);
    const deleteLen = slashMatch ? slashMatch[0].length : 1;
    editor.chain().focus().deleteRange({ from: from - deleteLen, to: from }).run();
    switch (cmd) {
      case "h1": editor.chain().focus().toggleHeading({ level: 1 }).run(); break;
      case "h2": editor.chain().focus().toggleHeading({ level: 2 }).run(); break;
      case "h3": editor.chain().focus().toggleHeading({ level: 3 }).run(); break;
      case "p":  editor.chain().focus().setParagraph().run(); break;
      case "ul": editor.chain().focus().toggleBulletList().run(); break;
      case "ol": editor.chain().focus().toggleOrderedList().run(); break;
      case "task": editor.chain().focus().toggleTaskList().run(); break;
      case "quote": editor.chain().focus().toggleBlockquote().run(); break;
      case "code": editor.chain().focus().toggleCodeBlock().run(); break;
      case "table": editor.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(); break;
      case "hr": editor.chain().focus().setHorizontalRule().run(); break;
      case "image": setShowImg(true); break;
    }
    setSlashMenu(null);
  };

  const handleSave = async () => {
    setSaving(true); setErr(null); setSaved(false);
    // ── NEW: pick content based on mode ──────────────────────────────────
    const content = mode === "html" ? htmlContent : (editor?.getHTML() ?? "");
    // ─────────────────────────────────────────────────────────────────────
    try {
      const res = await fetch("/api/website/cms", {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isNew
            ? { action: "create", title, slug, content, mode, publishStatus: status }
            : { id: page.id, title, slug, content, mode, publishStatus: status }
        ),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      onSaved(json.data, isNew);
    } catch (e) { setErr(e.message); }
    finally { setSaving(false); }
  };

  useEffect(() => {
    const handler = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") { e.preventDefault(); handleSave(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [title, slug, status, editor, mode, htmlContent]);

  const wordCount = editor?.storage?.characterCount?.words?.() ?? 0;
  const charCount = editor?.storage?.characterCount?.characters?.() ?? 0;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const inp = {
    width: "100%", background: T.inputBg, border: `1px solid ${T.border}`,
    borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px",
    outline: "none", fontFamily: "inherit", boxSizing: "border-box",
    transition: "border-color .15s",
  };

  const editorStyles = `
    .tiptap-wrap .ProseMirror {
      outline: none; min-height: 400px;
      padding: 20px 16px;
      font-family: 'DM Sans', sans-serif; font-size: 15px;
      line-height: 1.85; color: ${T.text};
    }
    @media (min-width: 600px) {
      .tiptap-wrap .ProseMirror { padding: 24px 28px; }
    }
    .tiptap-wrap .ProseMirror p.is-editor-empty:first-child::before {
      content: attr(data-placeholder); color: ${T.muted2};
      pointer-events: none; float: left; height: 0; font-style: italic;
    }
    .tiptap-wrap .ProseMirror > * + * { margin-top: 0.85em; }
    .tiptap-wrap .ProseMirror h1 { font-size: clamp(20px,4vw,28px); font-weight: 800; color: ${T.text}; letter-spacing: -0.5px; margin-top: 1.4em; }
    .tiptap-wrap .ProseMirror h2 { font-size: clamp(17px,3vw,22px); font-weight: 700; color: ${T.text}; margin-top: 1.2em; }
    .tiptap-wrap .ProseMirror h3 { font-size: clamp(14px,2.5vw,17px); font-weight: 700; color: ${T.text}; margin-top: 1em; }
    .tiptap-wrap .ProseMirror h1:first-child,
    .tiptap-wrap .ProseMirror h2:first-child,
    .tiptap-wrap .ProseMirror h3:first-child { margin-top: 0; }
    .tiptap-wrap .ProseMirror ul, .tiptap-wrap .ProseMirror ol { padding-left: 22px; }
    .tiptap-wrap .ProseMirror li { margin: 4px 0; }
    .tiptap-wrap .ProseMirror ul[data-type="taskList"] { list-style: none; padding-left: 2px; }
    .tiptap-wrap .ProseMirror ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; }
    .tiptap-wrap .ProseMirror ul[data-type="taskList"] li > label { margin-top: 3px; flex-shrink: 0; }
    .tiptap-wrap .ProseMirror ul[data-type="taskList"] input[type="checkbox"] { accent-color: ${T.green}; width: 14px; height: 14px; cursor: pointer; }
    .tiptap-wrap .ProseMirror blockquote {
      border-left: 3px solid ${T.green}; padding: 10px 16px;
      color: ${T.muted}; margin: 14px 0; font-style: italic;
      background: ${T.greenBg}; border-radius: 0 8px 8px 0;
    }
    .tiptap-wrap .ProseMirror code {
      background: ${T.blueBg}; border: 1px solid ${T.blueBd};
      border-radius: 5px; padding: 2px 7px; font-size: 12.5px;
      color: ${T.cyan}; font-family: 'Fira Code', 'Courier New', monospace;
    }
    .tiptap-wrap .ProseMirror pre {
      background: ${T.inputBg}; border: 1px solid ${T.border};
      border-radius: 10px; padding: 16px 18px; overflow-x: auto; margin: 14px 0;
    }
    .tiptap-wrap .ProseMirror pre code { background: none; border: none; padding: 0; font-size: 13px; color: ${T.cyan}; }
    .tiptap-wrap .ProseMirror a { color: ${T.blue}; text-decoration: underline; text-underline-offset: 2px; }
    .tiptap-wrap .ProseMirror hr { border: none; border-top: 1px solid ${T.border}; margin: 24px 0; }
    .tiptap-wrap .ProseMirror mark { background: rgba(227,179,65,0.2); color: ${T.yellow}; border-radius: 3px; padding: 0 3px; }
    .tiptap-wrap .ProseMirror img { max-width: 100%; border-radius: 8px; margin: 10px 0; border: 1px solid ${T.border}; display: block; }
    .tiptap-wrap .ProseMirror table { border-collapse: collapse; width: 100%; margin: 14px 0; display: block; overflow-x: auto; }
    .tiptap-wrap .ProseMirror td, .tiptap-wrap .ProseMirror th { border: 1px solid ${T.border2}; padding: 8px 12px; font-size: 13px; white-space: nowrap; }
    .tiptap-wrap .ProseMirror th { background: ${T.card}; font-weight: 700; color: ${T.muted}; font-size: 11px; letter-spacing: 0.5px; text-transform: uppercase; }
    .tiptap-wrap .ProseMirror .selectedCell { background: ${T.blueBg} !important; }
    .cms-inp:focus { border-color: ${T.blue} !important; box-shadow: 0 0 0 3px ${T.blueBg} !important; outline: none; }
    .cms-scrollbar::-webkit-scrollbar { width: 4px; }
    .cms-scrollbar::-webkit-scrollbar-track { background: transparent; }
    .cms-scrollbar::-webkit-scrollbar-thumb { background: ${T.border2}; border-radius: 4px; }
    @keyframes spin { to { transform: rotate(360deg); } }
    /* ── HTML editor ── */
    .html-editor-wrap textarea {
      width: 100%; height: 100%; min-height: 400px;
      background: ${T.inputBg}; color: ${T.cyan};
      border: none; outline: none; resize: none;
      font-family: 'Fira Code', 'Courier New', monospace;
      font-size: 13px; line-height: 1.75;
      padding: 24px 28px;
      tab-size: 2;
    }
    .html-editor-wrap textarea::placeholder { color: ${T.muted2}; }
  `;

  return (
    <>
      <style>{editorStyles}</style>

      {!fullscreen && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 999,
          background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)",
        }} onClick={onClose} />
      )}

      <div style={{
        position: "fixed",
        ...(fullscreen ? { inset: 0 } : {
          top: 0, right: 0, bottom: 0,
          width: "100%",
          maxWidth: fullscreen ? "100%" : "min(900px, 100vw)",
        }),
        zIndex: 1000,
        background: T.surface,
        borderLeft: fullscreen ? "none" : `1px solid ${T.border}`,
        display: "flex", flexDirection: "column",
        boxShadow: fullscreen ? "none" : "-24px 0 80px rgba(0,0,0,0.5)",
      }}>

        {/* Header */}
        <div style={{
          padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: T.headBg, flexShrink: 0, gap: 8, flexWrap: "wrap",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0, flex: 1 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: T.blueBg, border: `1px solid ${T.blueBd}`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                <polyline points="14 2 14 8 20 8"/>
                <line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/>
              </svg>
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: T.text, letterSpacing: -0.3,
                overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                {isNew ? "New Page" : (title || "Untitled")}
              </div>
              {!isNew && slug && <div style={{ fontSize: 10, color: T.muted, marginTop: 1 }}>/{slug}</div>}
            </div>
          </div>

          <div style={{ display: "flex", gap: 5, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>

            {/* ── NEW: Mode Toggle ───────────────────────────────────────────── */}
            <div style={{
              display: "flex", background: T.inputBg,
              border: `1px solid ${T.border}`, borderRadius: 8, padding: 3, gap: 2,
            }}>
              {[
                { key: "editor", label: "✏️ Editor" },
                { key: "html",   label: "</> HTML" },
              ].map(({ key, label }) => (
                <button key={key} onClick={() => setMode(key)} style={{
                  padding: "4px 10px", borderRadius: 6, border: "none", cursor: "pointer",
                  background: mode === key ? T.blueBg : "transparent",
                  color: mode === key ? T.blue : T.muted,
                  fontSize: 11, fontWeight: 700, fontFamily: "inherit",
                  border: mode === key ? `1px solid ${T.blueBd}` : "1px solid transparent",
                  transition: "all .15s",
                }}>{label}</button>
              ))}
            </div>
            {/* ──────────────────────────────────────────────────────────────── */}

            {saved && (
              <span style={{ fontSize: 11, color: T.green, display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Saved
              </span>
            )}

            <select value={status} onChange={e => setStatus(e.target.value)} style={{
              background: T.inputBg, border: `1px solid ${T.border}`, borderRadius: 7,
              color: status === "published" ? T.green : T.muted,
              fontSize: 11, fontWeight: 700, padding: "5px 8px", outline: "none",
              fontFamily: "inherit", cursor: "pointer",
            }}>
              <option value="draft">● Draft</option>
              <option value="published">● Published</option>
            </select>

            <button onClick={() => setFullscreen(f => !f)} title={fullscreen ? "Exit fullscreen" : "Fullscreen"} style={{
              width: 30, height: 30, borderRadius: 7,
              border: `1px solid ${T.border}`, background: "none",
              color: T.muted, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {fullscreen ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/>
                  <line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/>
                  <line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/>
                </svg>
              )}
            </button>

            {!isNew && (
              <button onClick={() => window.open(`/${slug}`, "_blank")} title="Preview" style={{
                width: 30, height: 30, borderRadius: 7,
                border: `1px solid ${T.border}`, background: "none",
                color: T.muted, cursor: "pointer",
                display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
                  <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                  <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </button>
            )}

            <button onClick={handleSave} disabled={saving} style={{
              padding: "7px 14px", borderRadius: 7, fontSize: 12, fontWeight: 700,
              background: T.greenBg,
              border: `1px solid ${T.greenBd}`, color: T.green,
              cursor: saving ? "default" : "pointer", fontFamily: "inherit",
              display: "flex", alignItems: "center", gap: 5,
            }}>
              {saving ? (
                <>
                  <span style={{ width: 10, height: 10, border: `2px solid ${T.greenBd}`, borderTopColor: T.green,
                    borderRadius: "50%", animation: "spin .7s linear infinite", display: "inline-block" }} />
                  Saving…
                </>
              ) : (
                <>
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/>
                  </svg>
                  Save
                </>
              )}
            </button>

            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 7, border: `1px solid ${T.border}`,
              background: "none", color: T.muted, cursor: "pointer", fontSize: 16,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>×</button>
          </div>
        </div>

        {/* Meta fields — unchanged */}
        <div style={{
          padding: "10px 14px", borderBottom: `1px solid ${T.border}`,
          display: "flex", gap: 10, flexShrink: 0, flexWrap: "wrap",
          background: T.bg,
        }}>
          <div style={{ flex: 2, minWidth: 150 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.muted,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>Page Title</label>
            <input className="cms-inp" value={title} onChange={e => handleTitleChange(e.target.value)}
              placeholder="e.g. About Us" style={inp} />
          </div>
          <div style={{ flex: 1, minWidth: 120 }}>
            <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: T.muted,
              letterSpacing: 1.2, textTransform: "uppercase", marginBottom: 5 }}>URL Slug</label>
            <div style={{ position: "relative" }}>
              <span style={{ position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
                fontSize: 13, color: T.muted2, pointerEvents: "none" }}>/</span>
              <input className="cms-inp" value={slug} onChange={e => setSlug(e.target.value)}
                placeholder="about-us" style={{ ...inp, paddingLeft: 22 }} />
            </div>
          </div>
        </div>

        {/* ── Toolbar + Editor/HTML area ── */}
        <div style={{ flex: 1, overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {loading ? (
            <div style={{ padding: 48, textAlign: "center", color: T.muted, fontSize: 13 }}>
              <div style={{ width: 24, height: 24, border: `2px solid ${T.border2}`, borderTopColor: T.blue,
                borderRadius: "50%", animation: "spin .8s linear infinite", margin: "0 auto 12px" }} />
              Loading content…
            </div>
          ) : mode === "editor" ? (
            // ── Rich text editor (unchanged) ──────────────────────────────
            <div className="tiptap-wrap" style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
              <EditorToolbar editor={editor} onImageInsert={() => setShowImg(true)} T={T} />
              <div className="cms-scrollbar" style={{ flex: 1, overflowY: "auto", background: T.surface }}>
                <EditorContent editor={editor} />
              </div>
            </div>
          ) : (
            // ── NEW: HTML / CSS editor ─────────────────────────────────────
            <div className="html-editor-wrap cms-scrollbar" style={{
              flex: 1, overflow: "hidden", display: "flex", flexDirection: "column",
              background: T.inputBg,
            }}>
              {/* hint bar */}
              <div style={{
                padding: "6px 14px", borderBottom: `1px solid ${T.border}`,
                background: T.headBg, flexShrink: 0,
                display: "flex", alignItems: "center", gap: 8,
              }}>
                <span style={{ fontSize: 10, color: T.muted }}>
                  Write the full <code style={{ color: T.cyan, fontSize: 10 }}>&lt;body&gt;</code> content with inline CSS.
                  The saved HTML is served as-is inside the page wrapper.
                </span>
              </div>
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                spellCheck={false}
                placeholder={`<section style="padding:40px;font-family:sans-serif;">\n  <h1 style="color:#1e293b;">Hello World</h1>\n  <p style="color:#64748b;">Your content here…</p>\n</section>`}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{
          padding: "6px 14px", borderTop: `1px solid ${T.border}`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          flexShrink: 0, background: T.headBg, flexWrap: "wrap", gap: 6,
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {err ? (
              <div style={{ fontSize: 11, color: T.red, display: "flex", alignItems: "center", gap: 5 }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                </svg>
                {err}
              </div>
            ) : mode === "editor" ? (
              <>
                <span style={{ fontSize: 11, color: T.muted2 }}>{wordCount} words</span>
                <span style={{ fontSize: 11, color: T.muted2 }}>{charCount} chars</span>
                <span style={{ fontSize: 11, color: T.muted2 }}>{readingTime} min read</span>
              </>
            ) : (
              // ── NEW: HTML mode footer stats ──────────────────────────────
              <span style={{ fontSize: 11, color: T.muted2 }}>
                {htmlContent.length} chars · HTML/CSS mode
              </span>
            )}
          </div>
          <div style={{ fontSize: 10, color: T.muted2, display: "flex", alignItems: "center", gap: 4 }}>
            <kbd style={{
              background: T.border, border: `1px solid ${T.border2}`,
              borderRadius: 4, padding: "1px 5px", fontSize: 9, color: T.muted,
            }}>⌘S</kbd>
            save
            {mode === "editor" && (
              <> ·
                <kbd style={{
                  background: T.border, border: `1px solid ${T.border2}`,
                  borderRadius: 4, padding: "1px 5px", fontSize: 9, color: T.muted,
                }}>/</kbd>
                commands
              </>
            )}
          </div>
        </div>
      </div>

      {slashMenu && mode === "editor" && (
        <SlashMenu position={slashMenu} onSelect={execSlash} onClose={() => setSlashMenu(null)} T={T} />
      )}
      {showImg && (
        <ImageModal
          T={T}
          onInsert={({ src, alt }) => { editor?.chain().focus().setImage({ src, alt }).run(); setShowImg(false); }}
          onClose={() => setShowImg(false)}
        />
      )}
    </>
  );
}

// ─── Delete Confirm ───────────────────────────────────────────────────────────
function DeleteConfirm({ page, onClose, onDeleted, T }) {
  const [deleting, setDeleting] = useState(false);
  const [confirmed, setConfirmed] = useState("");

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/website/cms", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: page.id }),
      });
      if (!res.ok) throw new Error();
      onDeleted(page.id);
    } catch { setDeleting(false); }
  };

  const canDelete = confirmed === page.title;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 1100,
      background: "rgba(0,0,0,0.8)", backdropFilter: "blur(6px)",
      display: "flex", alignItems: "center", justifyContent: "center", padding: 16,
    }} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: T.surface, border: `1px solid ${T.redBd}`,
        borderRadius: 16, width: "100%", maxWidth: 380, padding: "22px 20px",
        boxShadow: "0 32px 96px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12, background: T.redBg,
          border: `1px solid ${T.redBd}`, display: "flex", alignItems: "center",
          justifyContent: "center", fontSize: 20, marginBottom: 14,
        }}>🗑️</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 8 }}>Delete Page</div>
        <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65, marginBottom: 16 }}>
          This will permanently delete <strong style={{ color: T.text }}>"{page.title}"</strong> and all its content. This cannot be undone.
        </div>
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: T.muted,
            letterSpacing: 1, textTransform: "uppercase", marginBottom: 6 }}>
            Type page title to confirm
          </label>
          <input value={confirmed} onChange={e => setConfirmed(e.target.value)}
            placeholder={page.title}
            style={{
              width: "100%", background: T.inputBg,
              border: `1px solid ${canDelete ? T.redBd : T.border}`,
              borderRadius: 8, color: T.text, fontSize: 13, padding: "9px 12px",
              outline: "none", fontFamily: "inherit", boxSizing: "border-box",
            }} />
        </div>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={onClose} style={{
            padding: "8px 16px", borderRadius: 8, fontSize: 13, fontWeight: 600,
            background: "none", border: `1px solid ${T.border}`, color: T.muted,
            cursor: "pointer", fontFamily: "inherit",
          }}>Cancel</button>
          <button onClick={handleDelete} disabled={!canDelete || deleting} style={{
            padding: "8px 18px", borderRadius: 8, fontSize: 13, fontWeight: 700,
            background: canDelete ? T.redBg : "transparent",
            border: `1px solid ${canDelete ? T.redBd : T.border}`,
            color: canDelete ? T.red : T.muted,
            cursor: (canDelete && !deleting) ? "pointer" : "default",
            fontFamily: "inherit", transition: "all .2s",
          }}>{deleting ? "Deleting…" : "Delete Forever"}</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main CMS Component ───────────────────────────────────────────────────────
export default function PagesCMS({ dark = true }) {
  const T = buildTheme(dark);

  const [pages, setPages]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [editPage, setEditPage]   = useState(null);
  const [deletePage, setDeletePage] = useState(null);
  const [search, setSearch]       = useState("");

  const fetchPages = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch("/api/website/cms");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setPages(json.data ?? []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchPages(); }, [fetchPages]);

  const handleSaved = (saved, isNew) => {
    setPages(prev => isNew ? [saved, ...prev] : prev.map(p => p.id === saved.id ? { ...p, ...saved } : p));
    setEditPage(null);
  };

  const filtered = pages.filter(p =>
    !search || p.title.toLowerCase().includes(search.toLowerCase()) || p.slug.includes(search.toLowerCase())
  );

  const published = pages.filter(p => p.publishStatus === "published").length;
  const drafts    = pages.filter(p => p.publishStatus === "draft").length;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing: border-box; }
        .cms-row { transition: background .12s; }
        .cms-row:hover { background: ${T.rowHover} !important; }
        @keyframes cms-pulse { from { opacity:.3; } to { opacity:.7; } }
        @keyframes spin { to { transform: rotate(360deg); } }
        /* Page list responsive */
        .cms-page-row {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          padding: 12px 14px;
          flex-wrap: wrap;
          gap: 10px;
        }
        @media (min-width: 540px) {
          .cms-page-row { align-items: center; flex-wrap: nowrap; padding: 13px 18px; }
        }
        .cms-page-meta {
          display: flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
          width: 100%;
        }
        @media (min-width: 540px) {
          .cms-page-meta { flex-wrap: nowrap; width: auto; }
        }
        /* Hide date on very small screens */
        .cms-date { display: none; }
        @media (min-width: 400px) { .cms-date { display: inline; } }
      `}</style>

      <div style={{ padding: "16px 14px 48px", fontFamily: "'DM Sans', sans-serif", minHeight: "100%", background: T.bg }}>
        <style>{`@media (min-width: 640px) { .cms-outer-pad { padding: 28px 28px 48px !important; } }`}</style>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 24, gap: 12, flexWrap: "wrap" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <div style={{
                width: 34, height: 34, borderRadius: 9,
                background: T.greenBg, border: `1px solid ${T.greenBd}`,
                display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={T.green} strokeWidth="2" strokeLinecap="round">
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                  <polyline points="14 2 14 8 20 8"/>
                  <line x1="16" y1="13" x2="8" y2="13"/>
                  <line x1="16" y1="17" x2="8" y2="17"/>
                </svg>
              </div>
              <h1 style={{ margin: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>
                Pages & CMS
              </h1>
            </div>
            {!loading && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 44, flexWrap: "wrap" }}>
                <span style={{ fontSize: 11, color: T.muted }}>{pages.length} total</span>
                {published > 0 && <><span style={{ fontSize: 11, color: T.muted2 }}>·</span><span style={{ fontSize: 11, color: T.green }}>{published} published</span></>}
                {drafts > 0 && <><span style={{ fontSize: 11, color: T.muted2 }}>·</span><span style={{ fontSize: 11, color: T.muted }}>{drafts} draft{drafts > 1 ? "s" : ""}</span></>}
              </div>
            )}
          </div>

          <button onClick={() => setEditPage(false)} style={{
            display: "flex", alignItems: "center", gap: 6,
            padding: "8px 16px", borderRadius: 9, fontSize: 13, fontWeight: 700,
            background: "linear-gradient(135deg, #22c55e, #16a34a)",
            border: "none", color: "#fff", cursor: "pointer",
            boxShadow: "0 4px 16px rgba(34,197,94,0.3)",
            fontFamily: "inherit", flexShrink: 0,
          }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
            New Page
          </button>
        </div>

        {/* Search */}
        {!loading && pages.length > 3 && (
          <div style={{ marginBottom: 14 }}>
            <div style={{
              display: "flex", alignItems: "center", gap: 8,
              background: T.surface, border: `1px solid ${T.border}`,
              borderRadius: 9, padding: "8px 12px", maxWidth: 300,
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={T.muted} strokeWidth="2.2" strokeLinecap="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input value={search} onChange={e => setSearch(e.target.value)}
                placeholder="Search pages…"
                style={{ background: "none", border: "none", outline: "none", color: T.text,
                  fontSize: 13, fontFamily: "inherit", flex: 1 }} />
              {search && <button onClick={() => setSearch("")} style={{
                background: "none", border: "none", color: T.muted, cursor: "pointer", fontSize: 14, lineHeight: 1,
              }}>×</button>}
            </div>
          </div>
        )}

        {/* List */}
        <div style={{ background: T.surface, border: `1px solid ${T.border}`, borderRadius: 12, overflow: "hidden" }}>

          {/* Column headers */}
          {!loading && filtered.length > 0 && (
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "8px 14px", borderBottom: `1px solid ${T.border}`,
              background: T.headBg,
            }}>
              <span style={{ fontSize: 9, fontWeight: 700, color: T.muted2, letterSpacing: 1, textTransform: "uppercase" }}>Page</span>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <span className="cms-date" style={{ fontSize: 9, fontWeight: 700, color: T.muted2, letterSpacing: 1, textTransform: "uppercase" }}>Updated</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.muted2, letterSpacing: 1, textTransform: "uppercase" }}>Status</span>
                <span style={{ fontSize: 9, fontWeight: 700, color: T.muted2, letterSpacing: 1, textTransform: "uppercase" }}>Actions</span>
              </div>
            </div>
          )}

          {/* Skeletons */}
          {loading && Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "14px 14px", borderBottom: `1px solid ${T.border}`,
              animation: "cms-pulse 1.5s ease-in-out infinite alternate",
              animationDelay: `${i * 100}ms`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 30, height: 30, borderRadius: 8, background: T.skeleton, flexShrink: 0 }} />
                <div>
                  <div style={{ width: 120 + i * 20, height: 11, borderRadius: 4, background: T.skeleton, marginBottom: 6 }} />
                  <div style={{ width: 70, height: 9, borderRadius: 4, background: T.border2 }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                <div style={{ width: 56, height: 18, borderRadius: 100, background: T.skeleton }} />
                <div style={{ width: 80, height: 26, borderRadius: 7, background: T.skeleton }} />
              </div>
            </div>
          ))}

          {/* Error */}
          {!loading && error && (
            <div style={{ padding: 48, textAlign: "center" }}>
              <div style={{ fontSize: 22, marginBottom: 10 }}>⚠️</div>
              <div style={{ fontSize: 13, color: T.red, marginBottom: 14 }}>{error}</div>
              <button onClick={fetchPages} style={{
                padding: "7px 16px", borderRadius: 8, fontSize: 12, fontWeight: 600,
                background: T.redBg, border: `1px solid ${T.redBd}`, color: T.red,
                cursor: "pointer", fontFamily: "inherit",
              }}>Try Again</button>
            </div>
          )}

          {/* Empty */}
          {!loading && !error && pages.length === 0 && (
            <div style={{ padding: 56, textAlign: "center" }}>
              <div style={{
                width: 52, height: 52, borderRadius: 14, background: T.greenBg,
                border: `1px solid ${T.greenBd}`, display: "flex", alignItems: "center",
                justifyContent: "center", margin: "0 auto 14px", fontSize: 22,
              }}>📝</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: T.text, marginBottom: 6 }}>No pages yet</div>
              <div style={{ fontSize: 13, color: T.muted, marginBottom: 18 }}>Create your first page to get started</div>
              <button onClick={() => setEditPage(false)} style={{
                padding: "9px 18px", borderRadius: 9, fontSize: 13, fontWeight: 700,
                background: T.greenBg, border: `1px solid ${T.greenBd}`,
                color: T.green, cursor: "pointer", fontFamily: "inherit",
              }}>+ Create First Page</button>
            </div>
          )}

          {/* No results */}
          {!loading && !error && pages.length > 0 && filtered.length === 0 && (
            <div style={{ padding: 36, textAlign: "center", color: T.muted, fontSize: 13 }}>
              No pages match "<strong style={{ color: T.text }}>{search}</strong>"
            </div>
          )}

          {/* Rows */}
          {!loading && !error && filtered.map((page, idx) => (
            <div key={page.id} className="cms-row cms-page-row" style={{
              borderBottom: idx < filtered.length - 1 ? `1px solid ${T.border}` : "none",
              background: "transparent",
            }}>
              {/* Left — icon + title */}
              <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flex: 1 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                  background: T.blueBg, border: `1px solid ${T.blueBd}20`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={T.blue} strokeWidth="2" strokeLinecap="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                  </svg>
                </div>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: T.text,
                    overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {page.title}
                  </div>
                  <div style={{ fontSize: 10, color: T.muted, marginTop: 1, fontFamily: "monospace" }}>/{page.slug}</div>
                </div>
              </div>

              {/* Right */}
              <div className="cms-page-meta">
                <span className="cms-date" style={{ fontSize: 11, color: T.muted2 }}>
                  {new Date(page.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                </span>
                <StatusBadge status={page.publishStatus} T={T} />
                <div style={{ display: "flex", gap: 2, marginLeft: "auto" }}>
                  {[
                    {
                      title: "Edit", onClick: () => setEditPage(page), hoverColor: T.blue, hoverBg: T.blueBg,
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
                    },
                    {
                      title: "Preview", onClick: () => window.open(`/${page.slug}`, "_blank"), hoverColor: T.green, hoverBg: T.greenBg,
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
                    },
                    {
                      title: "Delete", onClick: () => setDeletePage(page), hoverColor: T.red, hoverBg: T.redBg,
                      icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>,
                    },
                  ].map(btn => (
                    <button key={btn.title} title={btn.title} onClick={btn.onClick} style={{
                      width: 30, height: 30, borderRadius: 7, border: "none",
                      background: "none", cursor: "pointer", color: T.muted,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      transition: "all .12s",
                    }}
                      onMouseEnter={e => { e.currentTarget.style.background = btn.hoverBg; e.currentTarget.style.color = btn.hoverColor; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "none"; e.currentTarget.style.color = T.muted; }}>
                      {btn.icon}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {editPage !== null && (
        <PageEditor page={editPage || null} onClose={() => setEditPage(null)} onSaved={handleSaved} T={T} />
      )}
      {deletePage && (
        <DeleteConfirm page={deletePage} onClose={() => setDeletePage(null)} T={T}
          onDeleted={id => { setPages(p => p.filter(x => x.id !== id)); setDeletePage(null); }} />
      )}
    </>
  );
}