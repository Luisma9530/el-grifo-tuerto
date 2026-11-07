import React, { useState, useEffect } from 'react';
import { Download, X, ShieldAlert } from 'lucide-react';
import { getAllCampaigns, exportAllCampaignsAsJson } from '../utils/campaignStorage';
import {
  shouldShowBackupReminder,
  getExportTimes,
  getReminderDismissedAt,
  dismissBackupReminder
} from '../utils/backupReminder';

/**
 * Small dismissible card reminding the player to export a JSON backup,
 * since campaigns are only stored in this browser.
 * `refreshKey` lets the parent re-evaluate it (e.g. when campaigns change).
 */
export default function BackupReminder({ refreshKey }) {
  const [state, setState] = useState({ show: false, pending: [] });

  useEffect(() => {
    setState(shouldShowBackupReminder({
      campaigns: getAllCampaigns(),
      exports: getExportTimes(),
      dismissedAt: getReminderDismissedAt()
    }));
  }, [refreshKey]);

  if (!state.show) return null;

  const count = state.pending.length;

  const handleExport = () => {
    exportAllCampaignsAsJson();
    setState({ show: false, pending: [] });
  };

  const handleDismiss = () => {
    dismissBackupReminder();
    setState({ show: false, pending: [] });
  };

  return (
    <div
      role="status"
      className="fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:bottom-6 sm:max-w-sm z-40 rounded-xl bg-[#1a1522]/95 backdrop-blur border border-amber-700/50 shadow-2xl shadow-black/60 p-4"
    >
      <button
        onClick={handleDismiss}
        className="absolute top-2 right-2 p-1 rounded-md text-stone-500 hover:text-stone-200 hover:bg-stone-800"
        aria-label="Cerrar recordatorio"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex gap-3 pr-5">
        <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <p className="font-cinzel text-sm font-bold text-amber-100">Haz una copia de tus partidas</p>
          <p className="text-xs text-stone-400 mt-1 leading-relaxed">
            Tienes {count} partida{count === 1 ? '' : 's'} con progreso sin copia de seguridad.
            Solo se guardan en este navegador: si borras sus datos, se perderán.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-end gap-2 mt-3">
        <button
          onClick={handleDismiss}
          className="px-3 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800"
        >
          Recordármelo luego
        </button>
        <button
          onClick={handleExport}
          className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-stone-950 text-xs font-bold flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Exportar todo
        </button>
      </div>
    </div>
  );
}
