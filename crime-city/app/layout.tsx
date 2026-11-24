import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";
import "./arena.css";
import "./city.css";
import "./wireframe.css";
import "./black.css";
import "./bright-charcoal.css";
import "./original-assets.css";
import "./lobby-themes.css";
import "./nickname.css";
import "./title-picker.css";
import "./bio.css";
import "./public-profile.css";
import "./appearance.css";
import "./expanded-profile.css";
import "./friend-feedback.css";
import "./level-up.css";
import "./inventory.css";
import "./currency.css";
import "./interactions.css";
import "./start.css";
import "./story.css";
import "./loading.css";
import "./office.css";
import "./office/office-tw.css";
import "./office/office.css";
import "./event/event.css";
import "./ui-scale.css";

export const metadata: Metadata = {
  title: "Crime City — 모두에겐 비밀이 있다",
  description: "당신의 이름으로 이야기를 시작하세요. 크라임 시티 온라인 머더 미스터리 플랫폼.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <head><link rel="preload" as="image" href="/assets/loading-character.webp" fetchPriority="high"/></head>
      <body className="antialiased">{children}</body>
    </html>
  );
}
