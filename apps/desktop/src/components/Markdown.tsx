import {
  Fragment,
  isValidElement,
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type CSSProperties,
  type ComponentProps,
  type ReactNode,
} from "react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import { lexer } from "marked";
import { useTranslation } from "react-i18next";
import type { ThemedToken } from "shiki";
import "katex/dist/katex.min.css";
import { IconCheck, IconCopy } from "./icons";
import {
  ensureLang,
  getHighlightVersion,
  resolveLang,
  subscribeHighlighter,
  themeForMode,
  tokenizeIncremental,
  type LineCache,
  type ThemeMode,
} from "../lib/shiki";

/*
 * Streaming-optimized chat markdown renderer.
 *
 * The source is split into top-level markdown blocks with marked's lexer and
 * each block renders through a memoized <ReactMarkdown>. While streaming only
 * the tail block's raw text changes, so every settled block skips re-parsing
 * entirely — total work stays linear in message length instead of quadratic.
 */

export function useCopy() {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copy = useCallback((text: string) => {
    void navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => setCopied(false), 1500);
    });
  }, []);
  return { copied, copy };
}

/* ---------- theme (follows documentElement[data-theme]) ---------- */

const themeListeners = new Set<() => void>();
let themeObserver: MutationObserver | null = null;

function subscribeTheme(listener: () => void): () => void {
  if (!themeObserver) {
    themeObserver = new MutationObserver(() => {
      for (const cb of themeListeners) cb();
    });
    themeObserver.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });
  }
  themeListeners.add(listener);
  return () => {
    themeListeners.delete(listener);
  };
}

function getThemeSnapshot(): ThemeMode {
  return document.documentElement.dataset.theme === "light" ? "light" : "dark";
}

function useThemeMode(): ThemeMode {
  return useSyncExternalStore(subscribeTheme, getThemeSnapshot);
}

/* ---------- syntax highlighting ---------- */

function tokenStyle(token: ThemedToken): CSSProperties | undefined {
  const fontStyle = token.fontStyle ?? 0;
  if (!token.color && !fontStyle) return undefined;
  const style: CSSProperties = {};
  if (token.color) style.color = token.color;
  if (fontStyle & 1) style.fontStyle = "italic";
  if (fontStyle & 2) style.fontWeight = "bold";
  if (fontStyle & 4) style.textDecoration = "underline";
  return style;
}

/* Rows are cached by reference in the line cache, so settled lines memo-skip. */
const TokenLine = memo(function TokenLine({ line }: { line: ThemedToken[] }) {
  return (
    <>
      {line.map((token, i) => (
        <span key={i} style={tokenStyle(token)}>
          {token.content}
        </span>
      ))}
    </>
  );
});

function useHighlightedTokens(
  code: string,
  lang: string,
): ThemedToken[][] | null {
  const resolved = resolveLang(lang);
  const mode = useThemeMode();
  const version = useSyncExternalStore(subscribeHighlighter, getHighlightVersion);
  useEffect(() => {
    if (resolved) ensureLang(resolved);
  }, [resolved]);
  const cacheRef = useRef<LineCache | null>(null);
  return useMemo(() => {
    if (!resolved) return null;
    const next = tokenizeIncremental(
      cacheRef.current,
      code,
      resolved,
      themeForMode(mode),
    );
    cacheRef.current = next;
    return next?.tokens ?? null;
    // `version` re-runs this once the language finishes lazy-loading.
  }, [code, resolved, mode, version]);
}

function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const { t } = useTranslation();
  const { copied, copy } = useCopy();
  const tokens = useHighlightedTokens(code, lang);
  return (
    <div className="code-block">
      <div className="code-block-head">
        <span className="code-block-lang">{lang || "text"}</span>
        <button
          className={`code-copy-btn ${copied ? "copied" : ""}`}
          aria-label={t("chat.copy")}
          title={copied ? t("chat.copied") : t("chat.copy")}
          onClick={() => copy(code)}
        >
          {copied ? <IconCheck size={13} /> : <IconCopy size={13} />}
        </button>
      </div>
      <pre>
        <code>
          {tokens
            ? tokens.map((line, i) => (
                <Fragment key={i}>
                  {i > 0 ? "\n" : null}
                  <TokenLine line={line} />
                </Fragment>
              ))
            : code}
        </code>
      </pre>
    </div>
  );
}

