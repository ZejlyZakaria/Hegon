"use client";

import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/shared/components/ui/dialog";

interface Props {
  open: boolean;
  onClose: () => void;
  youtubeKey: string | null | undefined;
  title: string;
}

// Cinematic in-app trailer lightbox — embeds YouTube (no-cookie) so the viewer
// never leaves HEGON. Requires `frame-src youtube` in the CSP (next.config).
export function TrailerModal({ open, onClose, youtubeKey, title }: Props) {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="w-[calc(100%-2rem)] max-w-4xl overflow-hidden border-border-strong bg-black p-0 sm:max-w-4xl">
        <DialogTitle className="sr-only">{title} — Trailer</DialogTitle>
        <DialogDescription className="sr-only">Watch the {title} trailer.</DialogDescription>
        <div className="aspect-video w-full bg-black">
          {open && youtubeKey && (
            <iframe
              className="h-full w-full"
              src={`https://www.youtube-nocookie.com/embed/${youtubeKey}?autoplay=1&rel=0`}
              title={`${title} trailer`}
              allow="autoplay; encrypted-media; picture-in-picture"
              allowFullScreen
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
