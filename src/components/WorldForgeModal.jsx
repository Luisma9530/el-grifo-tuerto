import React, { useState } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Sparkles, Wand2, Compass } from 'lucide-react';

export default function WorldForgeModal({ isOpen, onClose, onCreateWorld }) {
  useEscapeKey(isOpen, onClose);
  const [name, setName] = useState('');
  const [genre, setGenre] = useState('Fantasía Oscura');
  const [difficulty, setDifficulty] = useState('Equilibrado');
  const [tavernName, setTavernName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  if (!isOpen) return null;

  const handleGenerate = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsGenerating(true);

    setTimeout(() => {
      const newWorld = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        genre,
        difficulty,
        tagline: prompt.trim() || 'Un reino forjado en la imaginación con peligros en cada esquina.',
        description: `Un entorno de ${genre.toLowerCase()} dominado por tensiones entre facciones rivales. El único lugar seguro es "${tavernName || 'La Vieja Posada'}", donde Maese Duncan mantiene el fuego encendido.`,
        coverGradient: 'from-purple-950 via-stone-900 to-amber-950',
        bannerBadge: 'Mundo Personalizado',
        initialLocation: tavernName || 'La Vieja Posada',
        factions: [
          { name: 'Gremio Local', status: 'Neutral', rep: 50, color: 'text-blue-400' },
          { name: 'Sombra Rebelde', status: 'Hostil', rep: 25, color: 'text-red-400' },
          { name: 'Parroquianos de la Barra', status: 'Amistoso', rep: 80, color: 'text-amber-400' }
        ],
        mapNodes: [
          { id: 'tavern', name: tavernName || 'La Vieja Posada', status: 'current', x: 25, y: 50, desc: 'Fuego ardiente y jarras de cerveza.' },
          { id: 'ruins', name: 'Alrededores Prohibidos', status: 'discovered', x: 50, y: 35, desc: 'Ecos de extrañas criaturas.' },
          { id: 'fortress', name: 'Bastión del Tirano', status: 'locked', x: 80, y: 60, desc: 'Muros infranqueables y guardias armados.' }
        ],
        initialStory: `El viento susurra historias olvidadas por las rendijas de "${tavernName || 'La Vieja Posada'}". 

Maese Duncan te mira desde detrás de la barra mientras pasa un paño grasiento por un vaso de cristal tallado.
—*Así que has venido a ${name} buscando emociones fuertes, ¿eh?* —gruñe con una sonrisa desafiante—. *Aquí las cosas son sencillas: vigila tu espalda, no derrames la cerveza y mantén tu acero bien afilado. La gente de la facción rebelde estuvo merodeando la entrada hace apenas media hora.*

Duncan desliza una jarra humeante hacia ti:
—*Dime, forastero: ¿qué te propones hacer antes de que amanezca?*`
      };

      setIsGenerating(false);
      onCreateWorld(newWorld);
      onClose();
    }, 700);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="w-full max-w-xl rounded-2xl bg-[#141019] border-2 border-purple-500/50 p-6 sm:p-7 shadow-2xl relative max-h-[90vh] overflow-y-auto">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="w-12 h-12 rounded-xl bg-purple-600/20 border border-purple-500/50 flex items-center justify-center text-2xl">
            ✨
          </div>
          <div>
            <h3 className="font-cinzel text-xl font-bold text-stone-100">
              Forja de Mundos con IA
            </h3>
            <p className="text-xs text-purple-400 font-mono">
              CREA UN REINO COMPLETO PARA TU CAMPAÑA
            </p>
          </div>
        </div>

        <form onSubmit={handleGenerate} className="space-y-4">
          
          <div>
            <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
              Nombre del Mundo o Región:
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej: El Valle de los Espectros, Neoterra 2088..."
              className="w-full bg-[#1c1724] border border-stone-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
                Género / Ambientación:
              </label>
              <select
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-[#1c1724] border border-stone-700 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-stone-200 focus:outline-none"
              >
                <option value="Fantasía Oscura">Fantasía Oscura</option>
                <option value="Grimdark & Dragones">Grimdark & Dragones</option>
                <option value="Cyberpunk & Sci-Fi">Cyberpunk & Sci-Fi</option>
                <option value="Terror Cósmico Lovecraftiano">Terror Cósmico (Lovecraft)</option>
                <option value="Western Sobrenatural">Western Sobrenatural</option>
                <option value="Steampunk Victoriano">Steampunk Victoriano</option>
              </select>
            </div>

            <div>
              <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
                Nivel de Desafío:
              </label>
              <select
                value={difficulty}
                onChange={(e) => setDifficulty(e.target.value)}
                className="w-full bg-[#1c1724] border border-stone-700 focus:border-purple-500 rounded-xl px-3 py-2.5 text-sm text-stone-200 focus:outline-none"
              >
                <option value="Accesible (Narrativo)">Accesible (Narrativo)</option>
                <option value="Equilibrado">Equilibrado (D&D Estándar)</option>
                <option value="Difícil (Letal)">Difícil (Letal)</option>
                <option value="Pesadilla Hardcore">Pesadilla Hardcore</option>
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
              Nombre de la Taberna o Punto de Encuentro:
            </label>
            <input
              type="text"
              value={tavernName}
              onChange={(e) => setTavernName(e.target.value)}
              placeholder="Ej: La Cantina del Cuervo Tuerto, Bar Orbital 07..."
              className="w-full bg-[#1c1724] border border-stone-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none"
            />
          </div>

          <div>
            <label className="text-xs font-mono uppercase text-stone-400 tracking-wider block mb-1.5">
              Premisa, Misterio o Amenaza Inicial:
            </label>
            <textarea
              rows={3}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Ej: Una luna sangrienta ha aparecido en el cielo y los muertos se levantan de las marismas. La taberna tiene una barrera que se está debilitando..."
              className="w-full bg-[#1c1724] border border-stone-700 focus:border-purple-500 rounded-xl px-4 py-2.5 text-sm text-stone-100 focus:outline-none resize-none"
            />
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={isGenerating || !name.trim()}
              className="w-full py-3.5 rounded-xl bg-gradient-to-r from-purple-600 via-purple-500 to-indigo-600 hover:brightness-110 disabled:opacity-50 text-white font-cinzel font-bold text-sm shadow-xl shadow-purple-600/30 flex items-center justify-center gap-2 transition-all"
            >
              {isGenerating ? (
                <>
                  <Wand2 className="w-5 h-5 animate-spin" />
                  <span>Maese Duncan está forjando el lore del reino...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-5 h-5" />
                  <span>Forjar Mundo y Entrar a Jugar</span>
                </>
              )}
            </button>
          </div>

        </form>

      </div>
    </div>
  );
}
