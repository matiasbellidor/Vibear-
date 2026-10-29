"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type DragEvent, type FormEvent } from "react";
import { ApiError, api, type Look } from "@/lib/api";
import { PINS } from "@/lib/landing";
import { downscale } from "@/lib/resize";
import { rememberLook } from "@/lib/storage";
import { FadeImage } from "./FadeImage";
import { Icon, cx, icons, primaryButton } from "./ui";

// Sample looks for visitors without a screenshot at hand: two womenswear, two menswear outfits
// with at least two detected garments (landing photos, freely licensed).
const outfits = PINS.filter((pin) => pin.hotspots.length >= 2);
const EXAMPLES = [
  ...outfits.filter((pin) => pin.kind === "woman").slice(0, 2),
  ...outfits.filter((pin) => pin.kind === "man").slice(0, 2),
];

type Phase = { kind: "idle" } | { kind: "detecting"; preview: string } | { kind: "error"; message: string };

function messageOf(error: unknown): string {
  return error instanceof ApiError ? error.message : "Algo salió mal. Probá de nuevo.";
}

/** The drop target: file picker, drag and drop, paste (Ctrl/Cmd+V) or an image link. */
export function Uploader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [dragging, setDragging] = useState(false);
  const [url, setUrl] = useState("");
  const busy = phase.kind === "detecting";

  const open = useCallback(
    (look: Look) => {
      rememberLook(look);
      router.push(`/look/${look.image_id}`);
    },
    [router],
  );

  const detectFile = useCallback(
    async (file: File) => {
      if (file.type && !file.type.startsWith("image/")) {
        setPhase({ kind: "error", message: "Ese archivo no es una imagen." });
        return;
      }
      setPhase({ kind: "detecting", preview: URL.createObjectURL(file) });
      try {
        open(await api.detectFile(await downscale(file)));
      } catch (error) {
        setPhase({ kind: "error", message: messageOf(error) });
      }
    },
    [open],
  );

  const tryExample = async (src: string) => {
    try {
      const blob = await (await fetch(src)).blob();
      await detectFile(new File([blob], "ejemplo.webp", { type: blob.type || "image/webp" }));
    } catch {
      setPhase({ kind: "error", message: "No pudimos cargar el ejemplo. Probá con una foto tuya." });
    }
  };

  // Paste a screenshot anywhere on the page.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const file = Array.from(event.clipboardData?.files ?? []).find((f) => f.type.startsWith("image/"));
      if (!file || busy) return;
      event.preventDefault();
      void detectFile(file);
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [busy, detectFile]);

  // Free the object URL of a preview once it is replaced or the page goes away.
  useEffect(() => {
    const preview = phase.kind === "detecting" ? phase.preview : null;
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [phase]);

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) void detectFile(file);
  };

  const onSubmitUrl = async (event: FormEvent) => {
    event.preventDefault();
    const link = url.trim();
    if (!/^https?:\/\//i.test(link)) {
      setPhase({ kind: "error", message: "Pegá un link que empiece con http:// o https://." });
      return;
    }
    setPhase({ kind: "detecting", preview: link });
    try {
      open(await api.detectUrl(link));
    } catch (error) {
      setPhase({ kind: "error", message: messageOf(error) });
    }
  };

  return (
    <div>
      <div
        onDragOver={(event) => {
          event.preventDefault();
          if (!busy) setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={cx(
          "relative flex min-h-[22rem] flex-col items-center justify-center border border-ink px-6 py-10 text-center transition-colors duration-200 ease-out-soft lg:min-h-[28rem]",
          dragging && "bg-surface",
        )}
      >
        {phase.kind === "detecting" ? (
          <Scanning preview={phase.preview} />
        ) : (
          <>
            <p className="text-micro text-muted">{dragging ? "Soltala acá" : "Subí una foto"}</p>
            <h2 className="mt-4 font-display text-title tracking-tight">Mostranos el look</h2>
            <p className="mt-4 max-w-[40ch] text-small text-muted">
              Arrastrá una imagen, pegala con Ctrl+V o elegí un archivo. Las capturas de Reels, TikTok o Pinterest
              funcionan perfecto.
            </p>
            <button type="button" onClick={() => inputRef.current?.click()} className={cx(primaryButton, "mt-8")}>
              Elegir foto
            </button>
            <div className="mt-8 flex flex-col items-center gap-3">
              <p className="text-micro text-muted">¿No tenés una a mano? Probá con un ejemplo</p>
              <div className="flex gap-2">
                {EXAMPLES.map((photo, index) => (
                  <button
                    key={photo.src}
                    type="button"
                    onClick={() => void tryExample(photo.src)}
                    aria-label={`Probar con el ejemplo ${index + 1}`}
                    className="h-16 w-12 overflow-hidden rounded-media bg-surface outline-offset-2 transition-opacity duration-200 ease-out-soft hover:opacity-80"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element -- pre-sized local WebP */}
                    <img src={photo.src} alt="" width={photo.width} height={photo.height} className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          tabIndex={-1}
          aria-label="Elegir foto"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void detectFile(file);
          }}
        />
      </div>

      <form
        onSubmit={onSubmitUrl}
        className="mt-3 flex border border-ink focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ink"
      >
        <label htmlFor="image-url" className="sr-only">
          Link de una imagen
        </label>
        <input
          id="image-url"
          type="url"
          inputMode="url"
          autoComplete="off"
          placeholder="O pegá el link de una imagen"
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          disabled={busy}
          className="h-12 min-w-0 flex-1 bg-transparent px-4 text-small outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={busy || url.trim() === ""}
          aria-label="Buscar por link"
          className="grid h-12 w-12 shrink-0 place-items-center border-l border-ink transition-colors hover:bg-ink hover:text-paper disabled:text-muted disabled:hover:bg-transparent"
        >
          <Icon path={icons.arrowRight} />
        </button>
      </form>

      {phase.kind === "error" && (
        <p role="alert" className="mt-4 text-small">
          {phase.message}
        </p>
      )}
    </div>
  );
}

function Scanning({ preview }: { preview: string }) {
  return (
    <div className="flex w-full flex-col items-center">
      <div className="relative overflow-hidden rounded-media bg-surface">
        <FadeImage src={preview} alt="Tu foto" className="block max-h-[18rem] w-auto lg:max-h-[22rem]" />
        <span
          aria-hidden="true"
          className="absolute inset-x-0 top-0 h-0.5 bg-paper mix-blend-difference motion-safe:animate-scan"
        />
      </div>
      <p role="status" className="mt-6 text-micro">
        Detectando prendas…
      </p>
    </div>
  );
}
