"use client"; // Car state et clics client-side
import React from "react";
import Link from "next/link"; // Pour navigation sans reload
import { usePathname } from "next/navigation"; // Pour détecter tab actif via URL

type Tab = "movies" | "tv-shows" | "animes" | "library"; // Ajusté pour matcher dossiers (avec tirets)

const tabs: { label: string; value: Tab }[] = [
  { label: "Movies", value: "movies" },
  { label: "Tv Shows", value: "tv-shows" },
  { label: "Animes", value: "animes" },
  { label: "Library", value: "library" },
];

export default function WatchingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname(); 
  const activeTab = pathname.split("/").pop() || "movies"; 

  return (
    <section>
      <div className="w-full bg-[#09090B] px-4">
        <div className="w-fit pt-2 flex gap-10  ">
        {tabs.map((tab) => (
          <Link
            key={tab.value}
            href={`/perso/watching/${tab.value}`}
            className={`relative pb-3 text-sm font-medium transition-colors duration-200 cursor-pointer 
              ${
                activeTab === tab.value
                  ? "text-white after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-white after:rounded-tl-md after:rounded-tr-md"
                  : "text-gray-500 hover:text-white"
              }
            `}
          >
            {tab.label}
          </Link>
        ))}
      </div>
      </div>
      <div className="p-4 bg-[#09090B]">{children}</div>{" "}
      {/* Outlet : contenu de la sous-page */}
    </section>
  );
}
