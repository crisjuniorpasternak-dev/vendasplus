import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ZapDesk · Multiatendimento WhatsApp",
  description: "Multiatendimento, CRM e disparo de campanhas pelo WhatsApp",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
