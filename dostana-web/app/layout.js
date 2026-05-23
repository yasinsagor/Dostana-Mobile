import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata = {
  title: "Dostana Kebab – Najlepszy Kebab w Polsce",
  description: "Dostana Kebab – autentyczny smak kebaba. Świeże składniki, domowe sosy, 10 lokali w Polsce. Zamów online lub odwiedź nas!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pl" className="h-full">
      <body className="min-h-full flex flex-col antialiased">
        <Navbar />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
