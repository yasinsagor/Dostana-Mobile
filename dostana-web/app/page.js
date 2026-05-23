import Link from 'next/link';
import { MENU } from '@/lib/menuData';
import { BRANCHES } from '@/lib/branches';

export default function HomePage() {
  const featuredDishes = MENU[0].items.slice(0, 3);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative bg-[#1B5E20] text-white overflow-hidden">
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage:
              'radial-gradient(circle at 20% 50%, #4CAF50 0%, transparent 50%), radial-gradient(circle at 80% 20%, #81C784 0%, transparent 50%)',
          }}
        />
        <div className="relative max-w-6xl mx-auto px-4 py-24 md:py-36 text-center">
          <span className="inline-block bg-[#2E7D32] text-green-100 text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wide">
            🥙 10 lokalizacji w Polsce
          </span>
          <h1 className="text-4xl md:text-6xl font-extrabold leading-tight mb-4">
            Najlepszy Kebab<br />w Polsce
          </h1>
          <p className="text-lg md:text-xl text-green-100 max-w-xl mx-auto mb-8">
            Świeże mięso z grilla, domowe sosy i autentyczny smak – każdego dnia, w każdym naszym lokalu.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/menu"
              className="bg-white text-[#2E7D32] font-bold px-8 py-3 rounded-full text-base hover:bg-green-50 transition-colors shadow"
            >
              Zobacz Menu
            </Link>
            <Link
              href="/locations"
              className="border-2 border-white text-white font-bold px-8 py-3 rounded-full text-base hover:bg-white/10 transition-colors"
            >
              Znajdź Lokal
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Us ── */}
      <section className="bg-[#E8F5E9] py-16">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">Dlaczego Dostana?</h2>
          <p className="text-gray-500 mb-10">Jakość, którą czujesz w każdym kęsie</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {[
              { emoji: '🌿', title: 'Świeże Składniki', desc: 'Codziennie dobieramy najświeższe warzywa i mięso prosto od sprawdzonych dostawców.' },
              { emoji: '🫙', title: 'Domowe Sosy', desc: 'Nasze sosy wytwarzane są według tradycyjnych receptur – czosnkowy, ostry, mango i wiele innych.' },
              { emoji: '⚡', title: 'Szybka Obsługa', desc: 'Twój kebab gotowy w kilka minut. Szybko, smacznie i zawsze w dobrej cenie.' },
            ].map((item) => (
              <div key={item.title} className="bg-white rounded-2xl p-6 shadow-sm text-left">
                <div className="text-4xl mb-3">{item.emoji}</div>
                <h3 className="font-bold text-gray-900 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Featured Menu ── */}
      <section className="py-16 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900">Nasze Kebaby</h2>
              <p className="text-gray-500 mt-1">Klasyki, które zawsze smakują</p>
            </div>
            <Link href="/menu" className="text-[#2E7D32] font-semibold text-sm hover:underline hidden sm:block">
              Pełne Menu →
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            {featuredDishes.map((item) => (
              <div key={item.name} className="border border-gray-100 rounded-2xl overflow-hidden hover:shadow-md transition-shadow">
                <div className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] h-36 flex items-center justify-center text-6xl">
                  🥙
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-gray-900">{item.name}</h3>
                  <p className="text-sm text-gray-500 mt-1 mb-3 leading-relaxed">{item.desc}</p>
                  <span className="font-bold text-[#2E7D32] text-lg">{item.price} zł</span>
                </div>
              </div>
            ))}
          </div>
          <div className="text-center mt-8 sm:hidden">
            <Link href="/menu" className="text-[#2E7D32] font-semibold text-sm hover:underline">
              Pełne Menu →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Delivery Banner ── */}
      <section className="bg-gray-900 text-white py-14">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold mb-2">Zamów z dostawą do domu</h2>
          <p className="text-gray-400 mb-8">Dostępni na najpopularniejszych platformach dostawowych</p>
          <div className="flex flex-wrap justify-center gap-4">
            {['🛵 Glovo', '🟡 Wolt', '⚡ Bolt Food'].map((platform) => (
              <div key={platform} className="bg-gray-800 px-6 py-3 rounded-xl font-semibold text-lg">
                {platform}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Locations teaser ── */}
      <section className="py-16 bg-[#E8F5E9]">
        <div className="max-w-6xl mx-auto px-4 text-center">
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            {BRANCHES.length} Lokalizacji w Polsce
          </h2>
          <p className="text-gray-500 mb-8">Znajdź nas w swoim mieście</p>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-8">
            {BRANCHES.map((b) => (
              <div key={b.id} className="bg-white rounded-xl px-3 py-3 shadow-sm text-sm font-medium text-gray-700 text-center">
                📍 {b.name}
              </div>
            ))}
          </div>
          <Link
            href="/locations"
            className="inline-block bg-[#2E7D32] text-white font-bold px-8 py-3 rounded-full hover:bg-[#1B5E20] transition-colors"
          >
            Zobacz Wszystkie Lokale
          </Link>
        </div>
      </section>
    </>
  );
}
