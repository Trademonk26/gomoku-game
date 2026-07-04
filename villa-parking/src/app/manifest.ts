import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "우리빌라 주차장",
    short_name: "우리주차장",
    description: "이중주차 갈등 없는 아침 — 초경량 주차 공유",
    start_url: "/",
    display: "standalone",
    background_color: "#141B26",
    theme_color: "#141B26",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
