import "./globals.css";
import Header from "@/components/Header";

export const metadata = {
  title: "SplitMate",
  description: "Divide gastos con tus amigos sin dramas.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main className="flex-grow-1">{children}</main>
      </body>
    </html>
  );
}
