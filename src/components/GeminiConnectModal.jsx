import React, { useState, useEffect } from 'react';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { X, Sparkles, Key, ExternalLink, ShieldCheck, Check, Trash2, Plus, Users, Zap, RefreshCw, AlertCircle, HelpCircle } from 'lucide-react';
import { getStoredGeminiKeys, saveStoredGeminiKeys, testGeminiKey } from '../utils/geminiKeys';

export default function GeminiConnectModal({ isOpen, onClose, onKeysUpdated }) {
  useEscapeKey(isOpen, onClose);
  const [keysList, setKeysList] = useState([]);
  const [newKeyInput, setNewKeyInput] = useState('');
  const [newKeyLabel, setNewKeyLabel] = useState('');
  const [testStatus, setTestStatus] = useState(null); // { loading: boolean, success: boolean, msg: string }
  const [activeTab, setActiveTab] = useState('connect'); // 'connect' | 'party_pool'

  useEffect(() => {
    if (isOpen) {
      const stored = getStoredGeminiKeys();
      setKeysList(stored);
      setTestStatus(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAddKey = async (e) => {
    e.preventDefault();
    const cleanKey = newKeyInput.trim();
    if (!cleanKey || cleanKey.length < 15) {
      setTestStatus({
        loading: false,
        success: false,
        msg: 'La clave de API debe tener al menos 20 caracteres.'
      });
      return;
    }

    setTestStatus({ loading: true, msg: 'Probando conexión con Maese Duncan...' });
    const result = await testGeminiKey(cleanKey);

    if (result.success) {
      const label = newKeyLabel.trim() || (keysList.length === 0 ? 'Mi Clave Principal' : `Clave de Jugador ${keysList.length + 1}`);
      const updated = [
        ...keysList.filter(k => k.key !== cleanKey),
        { id: Date.now().toString(), label, key: cleanKey }
      ];
      setKeysList(updated);
      saveStoredGeminiKeys(updated);
      setNewKeyInput('');
      setNewKeyLabel('');
      setTestStatus({
        loading: false,
        success: true,
        msg: `¡Conexión verificada! Maese Duncan responde: "${result.reply}"`
      });
      if (onKeysUpdated) onKeysUpdated(updated);
    } else {
      setTestStatus({
        loading: false,
        success: false,
        msg: `Fallo de validación: ${result.error}`
      });
    }
  };

  const handleRemoveKey = (idToRemove) => {
    const updated = keysList.filter(k => k.id !== idToRemove);
    setKeysList(updated);
    saveStoredGeminiKeys(updated);
    if (onKeysUpdated) onKeysUpdated(updated);
  };

  const handleClearAll = () => {
    if (window.confirm('¿Deseas desconectar todas las claves y volver al motor local?')) {
      setKeysList([]);
      saveStoredGeminiKeys([]);
      setTestStatus(null);
      if (onKeysUpdated) onKeysUpdated([]);
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-[#141019] border-2 border-amber-900/50 shadow-2xl overflow-hidden relative text-stone-200">
        
        {/* Header */}
        <div className="p-4 sm:p-5 bg-gradient-to-r from-[#1f1728] via-[#16121f] to-[#1a1215] border-b border-amber-950/60 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center text-xl shadow-lg shadow-amber-950/50">
              🔮
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-lg sm:text-xl font-bold text-amber-100">
                  Conectar IA Gratis (Google Gemini)
                </h3>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-400 border border-emerald-800/60">
                  BYOK • 0 €
                </span>
              </div>
              <p className="text-xs text-stone-400">
                Usa tu propia cuenta gratuita de Google. Sin suscripciones ni gasto de tokens del creador.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg text-stone-400 hover:text-stone-100 hover:bg-stone-800/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-amber-950/40 bg-[#100d14] text-xs font-semibold">
          <button
            onClick={() => setActiveTab('connect')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'connect'
                ? 'border-b-2 border-amber-500 text-amber-300 bg-amber-950/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sparkles className="w-4 h-4 text-amber-400" />
            <span>Paso a Paso (1 Click)</span>
          </button>

          <button
            onClick={() => setActiveTab('party_pool')}
            className={`flex-1 py-3 px-4 flex items-center justify-center gap-2 transition-all ${
              activeTab === 'party_pool'
                ? 'border-b-2 border-amber-500 text-amber-300 bg-amber-950/20'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Users className="w-4 h-4 text-amber-400" />
            <span>Pool de Claves de la Party ({keysList.length})</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          
          {/* Status Banner */}
          <div className={`p-3.5 rounded-xl border flex items-center justify-between text-xs ${
            keysList.length > 0
              ? 'bg-emerald-950/30 border-emerald-800/50 text-emerald-300'
              : 'bg-amber-950/20 border-amber-800/40 text-amber-300'
          }`}>
            <div className="flex items-center gap-2.5">
              <div className={`w-2.5 h-2.5 rounded-full ${keysList.length > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
              <div>
                <span className="font-bold">
                  {keysList.length > 0
                    ? `Gemini Activo: ${keysList.length} clave${keysList.length > 1 ? 's' : ''} en la Party`
                    : 'Modo Actual: Motor Procedural Local (Offline)'}
                </span>
                <p className="text-[11px] text-stone-400 font-normal">
                  {keysList.length > 0
                    ? 'El uso gratuito depende de los límites que fije Google. Si se agotan o Gemini se satura, Duncan sigue con el motor local.'
                    : 'Conecta tu cuenta gratuita de Google para que Duncan narre con Gemini.'}
                </p>
              </div>
            </div>

            {keysList.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-[11px] text-red-400 hover:text-red-300 hover:underline shrink-0 ml-2"
              >
                Desconectar
              </button>
            )}
          </div>

          {activeTab === 'connect' ? (
            <>
              {/* 3 Step Guide */}
              <div className="space-y-4">
                <h4 className="font-cinzel text-sm font-bold text-amber-200 flex items-center gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-amber-600/30 text-amber-400 text-xs font-mono">1</span>
                  Guía Rápida para Conectar tu Cuenta Gratis
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* Step 1 */}
                  <div className="p-3.5 rounded-xl bg-[#1a1424] border border-amber-900/30 flex flex-col justify-between">
                    <div>
                      <div className="text-amber-400 text-base mb-1 font-bold">Paso 1</div>
                      <p className="text-xs text-stone-300 mb-3">
                        Abre Google AI Studio con tu cuenta de Gmail (sin tarjeta).
                      </p>
                    </div>
                    <a
                      href="https://aistudio.google.com/app/apikey"
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition-colors shadow"
                    >
                      <span>Abrir AI Studio</span>
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                  </div>

                  {/* Step 2 */}
                  <div className="p-3.5 rounded-xl bg-[#1a1424] border border-amber-900/30 flex flex-col justify-between">
                    <div>
                      <div className="text-amber-400 text-base mb-1 font-bold">Paso 2</div>
                      <p className="text-xs text-stone-300">
                        Pulsa en el botón azul <strong className="text-amber-200">"Create API key"</strong> en la web de Google.
                      </p>
                    </div>
                    <div className="p-2 rounded bg-stone-900/90 border border-stone-800 text-[11px] font-mono text-stone-400 text-center">
                      Copia la clave generada
                    </div>
                  </div>

                  {/* Step 3 */}
                  <div className="p-3.5 rounded-xl bg-[#1a1424] border border-amber-900/30 flex flex-col justify-between">
                    <div>
                      <div className="text-amber-400 text-base mb-1 font-bold">Paso 3</div>
                      <p className="text-xs text-stone-300">
                        Pégala abajo y haz clic en <strong className="text-amber-200">"Probar y Conectar"</strong>.
                      </p>
                    </div>
                    <div className="p-2 rounded bg-stone-900/90 border border-stone-800 text-[11px] font-mono text-emerald-400 text-center flex items-center justify-center gap-1">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>100% Privado en Local</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Form Input */}
              <form onSubmit={handleAddKey} className="p-4 rounded-xl bg-[#181320] border border-amber-900/40 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <div className="sm:col-span-1">
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Etiqueta (opcional)
                    </label>
                    <input
                      type="text"
                      value={newKeyLabel}
                      onChange={(e) => setNewKeyLabel(e.target.value)}
                      placeholder="Ej: Mi Clave, Clave de Alex..."
                      className="w-full bg-[#100d16] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 focus:outline-none focus:border-amber-500 font-sans"
                    />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-semibold text-amber-200 mb-1">
                      Clave de API de Gemini
                    </label>
                    <input
                      type="password"
                      value={newKeyInput}
                      onChange={(e) => setNewKeyInput(e.target.value)}
                      placeholder="Pega aquí tu clave de API"
                      className="w-full bg-[#100d16] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono focus:outline-none focus:border-amber-500"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1">
                  <p className="text-[11px] text-stone-400">
                    Tu clave se guarda exclusivamente en tu navegador (<code className="text-amber-300">localStorage</code>).
                  </p>
                  <button
                    type="submit"
                    disabled={testStatus?.loading}
                    className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                  >
                    {testStatus?.loading ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    <span>{testStatus?.loading ? 'Comprobando...' : 'Probar y Conectar'}</span>
                  </button>
                </div>

                {/* Validation Feedback */}
                {testStatus && (
                  <div className={`p-3 rounded-lg text-xs flex items-start gap-2 ${
                    testStatus.success
                      ? 'bg-emerald-950/40 border border-emerald-800 text-emerald-300'
                      : 'bg-red-950/40 border border-red-800 text-red-300'
                  }`}>
                    {testStatus.success ? <Check className="w-4 h-4 shrink-0 mt-0.5 text-emerald-400" /> : <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-red-400" />}
                    <div className="flex-1 leading-relaxed">
                      {testStatus.msg}
                    </div>
                  </div>
                )}
              </form>
            </>
          ) : (
            /* Party Token Pooling Section */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-gradient-to-br from-[#1a1326] to-[#120d1c] border border-amber-900/40">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-lg bg-amber-600/20 border border-amber-500/40 flex items-center justify-center text-lg text-amber-300 shrink-0">
                    ⚡
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-cinzel text-sm font-bold text-amber-200">
                      Multi-Jugador: Suma de Tokens (Token Pooling)
                    </h4>
                    <p className="text-xs text-stone-300 leading-relaxed">
                      Si estáis jugando varios amigos en la misma campaña, podéis añadir la clave de cada uno. 
                      Maese Duncan <strong>rotará automáticamente de una cuenta a otra en cada turno</strong> y saltará de clave si alguna agota temporalmente su cuota por minuto.
                    </p>
                    <p className="text-[11px] text-emerald-400 font-mono mt-1">
                      ✓ El contexto de la historia se mantiene al 100% intacto en cada salto.
                    </p>
                  </div>
                </div>

                {/* Pool summary (real limits are set by Google and change over time) */}
                <div className="mt-4 pt-3 border-t border-amber-950/60 flex items-center justify-between gap-3 text-xs">
                  <span className="text-[10px] text-stone-400 font-mono">CLAVES ACTIVAS</span>
                  <span className="text-base font-bold text-amber-300">{keysList.length}</span>
                </div>
                <p className="mt-2 text-[11px] text-stone-500">
                  Con varias claves, la taberna las va alternando para repartir la cuota gratuita de cada una.
                </p>
              </div>

              {/* Add Key to Pool */}
              <form onSubmit={handleAddKey} className="flex gap-2">
                <input
                  type="text"
                  value={newKeyLabel}
                  onChange={(e) => setNewKeyLabel(e.target.value)}
                  placeholder="Nombre / Jugador"
                  className="w-1/3 bg-[#100d16] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-sans"
                />
                <input
                  type="password"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  placeholder="Pegar clave de API de Gemini..."
                  className="flex-1 bg-[#100d16] border border-stone-700 rounded-lg px-3 py-2 text-xs text-stone-100 font-mono"
                />
                <button
                  type="submit"
                  disabled={testStatus?.loading}
                  className="px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs shrink-0 flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  <span>Añadir</span>
                </button>
              </form>

              {/* Active Keys List */}
              <div className="space-y-2">
                <div className="text-xs font-mono text-stone-400">
                  CLAVES REGISTRADAS EN LA PARTY ({keysList.length})
                </div>

                {keysList.length === 0 ? (
                  <div className="p-4 rounded-xl bg-stone-900/30 border border-stone-800 text-center text-xs text-stone-400">
                    Aún no hay claves añadidas. Puedes añadir la tuya en la pestaña "Paso a Paso".
                  </div>
                ) : (
                  keysList.map((item, idx) => (
                    <div
                      key={item.id || idx}
                      className="p-3 rounded-xl bg-[#181322] border border-amber-900/30 flex items-center justify-between text-xs"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-6 h-6 rounded-md bg-amber-950/80 border border-amber-700/50 flex items-center justify-center text-amber-400 font-mono text-xs font-bold">
                          {idx + 1}
                        </div>
                        <div>
                          <div className="font-semibold text-stone-200">{item.label}</div>
                          <div className="text-[11px] font-mono text-stone-400">
                            {item.key.slice(0, 8)}••••••••••••{item.key.slice(-4)}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-400 border border-emerald-800">
                          15 req/min
                        </span>
                        <button
                          onClick={() => handleRemoveKey(item.id)}
                          className="p-1.5 rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800/80 transition-colors"
                          title="Eliminar clave del grupo"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-[#100d14] border-t border-amber-950/40 flex items-center justify-between">
          <div className="text-[11px] text-stone-400 flex items-center gap-1.5">
            <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
            <span>Google AI Studio es gratis y no requiere suscripción.</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs transition-colors shadow-md"
          >
            Aceptar y Continuar
          </button>
        </div>

      </div>
    </div>
  );
}
