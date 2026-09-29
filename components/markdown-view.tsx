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
import { useState, type KeyboardEvent, type ReactNode } from 'react';

type AnchorProps = { href?: string; children?: ReactNode };

type VideoEmbed =
  | { kind: 'youtube' | 'vimeo' | 'file'; src: string }
  | null;

function videoEmbed(href: string): VideoEmbed {
  try {
    const url = new URL(href);
    const host = url.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v) {
        return {
          kind: 'youtube',
          src: `https://www.youtube-nocookie.com/embed/${v}`,
        };
      }
      const shorts = url.pathname.match(/^\/shorts\/([\w-]+)/);
      if (shorts) {
        return {
          kind: 'youtube',
          src: `https://www.youtube-nocookie.com/embed/${shorts[1]}`,
        };
      }
      const embed = url.pathname.match(/^\/embed\/([\w-]+)/);
      if (embed) {
        return {
          kind: 'youtube',
          src: `https://www.youtube-nocookie.com/embed/${embed[1]}`,
        };
      }
    }
    if (host === 'youtu.be') {
      const id = url.pathname.slice(1);
      if (id) {
        return {
          kind: 'youtube',
          src: `https://www.youtube-nocookie.com/embed/${id}`,
        };
      }
    }
    if (host === 'vimeo.com') {
      const id = url.pathname.replace(/^\//, '');
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

// ---------------------------------------------------------------------------
// Image carousel — 2+ consecutive images in one paragraph become a gallery
// (the v2 wireframe's "event photos" block). Captions come from alt text.
// ---------------------------------------------------------------------------

type CarouselImage = { src: string; alt?: string };

type HastNode = {
  type?: string;
  tagName?: string;
  properties?: Record<string, unknown>;
  children?: HastNode[];
};

function ImageCarousel({ images }: { images: CarouselImage[] }) {
  const [index, setIndex] = useState(0);
  const current = images[index] ?? images[0];
  if (!current) return null;

  const go = (dir: number) =>
    setIndex((i) => (i + dir + images.length) % images.length);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'ArrowLeft') go(-1);
    if (e.key === 'ArrowRight') go(1);
  };

  return (
    <figure className="my-5">
      <div
        role="region"
        aria-roledescription="carousel"
        aria-label="Proposal images"
        tabIndex={0}
        onKeyDown={onKeyDown}
        className="relative rounded-lg overflow-hidden border focus-visible:outline-none focus-visible:ring-2"
        style={{ borderColor: 'var(--border)', backgroundColor: '#16304f' }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={current.src}
          alt={current.alt ?? ''}
          className="w-full max-h-[480px] object-contain select-none"
        />
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous image"
              className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full w-9 h-9 flex items-center justify-center text-lg"
              style={{
                backgroundColor: 'rgba(22, 48, 79, 0.85)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next image"
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full w-9 h-9 flex items-center justify-center text-lg"
              style={{
                backgroundColor: 'rgba(22, 48, 79, 0.85)',
                color: '#ffffff',
                border: '1px solid rgba(255,255,255,0.25)',
              }}
            >
              ›
            </button>
            <span
              className={`absolute bottom-2 right-2 rounded px-2 py-0.5 ${mono}`}
              style={{ backgroundColor: 'rgba(22, 48, 79, 0.85)', color: '#ffffff' }}
            >
              {index + 1} / {images.length}
            </span>
          </>
        )}
      </div>
      {current.alt && (
        <figcaption
          className={`pt-1.5 text-center ${mono}`}
          style={{ color: 'var(--text-dim)' }}
        >
          {current.alt}
        </figcaption>
      )}
      {images.length > 1 && (
        <div className="flex flex-wrap justify-center gap-2 pt-2">
          {images.map((img, i) => (
            <button
              key={`${img.src}-${i}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index}
              className="rounded overflow-hidden focus-visible:outline-none focus-visible:ring-2"
              style={{
                border:
                  i === index
                    ? '2px solid var(--gold)'
                    : '1px solid var(--border)',
                padding: 0,
                lineHeight: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.src}
                alt=""
                className="h-10 w-14 object-cover"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </figure>
  );
}

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
          p: ({ node, children }) => {
            // A paragraph that is nothing but images is a gallery.
            const elements = (node?.children ?? []).filter(
              (c) => (c as HastNode).type === 'element',
            ) as HastNode[];
            if (
              elements.length >= 2 &&
              elements.every((c) => c.tagName === 'img')
            ) {
              const images: CarouselImage[] = elements.map((c) => ({
                src: String(c.properties?.src ?? ''),
                alt:
                  typeof c.properties?.alt === 'string'
                    ? c.properties.alt
                    : undefined,
              }));
              const usable = images.filter((img) => img.src);
              if (usable.length >= 2) {
                return <ImageCarousel images={usable} />;
              }
            }
            return <p className="my-3 leading-relaxed">{children}</p>;
          },
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
                      allowFullScreen
                    />
                  </span>
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
