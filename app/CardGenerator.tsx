"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CARD_H, CARD_W, type CardData, clampPhoto, drawCard, isOverPhoto } from "@/lib/card";
import type { EventInfo } from "@/lib/events";
// Imported so the URL is content-hashed: a rebuilt background is never served stale from cache.
import cardBackground from "@/public/card-bg.png";

type Photo = { image: HTMLImageElement; zoom: number; x: number; y: number };

const FONT_SPECS = ["400 48px Bozon", "700 48px Bozon", "800 48px Bozon"];

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

export default function CardGenerator({ events, initialSlug }: { events: EventInfo[]; initialSlug: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number } | null>(null);

  const [background, setBackground] = useState<HTMLImageElement | null>(null);
  const [slug, setSlug] = useState(initialSlug);
  const [name, setName] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [photo, setPhoto] = useState<Photo | null>(null);
  const [dropping, setDropping] = useState(false);
  const [error, setError] = useState("");

  const event = events.find((e) => e.slug === slug) ?? events[0];

  const cardData = useCallback(
    (): CardData => ({
      edition: event.edition,
      date: event.date,
      name,
      role,
      company,
      photo: photo && { ...photo, width: photo.image.naturalWidth, height: photo.image.naturalHeight },
    }),
    [event, name, role, company, photo],
  );

  useEffect(() => {
    Promise.all([loadImage(cardBackground.src), ...FONT_SPECS.map((f) => document.fonts.load(f))])
      .then(([bg]) => setBackground(bg))
      .catch(() => setError("Couldn't load the card template. Please refresh."));
  }, []);

  useEffect(() => {
    if (background && canvasRef.current) drawCard(canvasRef.current, background, cardData(), { scale: 2, placeholders: true });
  }, [background, cardData]);

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return setError("That file isn't an image. Try a JPG or PNG.");
    const url = URL.createObjectURL(file);
    try {
      setPhoto({ image: await loadImage(url), zoom: 1, x: 0, y: 0 });
      setError("");
    } catch {
      setError("Couldn't read that image. Try a JPG or PNG.");
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  const movePhoto = (patch: Partial<Photo>) =>
    setPhoto((p) => {
      if (!p) return p;
      const next = { ...p, ...patch };
      const { x, y } = clampPhoto({ ...next, width: p.image.naturalWidth, height: p.image.naturalHeight });
      return { ...next, x, y };
    });

  // Pointer position in card units.
  const toCard = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CARD_W, y: ((e.clientY - r.top) / r.height) * CARD_H };
  };

  const download = (scale: number) => {
    if (!background) return;
    const canvas = document.createElement("canvas");
    drawCard(canvas, background, cardData(), { scale });
    canvas.toBlob((blob) => {
      if (!blob) return setError("Couldn't create the image. Please try again.");
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      const who = name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      a.download = `merkle-science-meet-${event.slug}${who ? `-${who}` : ""}.png`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }, "image/png");
  };

  const clear = () => {
    setName("");
    setRole("");
    setCompany("");
    setPhoto(null);
    setError("");
    if (fileRef.current) fileRef.current.value = "";
  };

  const ready = Boolean(background && name.trim());

  return (
    <div className="generator">
      <section className="preview">
        <canvas
          ref={canvasRef}
          width={CARD_W * 2}
          height={CARD_H * 2}
          className={photo ? "draggable" : undefined}
          aria-label={`Preview of your guest card for Merkle Science Meet ${event.edition}`}
          onPointerDown={(e) => {
            const p = toCard(e);
            if (!photo || !isOverPhoto(p.x, p.y)) return;
            e.currentTarget.setPointerCapture(e.pointerId);
            drag.current = { px: p.x, py: p.y, x: photo.x, y: photo.y };
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            const p = toCard(e);
            movePhoto({ x: drag.current.x + p.x - drag.current.px, y: drag.current.y + p.y - drag.current.py });
          }}
          onPointerUp={() => (drag.current = null)}
          onPointerCancel={() => (drag.current = null)}
        />
        <div className="preview-meta">
          <span>{photo ? "Drag the photo to reposition it" : "Add a photo to complete your card"}</span>
          <span>
            {CARD_W} × {CARD_H}
          </span>
        </div>
      </section>

      <form className="controls" onSubmit={(e) => e.preventDefault()}>
        {events.length > 1 && (
          <label>
            <span>Event</span>
            <select value={event.slug} onChange={(e) => setSlug(e.target.value)}>
              {events.map((e) => (
                <option key={e.slug} value={e.slug}>
                  {e.edition}
                </option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Name Surname" autoComplete="name" maxLength={60} />
        </label>
        <label>
          <span>Role</span>
          <input value={role} onChange={(e) => setRole(e.target.value)} placeholder="Your role" autoComplete="organization-title" maxLength={50} />
        </label>
        <label>
          <span>Company</span>
          <input value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Company" autoComplete="organization" maxLength={50} />
        </label>

        <div className="field">
          <span>Photo</span>
          <button
            type="button"
            className={`dropzone${dropping ? " dropping" : ""}`}
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => (e.preventDefault(), setDropping(true))}
            onDragLeave={() => setDropping(false)}
            onDrop={(e) => (e.preventDefault(), setDropping(false), pickPhoto(e.dataTransfer.files[0]))}
          >
            <strong>{photo ? "Change photo" : "Choose a photo"}</strong>
            <small>or drop it here · JPG / PNG · a head-and-shoulders shot works best</small>
          </button>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
        </div>

        <label>
          <span>Zoom</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={photo?.zoom ?? 1}
            disabled={!photo}
            onChange={(e) => movePhoto({ zoom: Number(e.target.value) })}
          />
        </label>

        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}

        <button type="button" className="primary" disabled={!ready} onClick={() => download(1)}>
          Download PNG
        </button>
        <button type="button" disabled={!ready} onClick={() => download(2)}>
          Download @2x · {CARD_W * 2} × {CARD_H * 2}
        </button>
        <button type="button" onClick={clear}>
          Clear
        </button>
        {!name.trim() && <p className="hint">Enter your name to download.</p>}
      </form>
    </div>
  );
}
