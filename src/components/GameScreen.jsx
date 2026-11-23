import React, { useMemo } from 'react';
import TavernApp from './TavernApp';
import { migrateCampaign } from '../utils/campaignStorage';

/**
 * The game screen, loaded on demand (it carries Duncan's engine, the combat
 * rules and the online room). The landing page reads saved campaigns raw to
 * stay light: the campaign is brought up to date here, before the game sees it.
 */
export default function GameScreen({ activeCampaign = null, ...props }) {
  const campaign = useMemo(() => (activeCampaign ? migrateCampaign(activeCampaign) : null), [activeCampaign]);
  return <TavernApp activeCampaign={campaign} {...props} />;
}
