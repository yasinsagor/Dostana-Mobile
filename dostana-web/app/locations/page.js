import { BRANCHES } from '@/lib/branches';

export const metadata = {
  title: 'Nasze Lokale – Dostana Kebab',
  description: 'Znajdź lokal Dostana Kebab w swoim mieście. 10 lokalizacji w Polsce.',
};

export default function LocationsPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Nasze Lokale</h1>
        <p className="text-gray-500">
          Mamy <strong>{BRANCHES.length} lokalizacji</strong> w całej Polsce. Znajdź tę najbliższą Tobie.
        </p>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {BRANCHES.map((branch) => (
          <div
            key={branch.id}
            className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm hover:shadow-md transition-shadow"
          >
            {/* Icon + name */}
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-[#E8F5E9] flex items-center justify-center text-xl flex-shrink-0">
                📍
              </div>
              <div>
                <h2 className="font-bold text-gray-900 text-base leading-tight">{branch.name}</h2>
                <span className="text-xs font-medium text-[#2E7D32] bg-[#E8F5E9] px-2 py-0.5 rounded-full">
                  {branch.city}
                </span>
              </div>
            </div>

            {/* Details */}
            <ul className="space-y-2 text-sm text-gray-600">
              <li className="flex items-start gap-2">
                <span className="mt-0.5">🏠</span>
                <span>{branch.address}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">🕐</span>
                <span>{branch.hours}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="mt-0.5">📞</span>
                <a href={`tel:${branch.phone}`} className="hover:text-[#2E7D32] hover:underline">
                  {branch.phone}
                </a>
              </li>
            </ul>

            {/* Map link */}
            <a
              href={branch.mapUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 w-full inline-flex items-center justify-center gap-2 border border-[#2E7D32] text-[#2E7D32] font-semibold text-sm py-2 rounded-full hover:bg-[#E8F5E9] transition-colors"
            >
              Otwórz w mapach →
            </a>
          </div>
        ))}
      </div>
    </div>
  );
}
