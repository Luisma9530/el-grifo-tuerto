import React from 'react';
import { Clock, Users, Brain, Dice5, Check, X, ShieldAlert, Sparkles } from 'lucide-react';

export default function Features() {
  const featuresList = [
    {
      icon: <Clock className="w-6 h-6 text-amber-500" />,
      title: 'Se Acabaron las Agendas Rotas',
      subtitle: 'Juega a las 11 PM un martes sin esperar 3 semanas',
      desc: 'El mayor jefe final de cualquier grupo de rol nunca fue un dragón anciano; fue cuadrar un sábado por la tarde. Con Maese Duncan, tu Dungeon Master siempre está tras la barra, despierto y listo para narrar.'
    },
    {
      icon: <Users className="w-6 h-6 text-emerald-400" />,
      title: 'Tus Amigos Juegan 100% Gratis',
      subtitle: 'Un solo enlace privado para toda la mesa',
      desc: 'No obligues a tus colegas a pagar suscripciones. Si tú tienes una campaña, generas un enlace y tus amigos pueden sentarse en tu mesa con sus personajes de forma totalmente gratuita y libre.'
    },
    {
      icon: <Brain className="w-6 h-6 text-purple-400" />,
      title: 'Memoria y Consecuencias Reales',
      subtitle: 'Los taberneros recuerdan tus deudas y tus crímenes',
      desc: 'A diferencia de los chatbots genéricos que se olvidan de todo a los cinco turnos, el mundo de El Grifo Tuerto rastrea reputaciones con facciones, personajes secundarios y el rastro de consecuencias que dejas a tu paso.'
    },
    {
      icon: <Dice5 className="w-6 h-6 text-amber-400" />,
      title: 'Dados Físicos & Audio Inmersivo',
      subtitle: 'Siente el traqueteo de los dados poliédricos',
      desc: 'Tira d20, d12, d10, d8, d6 y d4 con cálculos automáticos de tus atributos de personaje. Escucha el crepitar de la leña y el tintineo de las jarras mientras la tensión sube en cada decisión.'
    }
  ];

  return (
    <section id="features" className="py-20 bg-[#0e0c13] relative">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-400 text-xs font-semibold mb-3">
            <Sparkles className="w-3.5 h-3.5" />
            <span>La Experiencia Definitiva</span>
          </div>
          <h2 className="font-cinzel text-3xl sm:text-5xl font-extrabold text-stone-100">
            Todo lo que Amas de D&D, <br />
            <span className="text-amber-400">Sin los Dolores de Cabeza</span>
          </h2>
          <p className="mt-4 text-base sm:text-lg text-stone-300">
            Diseñado por y para amantes del rol de mesa que quieren jugar más a menudo sin perder horas en hojas de cálculo ni coordinando calendarios imposibles.
          </p>
        </div>

        {/* 4 Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-20">
          {featuresList.map((item, idx) => (
            <div
              key={idx}
              className="tavern-wood-panel tavern-wood-panel-hover rounded-2xl p-7 flex flex-col justify-between"
            >
              <div>
                <div className="w-12 h-12 rounded-xl bg-stone-900 border border-amber-600/30 flex items-center justify-center mb-5 shadow-inner">
                  {item.icon}
                </div>
                <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-stone-100">
                  {item.title}
                </h3>
                <div className="text-xs font-medium text-amber-400/90 mt-1 mb-3">
                  {item.subtitle}
                </div>
                <p className="text-sm text-stone-300 leading-relaxed">
                  {item.desc}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* Comparison Table */}
        <div className="rounded-2xl bg-[#14111a] border border-amber-900/40 p-6 sm:p-8 shadow-xl">
          <h3 className="font-cinzel text-2xl font-bold text-center text-stone-100 mb-8">
            ¿Cómo se compara El Grifo Tuerto?
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-amber-900/40 text-stone-400 font-mono text-xs">
                  <th className="py-3 px-4">Característica</th>
                  <th className="py-3 px-4 text-amber-400 font-bold font-cinzel text-sm bg-amber-500/10 rounded-t-lg">
                    🦅 El Grifo Tuerto
                  </th>
                  <th className="py-3 px-4">D&D Tradicional</th>
                  <th className="py-3 px-4">Chatbots Genéricos (ChatGPT)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-800 text-stone-300">
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Tiempo de preparación</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400 bg-amber-500/5">Inmediato (0 segundos)</td>
                  <td className="py-3.5 px-4 text-stone-400">3-6 horas por sesión para el DM</td>
                  <td className="py-3.5 px-4 text-stone-400">Inmediato (pero sin reglas de D&D)</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Disponibilidad para jugar</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400 bg-amber-500/5">24/7 en cualquier momento</td>
                  <td className="py-3.5 px-4 text-stone-400">Cada 2 o 4 semanas (con suerte)</td>
                  <td className="py-3.5 px-4 text-emerald-400">24/7</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Amigos juegan gratis</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400 bg-amber-500/5">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Check className="w-4 h-4" /> 100% Gratuito y Libre
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-stone-300">Sí (en mesa física)</td>
                  <td className="py-3.5 px-4 text-red-400">
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <X className="w-4 h-4" /> No (Solo para 1 usuario)
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Dados & Fichas con D&D 5e</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400 bg-amber-500/5">
                    <span className="inline-flex items-center gap-1 text-emerald-400 font-bold">
                      <Check className="w-4 h-4" /> Integrado con modificadores
                    </span>
                  </td>
                  <td className="py-3.5 px-4 text-stone-300">Manual en papel o Roll20</td>
                  <td className="py-3.5 px-4 text-red-400">
                    <span className="inline-flex items-center gap-1 text-red-400">
                      <X className="w-4 h-4" /> Se inventa los números
                    </span>
                  </td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Personalidad del DM</td>
                  <td className="py-3.5 px-4 font-semibold text-amber-300 bg-amber-500/5">
                    Irreverente, canalla y con colmillos
                  </td>
                  <td className="py-3.5 px-4 text-stone-300">Depende de tu amigo DM</td>
                  <td className="py-3.5 px-4 text-stone-400">Soso, servicial y complaciente</td>
                </tr>
                <tr>
                  <td className="py-3.5 px-4 font-medium text-stone-200">Memoria de Campaña & Mapas</td>
                  <td className="py-3.5 px-4 font-semibold text-emerald-400 bg-amber-500/5 rounded-b-lg">
                    Persistente con nodos y facciones
                  </td>
                  <td className="py-3.5 px-4 text-stone-300">Cuadernos y notas del DM</td>
                  <td className="py-3.5 px-4 text-red-400">Se pierde a los pocos turnos</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </section>
  );
}
