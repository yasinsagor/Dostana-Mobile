'use client';

import { useState } from 'react';

export default function ContactPage() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);

  function handleChange(e) {
    setForm({ ...form, [e.target.name]: e.target.value });
  }

  function handleSubmit(e) {
    e.preventDefault();
    // TODO: wire up to email service or Supabase
    setSent(true);
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-16">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-extrabold text-gray-900 mb-2">Kontakt</h1>
        <p className="text-gray-500">Masz pytanie lub sugestię? Napisz do nas!</p>
      </div>

      <div className="grid md:grid-cols-2 gap-10">
        {/* Contact info */}
        <div className="flex flex-col gap-5">
          <h2 className="text-xl font-bold text-gray-900">Informacje kontaktowe</h2>
          {[
            { emoji: '📧', label: 'E-mail', value: 'kontakt@dostanakebab.com', href: 'mailto:kontakt@dostanakebab.com' },
            { emoji: '📱', label: 'Telefon', value: '+48 000 000 000', href: 'tel:+48000000000' },
            { emoji: '📘', label: 'Facebook', value: 'dostanakebab', href: 'https://www.facebook.com/dostanakebab/' },
            { emoji: '📸', label: 'Instagram', value: '@dostanakebab.lublin', href: 'https://www.instagram.com/dostanakebab.lublin/' },
          ].map((item) => (
            <a
              key={item.label}
              href={item.href}
              target={item.href.startsWith('http') ? '_blank' : undefined}
              rel={item.href.startsWith('http') ? 'noopener noreferrer' : undefined}
              className="flex items-center gap-4 bg-[#E8F5E9] rounded-xl p-4 hover:bg-[#C8E6C9] transition-colors"
            >
              <span className="text-2xl">{item.emoji}</span>
              <div>
                <div className="text-xs text-gray-500 font-medium">{item.label}</div>
                <div className="font-semibold text-gray-900">{item.value}</div>
              </div>
            </a>
          ))}

          <div className="mt-4 p-5 bg-[#2E7D32] text-white rounded-2xl">
            <h3 className="font-bold mb-2">Zamawiaj z dostawą</h3>
            <p className="text-sm text-green-100 mb-3">Dostępni na platformach:</p>
            <div className="flex flex-wrap gap-2 text-sm font-medium">
              <span className="bg-white/20 px-3 py-1 rounded-full">🛵 Glovo</span>
              <span className="bg-white/20 px-3 py-1 rounded-full">🟡 Wolt</span>
              <span className="bg-white/20 px-3 py-1 rounded-full">⚡ Bolt Food</span>
            </div>
          </div>
        </div>

        {/* Contact form */}
        <div className="bg-white border border-gray-100 rounded-2xl shadow-sm p-8">
          {sent ? (
            <div className="flex flex-col items-center justify-center h-full text-center gap-3 py-10">
              <span className="text-5xl">✅</span>
              <h3 className="text-xl font-bold text-gray-900">Dziękujemy!</h3>
              <p className="text-gray-500 text-sm">Twoja wiadomość została wysłana. Odezwiemy się wkrótce.</p>
              <button
                onClick={() => { setSent(false); setForm({ name: '', email: '', message: '' }); }}
                className="mt-4 text-[#2E7D32] font-semibold text-sm hover:underline"
              >
                Wyślij kolejną wiadomość
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-5">
              <h2 className="text-xl font-bold text-gray-900">Napisz do nas</h2>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Imię i nazwisko</label>
                <input
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  required
                  placeholder="Jan Kowalski"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Adres e-mail</label>
                <input
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  required
                  placeholder="jan@example.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Wiadomość</label>
                <textarea
                  name="message"
                  value={form.message}
                  onChange={handleChange}
                  required
                  rows={5}
                  placeholder="Twoja wiadomość..."
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#2E7D32] resize-none"
                />
              </div>
              <button
                type="submit"
                className="bg-[#2E7D32] text-white font-bold py-3 rounded-full hover:bg-[#1B5E20] transition-colors"
              >
                Wyślij Wiadomość
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
