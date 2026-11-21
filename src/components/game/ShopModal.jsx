import React, { useState } from 'react';
import { X, Coins, ShoppingBag, HandCoins, AlertTriangle } from 'lucide-react';
import { useEscapeKey } from '../../hooks/useEscapeKey';
import { SHOP_TYPES, shopRows, shopBuys, sellPrice } from '../../utils/shops';
import { formatCoins, formatKg, describeEntry, catalogByKey } from '../../utils/items';
import { isArmorTrained, isHeld, isWorn } from '../../utils/equipment';

/**
 * A shop's counter: buy at SRD prices, sell at half. Everything is computed by
 * the game (utils/shops.js); this only shows it.
 * onBuy(key) / onSell(itemId) return an error message or null.
 */
export default function ShopModal({ shop, character, onBuy, onSell, onClose }) {
  const [tab, setTab] = useState('buy');
  const [error, setError] = useState('');
  useEscapeKey(true, onClose);
  const type = SHOP_TYPES[shop.type];
  const rows = shopRows(shop);
  const gold = Number(character.gold) || 0;
  const sellable = (character.inventory || []).filter(item => shopBuys(shop, item));

  const run = result => setError(result || '');

  const warning = row => {
    if (row.kind !== 'armor') return null;
    if (!isArmorTrained(character, row.data)) return 'No tienes competencia con ella';
    if (row.data.strength && (Number(character.stats?.fue) || 10) < row.data.strength) return `Pide Fuerza ${row.data.strength}`;
    return null;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={type.name}>
      <div className="w-full max-w-lg rounded-2xl bg-[#141019] border-2 border-amber-700/50 shadow-2xl relative max-h-[90vh] flex flex-col">
        <div className="p-4 border-b border-amber-950/60">
          <button onClick={onClose} aria-label="Cerrar la tienda" className="absolute top-3 right-3 p-2 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-stone-800">
            <X className="w-5 h-5" />
          </button>
          <h2 className="font-cinzel font-bold text-amber-200 text-base pr-8">{type.icon} {type.name}</h2>
          <p className="text-[11px] text-stone-400">{shop.place} · Compras al precio del SRD y vendes a la mitad.</p>
          <p className="mt-1.5 text-xs text-yellow-300 font-mono flex items-center gap-1.5"><Coins className="w-3.5 h-3.5" /> Tienes {formatCoins(gold)}</p>
          <div className="mt-3 flex gap-1.5 text-xs font-semibold">
            {[['buy', 'Comprar', <ShoppingBag key="i" className="w-3.5 h-3.5" />], ['sell', 'Vender', <HandCoins key="i" className="w-3.5 h-3.5" />]].map(([id, label, icon]) => (
              <button key={id} onClick={() => { setTab(id); setError(''); }}
                className={`flex-1 py-1.5 rounded-lg border flex items-center justify-center gap-1.5 ${tab === id ? 'bg-amber-600/20 border-amber-500/60 text-amber-200' : 'bg-stone-900 border-stone-800 text-stone-400'}`}>
                {icon} {label}
              </button>
            ))}
          </div>
          {error && <p role="alert" className="mt-2 text-[11px] text-red-300">{error}</p>}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {tab === 'buy' && (rows.length === 0
            ? <p className="text-xs text-stone-500 italic p-2">El tendero se encoge de hombros: no le queda nada.</p>
            : rows.map(row => {
              const note = warning(row);
              return (
                <div key={row.key} className="p-2.5 rounded-xl bg-[#17131f] border border-stone-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-100">{row.name} <span className="font-normal text-stone-500">× {row.qty}</span></p>
                    <p className="text-[10px] text-stone-400">{describeEntry(catalogByKey(row.key))}{row.weight ? ` · ${formatKg(row.weight)}` : ''}</p>
                    {note && <p className="text-[10px] text-amber-300 flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> {note}</p>}
                  </div>
                  <button onClick={() => run(onBuy(row.key))} disabled={gold < row.price}
                    className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-40 text-stone-950 text-[11px] font-bold font-mono shrink-0">
                    {formatCoins(row.price)}
                  </button>
                </div>
              );
            }))}

          {tab === 'sell' && (sellable.length === 0
            ? <p className="text-xs text-stone-500 italic p-2">No llevas nada que aquí quieran comprar.</p>
            : sellable.map(item => {
              const equipped = isHeld(character, item.id) || isWorn(character, item.id);
              const price = sellPrice(shop, item);
              return (
                <div key={item.id} className="p-2.5 rounded-xl bg-[#17131f] border border-stone-800 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-stone-100">{item.name}{item.uses > 1 ? <span className="font-normal text-stone-500"> × {item.uses}</span> : null}</p>
                    <p className="text-[10px] text-stone-400">
                      {equipped ? 'Lo llevas puesto o en la mano: guárdalo antes en la mochila.' : item.uses > 1 ? 'Vendes una' : item.desc || item.effect}
                    </p>
                  </div>
                  <button onClick={() => run(onSell(item.id))} disabled={equipped}
                    className="px-2.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-600 disabled:opacity-40 text-stone-50 text-[11px] font-bold font-mono shrink-0">
                    +{formatCoins(price)}
                  </button>
                </div>
              );
            }))}
        </div>
      </div>
    </div>
  );
}
