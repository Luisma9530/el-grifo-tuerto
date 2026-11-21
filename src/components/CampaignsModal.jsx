import React, { useState, useEffect, useRef } from 'react';
import { formatCoins } from '../utils/items';
import { useEscapeKey } from '../hooks/useEscapeKey';
import { 
  X, BookOpen, Plus, Download, Upload, Trash2, Copy, Play, 
  Clock, Shield, Coins, Sparkles, Check, AlertCircle, FileText 
} from 'lucide-react';
import { 
  getAllCampaigns, 
  deleteCampaign, 
  duplicateCampaign, 
  exportCampaignAsJson, 
  exportAllCampaignsAsJson, 
  importCampaignsFromJson
} from '../utils/campaignStorage';
import { getLastBackupAt } from '../utils/backupReminder';
import { formatLastPlayed } from '../utils/saveSlots';
import { PRESET_WORLDS } from '../data/gameData';

export default function CampaignsModal({ 
  isOpen, 
  onClose, 
  activeCampaignId, 
  onSelectCampaign,
  onStartNewCampaign
}) {
  useEscapeKey(isOpen, onClose);
  const [campaigns, setCampaigns] = useState([]);
  const [notification, setNotification] = useState(null);
  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const [newWorldId, setNewWorldId] = useState(PRESET_WORLDS[0].id);
  const [newTitle, setNewTitle] = useState('');
  const fileInputRef = useRef(null);
  const [lastBackupAt, setLastBackupAt] = useState(null);

  // Load campaigns whenever modal opens
  useEffect(() => {
    if (isOpen) {
      refreshCampaigns();
      setIsCreatingNew(false);
      setNotification(null);
      setLastBackupAt(getLastBackupAt());
    }
  }, [isOpen]);

  const refreshCampaigns = () => {
    const list = getAllCampaigns();
    setCampaigns(list);
  };

  const showNotification = (msg, type = 'success') => {
    setNotification({ msg, type });
    setTimeout(() => setNotification(null), 3500);
  };

  if (!isOpen) return null;

  // Handle Delete
  const handleDelete = (campaign, e) => {
    e.stopPropagation();
    if (window.confirm(`¿Seguro que deseas eliminar la campaña "${campaign.title}"? Esta acción no se puede deshacer a menos que tengas un backup JSON.`)) {
      deleteCampaign(campaign.id);
      refreshCampaigns();
      showNotification('Campaña eliminada.', 'info');
    }
  };

  // Handle Duplicate
  const handleDuplicate = (campaign, e) => {
    e.stopPropagation();
    const cloned = duplicateCampaign(campaign.id);
    if (cloned) {
      refreshCampaigns();
      showNotification(`Rama creada: "${cloned.title}"`);
    }
  };

  // Handle Export Single
  const handleExportSingle = (campaign, e) => {
    e.stopPropagation();
    exportCampaignAsJson(campaign.id);
    setLastBackupAt(getLastBackupAt());
    showNotification(`Archivo exportado: ${campaign.title}.json`);
  };

  // Handle Import File
  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const result = importCampaignsFromJson(text);
        if (result.success) {
          refreshCampaigns();
          showNotification(`¡Éxito! Se han importado ${result.count} campaña(s).`);
          if (result.lastImportedId && onSelectCampaign) {
            const imported = getAllCampaigns().find(c => c.id === result.lastImportedId);
            if (imported) {
              onSelectCampaign(imported);
              onClose();
            }
          }
        } else {
          showNotification(result.error || 'Error al importar archivo.', 'error');
        }
      }
    };
    reader.readAsText(file);
    // Reset input
    e.target.value = '';
  };

  // A new campaign continues in the character creation wizard
  const handleConfirmCreate = (e) => {
    e.preventDefault();
    const chosenWorld = PRESET_WORLDS.find(w => w.id === newWorldId) || PRESET_WORLDS[0];
    setIsCreatingNew(false);
    onStartNewCampaign?.(chosenWorld, newTitle.trim());
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-2xl bg-[#131018] border-2 border-amber-900/50 shadow-2xl relative overflow-hidden">
        
        {/* Top Header */}
        <div className="p-5 sm:p-6 border-b border-amber-950/60 flex items-center justify-between shrink-0 bg-[#16121d]">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-amber-950/60 border border-amber-700/50 flex items-center justify-center text-2xl shadow-inner">
              📖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel text-xl sm:text-2xl font-bold text-amber-100">
                  Grimorio de Campañas
                </h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {campaigns.length} {campaigns.length === 1 ? 'partida' : 'partidas'}
                </span>
              </div>
              <p className="text-xs text-stone-400 font-mono">
                MEMORIA PERSISTENTE LOCAL & BACKUPS JSON
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-850 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar */}
        <div className="px-5 py-3 bg-[#181420] border-b border-stone-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsCreatingNew(!isCreatingNew)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all shadow-sm ${
                isCreatingNew 
                  ? 'bg-stone-800 text-stone-300 border border-stone-700' 
                  : 'bg-amber-600 hover:bg-amber-500 text-stone-950'
              }`}
            >
              <Plus className="w-4 h-4" />
              <span>{isCreatingNew ? 'Ver Lista' : 'Nueva Campaña'}</span>
            </button>

            {/* Hidden file input for JSON import */}
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleFileChange} 
              accept=".json" 
              className="hidden" 
            />

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-amber-900/40 text-stone-300 hover:text-amber-300 transition-colors"
              title="Cargar archivo .json desde tu ordenador"
            >
              <Upload className="w-3.5 h-3.5 text-amber-400" />
              <span>Importar JSON</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {campaigns.length > 0 && (
              <button
                onClick={() => {
                  exportAllCampaignsAsJson();
                  setLastBackupAt(getLastBackupAt());
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-300 hover:text-emerald-400 transition-colors"
                title="Descargar una copia de seguridad de todas tus partidas"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar Todas ({campaigns.length})</span>
              </button>
            )}
          </div>
        </div>

        {/* Notifications Bar */}
        {notification && (
          <div className={`px-5 py-2.5 text-xs font-medium flex items-center gap-2 shrink-0 animate-in slide-in-from-top-2 ${
            notification.type === 'error' 
              ? 'bg-red-950/80 border-b border-red-800/80 text-red-200' 
              : notification.type === 'info'
              ? 'bg-stone-800 border-b border-stone-700 text-stone-200'
              : 'bg-emerald-950/80 border-b border-emerald-800/80 text-emerald-200'
          }`}>
            {notification.type === 'error' ? (
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            ) : (
              <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            )}
            <span>{notification.msg}</span>
          </div>
        )}

        {/* Main Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-4">
          
          {/* New Campaign Creation Form Sub-view */}
          {isCreatingNew ? (
            <div className="bg-[#181422] border border-amber-900/40 rounded-xl p-5 space-y-5 animate-in fade-in">
              <div className="flex items-center justify-between border-b border-stone-800 pb-3">
                <h4 className="font-cinzel text-base font-bold text-amber-200 flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span>Configurar Nueva Campaña</span>
                </h4>
                <button
                  type="button"
                  onClick={() => setIsCreatingNew(false)}
                  className="text-xs text-stone-400 hover:text-stone-200"
                >
                  Cancelar
                </button>
              </div>

              <form onSubmit={handleConfirmCreate} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono text-stone-400 mb-1">
                    TÍTULO DE LA CAMPAÑA (OPCIONAL):
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="Ej. La Búsqueda de la Corona de Sombras"
                    className="w-full bg-[#120f18] border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-100 placeholder-stone-600 focus:outline-none focus:border-amber-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono text-stone-400 mb-1">
                    MUNDO / AMBIENTACIÓN:
                  </label>
                  <select
                    value={newWorldId}
                    onChange={(e) => setNewWorldId(e.target.value)}
                    className="w-full bg-[#120f18] border border-stone-700 rounded-lg px-3 py-2 text-xs text-amber-200 font-cinzel font-bold focus:outline-none focus:border-amber-500"
                  >
                    {PRESET_WORLDS.map(w => (
                      <option key={w.id} value={w.id}>
                        {w.name} ({w.genre})
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-stone-400">
                  A continuación crearás a tu héroe: clase, trasfondo, especie y características.
                </p>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setIsCreatingNew(false)}
                    className="px-4 py-2 rounded-lg bg-stone-850 hover:bg-stone-800 text-stone-300 text-xs font-semibold"
                  >
                    Volver
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-amber-500 hover:brightness-110 text-stone-950 font-bold text-xs shadow-lg shadow-amber-600/30"
                  >
                    Crear Héroe
                  </button>
                </div>
              </form>
            </div>
          ) : null}

          {/* Campaign Cards List */}
          {campaigns.length === 0 && !isCreatingNew ? (
            <div className="py-12 px-4 text-center rounded-xl border border-dashed border-stone-800 bg-[#16121d]/50">
              <div className="text-4xl mb-3">📜</div>
              <h4 className="font-cinzel text-lg font-bold text-stone-300 mb-2">
                No tienes ninguna campaña guardada aún
              </h4>
              <p className="text-xs text-stone-400 max-w-md mx-auto mb-6 leading-relaxed">
                Cada decisión, tirada de dados y diálogo que vivas en la taberna se guardará aquí de forma automática y privada en tu navegador.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => setIsCreatingNew(true)}
                  className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 font-bold text-xs flex items-center gap-1.5 transition-all shadow-md shadow-amber-600/20"
                >
                  <Plus className="w-4 h-4" />
                  <span>Crear Primera Campaña</span>
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-700 text-stone-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>Importar Archivo JSON</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-3.5">
              {campaigns.map((camp) => {
                const isActive = camp.id === activeCampaignId;
                const formattedDate = new Date(camp.updatedAt || camp.createdAt).toLocaleString([], {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div
                    key={camp.id}
                    className={`rounded-xl border transition-all p-4 sm:p-5 relative group ${
                      isActive 
                        ? 'bg-gradient-to-r from-amber-950/40 via-[#181423] to-[#181423] border-amber-500/70 shadow-lg shadow-amber-900/20' 
                        : 'bg-[#16121e] hover:bg-[#1a1525] border-stone-800/80 hover:border-amber-900/50'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                      
                      {/* Left: Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          {isActive && (
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                              En Curso
                            </span>
                          )}
                          <h4 className="font-cinzel text-base sm:text-lg font-bold text-stone-100 truncate">
                            {camp.title}
                          </h4>
                        </div>

                        {/* Badges Bar: World & Character */}
                        <div className="flex flex-wrap items-center gap-2 text-xs text-stone-400 mb-3">
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-900/80 border border-stone-800 text-stone-300">
                            <span>{camp.character?.avatar || '👤'}</span>
                            <strong className="text-amber-200">{camp.character?.name}</strong>
                            <span>({camp.character?.class})</span>
                          </span>

                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-950/30 border border-amber-900/40 text-amber-300">
                            <span>🌍</span>
                            <span>{camp.world?.name}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400">
                            <Shield className="w-3 h-3 text-red-400" />
                            <span>{camp.character?.hp}/{camp.character?.maxHp} HP</span>
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-400">
                            <Coins className="w-3 h-3 text-yellow-400" />
                            <span>{formatCoins(camp.character?.gold)}</span>
                          </span>

                          <span className="inline-flex items-center gap-1 text-[11px] font-mono text-stone-500 ml-auto hidden sm:inline-flex">
                            <Clock className="w-3 h-3" />
                            <span>{formattedDate}</span>
                          </span>
                        </div>

                        {/* Story snippet preview */}
                        <p className="text-xs text-stone-400/90 italic line-clamp-2 bg-[#100d16] p-2.5 rounded-lg border border-stone-850 font-serif">
                          "{camp.lastPreview || camp.messages?.[camp.messages.length - 1]?.text || 'Sin crónica...'}"
                        </p>
                      </div>

                      {/* Right: Actions */}
                      <div className="flex sm:flex-col items-center justify-end gap-2 shrink-0">
                        <button
                          onClick={() => {
                            if (onSelectCampaign) {
                              onSelectCampaign(camp);
                              onClose();
                            }
                          }}
                          className={`w-full sm:w-auto px-4 py-2 rounded-lg font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md ${
                            isActive
                              ? 'bg-amber-500 hover:bg-amber-400 text-stone-950'
                              : 'bg-amber-600/90 hover:bg-amber-500 text-stone-950'
                          }`}
                        >
                          <Play className="w-3.5 h-3.5 fill-current" />
                          <span>{isActive ? 'Continuar' : 'Cargar'}</span>
                        </button>

                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={(e) => handleExportSingle(camp, e)}
                            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-amber-300 transition-colors"
                            title="Descargar esta campaña como archivo .json"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDuplicate(camp, e)}
                            className="p-2 rounded-lg bg-stone-900 hover:bg-stone-800 border border-stone-800 text-stone-400 hover:text-stone-200 transition-colors"
                            title="Duplicar partida (crear punto de guardado alternativo)"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>

                          <button
                            onClick={(e) => handleDelete(camp, e)}
                            className="p-2 rounded-lg bg-stone-900 hover:bg-red-950/50 border border-stone-800 hover:border-red-800/60 text-stone-500 hover:text-red-400 transition-colors"
                            title="Eliminar partida"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>

        {/* Modal Footer info note */}
        <div className="p-4 bg-[#110e17] border-t border-stone-800 text-center text-xs text-stone-500 font-mono">
          <span>🔒 Privacidad 100% local: las partidas se almacenan en el navegador. Usa "Exportar JSON" para crear copias o llevarlas a otro dispositivo.</span>
          <span className={`block mt-1 ${lastBackupAt ? 'text-stone-400' : 'text-amber-500/80'}`}>
            {lastBackupAt
              ? `Última copia de seguridad: ${formatLastPlayed(lastBackupAt).toLowerCase()}`
              : 'Aún no has hecho ninguna copia de seguridad.'}
          </span>
        </div>

      </div>
    </div>
  );
}
