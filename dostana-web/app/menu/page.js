'use client';

import { useState } from 'react';
import { MENU } from '@/lib/menuData';

export default function MenuPage() {
  const [activeCategory, setActiveCategory] = useState('Wszystkie');

  const categories = ['Wszystkie', ...MENU.map((c) => c.category)];

  const visibleSections =
    activeCategory === 'Wszystkie'
      ? MENU
      : MENU.filter((c) => c.category === activeCategory);

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      {/* Header */}
      <div className="text-center mb-10">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Nasze Menu</h1>
        <p className="text-gray-500">Świeże składniki, autentyczne smaki. Znajdź swojego ulubionego kebaba.</p>
      </div>

      {/* Category tabs */}
      <div className="flex flex-wrap justify-center gap-2 mb-10">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-5 py-2 rounded-full text-sm font-semibold transition-colors ${
              activeCategory === cat
                ? 'bg-[#2E7D32] text-white shadow'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Sections */}
      {visibleSections.map((section) => (
        <div key={section.category} className="mb-12">
          <h2 className="text-xl font-bold text-gray-900 mb-5 flex items-center gap-2">
            <span>{section.emoji}</span> {section.category}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {section.items.map((item) => (
              <div
                key={item.name}
                className="border border-gray-100 rounded-2xl p-4 hover:shadow-md transition-shadow bg-white flex flex-col"
              >
                <div className="bg-gradient-to-br from-[#E8F5E9] to-[#C8E6C9] rounded-xl h-28 flex items-center justify-center text-5xl mb-4">
                  {section.emoji}
                </div>
                <h3 className="font-bold text-gray-900 text-base">{item.name}</h3>
                <p className="text-sm text-gray-500 mt-1 leading-relaxed flex-1">{item.desc}</p>
                <div className="mt-3 flex items-center justify-between">
                  <span className="text-[#2E7D32] font-extrabold text-lg">{item.price} zł</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {/* Allergen note */}
      <p className="text-center text-xs text-gray-400 mt-4">
        Informacje o alergenach dostępne na miejscu. Ceny zawierają VAT.
      </p>
    </div>
  );
}
