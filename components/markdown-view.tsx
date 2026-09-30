'use client';
/**
 * components/markdown-view.tsx
 *
 * Renders proposal body markdown in the Govenr design language — serif
 * headings, mono code, honest external links — with media support:
 *
 *   images        → lazy, rounded, never wider than the column
 *   YouTube/Vimeo → inline embeds (privacy-friendly youtube-nocookie)
 *   direct video  → playable <video> element
 *
 * Safety: react-markdown does not render raw HTML (no rehype-raw), and
 * its default URL transform filters javascript:/data: schemes. This is
 * the whole reason raw HTML stays off — the proposal text stays text.
 *
 * Client component.
 */

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { ReactNode } from 'react';

type AnchorProps = { href?: string; children?: ReactNode };

type VideoEmbed =
  | { kind: 'youtube' | 'vimeo' | 'file'; src: string }
  | null;

/**
 * A bad video ID must never reach the iframe — YouTube renders its
 * "Video player configuration error · Error 153" screen for junk IDs
 * (trailing slashes, pasted parens, tracking fragments riding along).
 * Anything that doesn't validate falls back to a plain link instead.
 */
function youtubeEmbed(id: string): VideoEmbed {
  const clean = (id.split('/')[0] ?? '').split('?')[0].split('#')[0];
  // YouTube IDs are url-safe base64, ~11 characters.
  if (!/^[\w-]{6,15}$/.test(clean)) return null;
  return { kind: 'youtube', src: `https://www.youtube-nocookie.com/embed/${clean}` };
}

function videoEmbed(href: string): VideoEmbed {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, '').toLowerCase();
    const isYouTubeSite =
      host === 'youtube.com' ||
      host === 'youtube-nocookie.com' ||
      host === 'youtu.be' ||
      host.endsWith('.youtube.com') ||
      host.endsWith('.youtube-nocookie.com');
    if (isYouTubeSite) {
      if (host === 'youtu.be') {
        return youtubeEmbed(url.pathname.split('/')[1] ?? '');
      }
      const v = url.searchParams.get('v');
      if (v) return youtubeEmbed(v);
      const m = url.pathname.match(/^\/(?:shorts|embed|live|v)\/([\w-]+)/);
      if (m) return youtubeEmbed(m[1]);
      return null;
    }
    if (host === 'vimeo.com' || host === 'player.vimeo.com') {
      const id = url.pathname.replace(/^\//, '').split('/')[0];
      if (/^\d+$/.test(id)) {
        return { kind: 'vimeo', src: `https://player.vimeo.com/video/${id}` };
      }
    }
    if (/\.(mp4|webm)$/i.test(url.pathname)) {
      return { kind: 'file', src: href };
    }
  } catch {
    // not a parseable URL — fall through to a plain link
  }
  return null;
}

const mono = 'font-mono text-xs';

export default function MarkdownView({ body }: { body: string }) {
  return (
    <div className="markdown-view text-sm leading-relaxed" style={{ color: 'var(--text)' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h2
              className="font-serif text-3xl leading-tight mt-7 mb-2"
              style={{ color: 'var(--text)' }}
            >
              {children}
            </h2>
          ),
          h2: ({ children }) => (
            <h3
              className="font-serif text-2xl leading-tight mt-6 mb-2"
              style={{ color: 'var(--text)' }}
            >
              {children}
            </h3>
          ),
          h3: ({ children }) => (
            <h4
              className="font-serif text-xl leading-tight mt-5 mb-1"
              style={{ color: 'var(--text)' }}
            >
              {children}
            </h4>
          ),
          p: ({ children }) => <p className="my-3 leading-relaxed">{children}</p>,
          a: ({ href, children }: AnchorProps) => {
            if (!href) return <>{children}</>;
            const video = videoEmbed(href);
            if (video && video.kind !== 'file') {
              return (
                <span className="block my-4">
                  <span
                    className="block aspect-video w-full rounded-lg overflow-hidden border"
                    style={{ borderColor: 'var(--border)' }}
                  >
                    <iframe
                      src={video.src}
                      title="Embedded video"
                      className="w-full h-full"
                      allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; web-share; clipboard-write"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                    />
                  </span>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[10px] underline underline-offset-2"
                    style={{ color: 'var(--text-dim)' }}
                  >
                    {video.kind === 'youtube'
                      ? 'video · open on YouTube ↗'
                      : 'video · open on Vimeo ↗'}
                  </a>
                </span>
              );
            }
            if (video && video.kind === 'file') {
              return (
                <video
                  src={video.src}
                  controls
                  className="my-4 w-full rounded-lg border"
                  style={{ borderColor: 'var(--border)' }}
                />
              );
            }
            return (
              <a
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="underline underline-offset-2"
                style={{ color: 'var(--l1)' }}
              >
                {children}
              </a>
            );
          },
          img: ({ src, alt }) =>
            src ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={typeof src === 'string' ? src : undefined}
                alt={alt ?? ''}
                loading="lazy"
                className="my-4 max-w-full rounded-lg border"
                style={{ borderColor: 'var(--border)' }}
              />
            ) : null,
          ul: ({ children }) => (
            <ul className="list-disc pl-5 my-3 space-y-1">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="list-decimal pl-5 my-3 space-y-1">{children}</ol>
          ),
          blockquote: ({ children }) => (
            <blockquote
              className="my-4 pl-4 py-1 font-serif italic"
              style={{
                borderLeft: `3px solid var(--gold)`,
                color: 'var(--text-dim)',
              }}
            >
              {children}
            </blockquote>
          ),
          code: ({ children }) => (
            <code
              className={`${mono} rounded px-1.5 py-0.5`}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              {children}
            </code>
          ),
          pre: ({ children }) => (
            <pre
              className={`${mono} my-4 p-3 rounded-lg overflow-x-auto`}
              style={{
                backgroundColor: 'var(--surface)',
                border: '1px solid var(--border)',
              }}
            >
              {children}
            </pre>
          ),
          table: ({ children }) => (
            <table
              className={`${mono} my-4 w-full border-collapse`}
              style={{ color: 'var(--text)' }}
            >
              {children}
            </table>
          ),
          th: ({ children }) => (
            <th
              className="text-left px-2 py-1.5"
              style={{
                borderBottom: '2px solid var(--border-strong, var(--border))',
              }}
            >
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td
              className="px-2 py-1.5"
              style={{ borderTop: '1px solid var(--border)' }}
            >
              {children}
            </td>
          ),
          hr: () => (
            <hr className="my-6" style={{ borderColor: 'var(--border)' }} />
          ),
        }}
      >
        {body}
      </ReactMarkdown>
    </div>
  );
}
