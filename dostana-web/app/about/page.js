export const metadata = {
  title: 'O Nas – Dostana Kebab',
  description: 'Poznaj historię Dostana Kebab – sieci restauracji z prawdziwym smakiem kebaba.',
};

export default function AboutPage() {
  return (
    <div className="max-w-4xl mx-auto px-4 py-16">
      {/* Header */}
      <div className="text-center mb-14">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-3">O Nas</h1>
        <p className="text-gray-500 text-lg">Pasja do kebaba od pierwszego dnia</p>
      </div>

      {/* Story */}
      <div className="grid md:grid-cols-2 gap-10 items-center mb-16">
        <div>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Nasza Historia</h2>
          <p className="text-gray-600 leading-relaxed mb-4">
            Dostana Kebab powstało z jednej, prostej misji: serwować autentyczny, smaczny kebab z najwyższej jakości składników. Zaczęliśmy od jednego małego lokalu w Lublinie, a dziś jesteśmy obecni w 10 miastach w całej Polsce.
          </p>
          <p className="text-gray-600 leading-relaxed">
            Każdego dnia dbamy o to, żeby nasze mięso było świeże z grilla, warzywa prosto od dostawców, a sosy robione według tradycyjnych receptur. To właśnie dlatego nasi klienci wracają – i przyprowadzają swoich znajomych.
          </p>
        </div>
        <div className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-3xl h-64 flex items-center justify-center text-8xl">
          🥙
        </div>
      </div>

      {/* Values */}
      <div className="mb-16">
        <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">Nasze Wartości</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {[
            { emoji: '🌿', title: 'Świeżość', desc: 'Każdego dnia używamy tylko świeżych składników – bez wyjątków.' },
            { emoji: '🤝', title: 'Zaufanie', desc: 'Stałe receptury, sprawdzeni dostawcy, rzetelna obsługa.' },
            { emoji: '🌍', title: 'Autentyczność', desc: 'Tradycyjne receptury z Bliskiego Wschodu, podane z polskim sercem.' },
            { emoji: '⚡', title: 'Szybkość', desc: 'Twój kebab gotowy w kilka minut – bez kompromisu jakości.' },
          ].map((item) => (
            <div key={item.title} className="flex gap-4 items-start bg-[#E8F5E9] rounded-2xl p-5">
              <span className="text-3xl">{item.emoji}</span>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="bg-[#2E7D32] text-white rounded-3xl p-10">
        <h2 className="text-2xl font-bold text-center mb-8">Dostana w liczbach</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
          {[
            { number: '10', label: 'Lokalizacji' },
            { number: '50+', label: 'Produktów w menu' },
            { number: '100k+', label: 'Zadowolonych klientów' },
            { number: '5★', label: 'Średnia ocena' },
          ].map((stat) => (
            <div key={stat.label}>
              <div className="text-4xl font-extrabold mb-1">{stat.number}</div>
              <div className="text-green-200 text-sm">{stat.label}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