/* ---------- react-markdown component overrides ---------- */

function extractCode(children: ReactNode): { code: string; lang: string } | null {
  const element = Array.isArray(children)
    ? children.find((child) => isValidElement(child))
    : children;
  if (!isValidElement(element)) return null;
  const props = element.props as { className?: unknown; children?: unknown };
  const className = typeof props.className === "string" ? props.className : "";
  const lang = /language-(\S+)/.exec(className)?.[1] ?? "";
  const raw = props.children;
  const code =
    typeof raw === "string"
      ? raw
      : Array.isArray(raw) && raw.every((part) => typeof part === "string")
        ? raw.join("")
        : null;
  if (code === null) return null;
  return { code: code.replace(/\n$/, ""), lang };
}

function PreBlock({
  node: _node,
  children,
  ...rest
}: ComponentProps<"pre"> & { node?: unknown }) {
  const info = extractCode(children);
  if (!info) return <pre {...rest}>{children}</pre>;
  return <CodeBlock code={info.code} lang={info.lang} />;
}

function Anchor({
  node: _node,
  children,
  ...rest
}: ComponentProps<"a"> & { node?: unknown }) {
  // Main process routes _blank through shell.openExternal and blocks
  // in-window navigation, so external links must open a new "window".
  return (
    <a {...rest} target="_blank" rel="noopener noreferrer">
      {children}
    </a>
  );
}

function Table({
  node: _node,
  children,
  ...rest
}: ComponentProps<"table"> & { node?: unknown }) {
  return (
    <div className="table-wrap">
      <table {...rest}>{children}</table>
    </div>
  );
}

const markdownComponents: Components = {
  pre: PreBlock,
  a: Anchor,
  table: Table,
};

const remarkPlugins = [remarkGfm, remarkMath];
const rehypePlugins = [rehypeKatex];

/* ---------- block splitting ---------- */

function parseBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const token of lexer(source)) {
    const raw = token.raw;
    if (!raw) continue;
    // Fold blank-line runs into the previous block so joining blocks
    // reconstructs the source and block boundaries stay append-stable.
    if (token.type === "space" && blocks.length > 0) {
      blocks[blocks.length - 1] += raw;
    } else {
      blocks.push(raw);
    }
  }
  return blocks;
}

/*
 * Incremental re-lex: while streaming appends text, all blocks before the
 * last are settled (markdown blocks never merge backwards across a completed
 * boundary), so only the tail block is re-lexed each frame.
 */
function useBlocks(source: string): string[] {
  const cacheRef = useRef({ consumed: "", blocks: [] as string[] });
  return useMemo(() => {
    const cache = cacheRef.current;
    let stable: string[] = [];
    let tail = source;
    if (
      cache.blocks.length > 0 &&
      source.length >= cache.consumed.length &&
      source.startsWith(cache.consumed)
    ) {
      stable = cache.blocks.slice(0, -1);
      const lastStart =
        cache.consumed.length - cache.blocks[cache.blocks.length - 1].length;
      tail = source.slice(lastStart);
    }
    const blocks = tail ? [...stable, ...parseBlocks(tail)] : stable;
    cacheRef.current = { consumed: source, blocks };
    return blocks;
  }, [source]);
}

const Block = memo(function MarkdownBlock({ raw }: { raw: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={remarkPlugins}
      rehypePlugins={rehypePlugins}
      components={markdownComponents}
    >
      {raw}
    </ReactMarkdown>
  );
});

export const Markdown = memo(function Markdown({ source }: { source: string }) {
  const blocks = useBlocks(source);
  return (
    <>
      {blocks.map((raw, i) => (
        <Block key={i} raw={raw} />
      ))}
    </>
  );
});
