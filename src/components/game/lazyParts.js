// Parts of the game screen that are not needed to show it: loaded on demand,
// and preloaded while the browser is idle once the game is on screen (so they
// open at once when the player needs them).
import { lazyWithPreload } from '../../utils/lazyWithPreload';

export const CombatView = lazyWithPreload(() => import('./CombatView'));
export const LevelUpModal = lazyWithPreload(() => import('./LevelUpModal'));
export const ShopModal = lazyWithPreload(() => import('./ShopModal'));
export const SpellsTab = lazyWithPreload(() => import('./SpellsTab'));
export const EquipmentPanel = lazyWithPreload(() => import('./EquipmentPanel'));
export const QuestJournal = lazyWithPreload(() => import('./QuestJournal'));
export const DiceRollerTray = lazyWithPreload(() => import('./DiceRollerTray'));
export const HostRoomDrawer = lazyWithPreload(() => import('../online/HostRoomDrawer'));

const ALL = [CombatView, LevelUpModal, ShopModal, SpellsTab, EquipmentPanel, QuestJournal, DiceRollerTray, HostRoomDrawer];

/** Download every part of the game screen (call it when the browser is idle). */
export function preloadGameParts() {
  ALL.forEach(part => part.preload());
}
