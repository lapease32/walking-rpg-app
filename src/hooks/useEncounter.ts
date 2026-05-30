import { useState, useRef, useEffect, MutableRefObject } from 'react';
import { Alert, AppStateStatus } from 'react-native';
import { Player } from '../models/Player';
import { Encounter, Location } from '../models/Encounter';
import { Creature } from '../models/Creature';
import LocationService, { LocationData, DistanceData } from '../services/LocationService';
import EncounterService from '../services/EncounterService';
import NotificationService from '../services/NotificationService';
import AnalyticsService from '../services/AnalyticsService';
import { dropItem } from '../services/LootService';
import {
  loadPendingEncounter,
  clearPendingEncounter,
  savePendingEncounter,
  EncounterData,
} from '../utils/storage';
import { ENCOUNTER_CONFIG } from '../constants/config';
import {
  Ability,
  BuffDebuffAbility,
  CombatantState,
  StatusEffect,
  RESOURCE_CONFIGS,
  initCombatState,
  regenResource,
  resolveAbility,
  tickStatusEffects,
  computeEffectiveStats,
} from '../models/Ability';
import { applyResistance } from '../models/DamageType';

interface UseEncounterParams {
  playerRef: MutableRefObject<Player | null>;
  setPlayerAndSave: (player: Player) => void;
  appStateRef: MutableRefObject<AppStateStatus>;
  currentLocationRef: MutableRefObject<LocationData | null>;
}

export function useEncounter({
  playerRef,
  setPlayerAndSave,
  appStateRef,
  currentLocationRef,
}: UseEncounterParams) {
  const [currentEncounter, setCurrentEncounter] = useState<Encounter | null>(null);
  const [showEncounterModal, setShowEncounterModal] = useState<boolean>(false);
  const [showCombatModal, setShowCombatModal] = useState<boolean>(false);
  const [isEncounterModalMinimized, setIsEncounterModalMinimized] = useState<boolean>(false);
  const [encounterChance, setEncounterChance] = useState<number>(0);
  const [lastEncounterChance, setLastEncounterChance] = useState<number | null>(null);
  const [isTimeBlocking, setIsTimeBlocking] = useState<boolean>(false);
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [bypassTimeConstraint, setBypassTimeConstraint] = useState<boolean>(false);
  const [forceItemDrop, setForceItemDrop] = useState<boolean>(false);
  const [playerCombatState, setPlayerCombatState] = useState<CombatantState | null>(null);
  const [creatureCombatState, setCreatureCombatState] = useState<CombatantState | null>(null);

  const victoryProcessedRef = useRef<boolean>(false);
  const fleeProcessedRef = useRef<boolean>(false);
  const isCheckingPendingEncounterRef = useRef<boolean>(false);
  const isProcessingNotificationTapRef = useRef<boolean>(false);
  const encounterRef = useRef<Encounter | null>(null);
  const isMinimizedRef = useRef<boolean>(false);
  const showCombatModalRef = useRef<boolean>(false);
  // Synchronous resource tracker — mirrors playerCombatState.resource but updated
  // immediately on ability use to prevent stale-closure double-spend.
  const playerResourceRef = useRef<number>(0);

  useEffect(() => {
    encounterRef.current = currentEncounter;
  }, [currentEncounter]);

  useEffect(() => {
    isMinimizedRef.current = isEncounterModalMinimized;
  }, [isEncounterModalMinimized]);

  useEffect(() => {
    showCombatModalRef.current = showCombatModal;
  }, [showCombatModal]);

  useEffect(() => {
    playerResourceRef.current = playerCombatState?.resource ?? 0;
  }, [playerCombatState]);

  useEffect(() => {
    setEncounterChance(EncounterService.getDistanceBasedProbability());
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
    setBypassTimeConstraint(EncounterService.isTimeConstraintBypassed());
  }, []);

  useEffect(() => {
    EncounterService.setBypassTimeConstraint(bypassTimeConstraint);
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  }, [bypassTimeConstraint]);

  useEffect(() => {
    if (!isTimeBlocking) {
      return;
    }

    const updateTimeRemaining = () => {
      const blocking = EncounterService.isTimeConstraintBlocking();
      const remaining = EncounterService.getTimeRemainingUntilEncounter();
      setIsTimeBlocking(blocking);
      setTimeRemaining(remaining);
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    return () => clearInterval(interval);
  }, [isTimeBlocking]);

  const clearEncounter = (): void => {
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    setCurrentEncounter(null);
    setShowEncounterModal(false);
    setShowCombatModal(false);
    setIsEncounterModalMinimized(false);
    setPlayerCombatState(null);
    setCreatureCombatState(null);
  };

  const checkPendingEncounter = async (): Promise<void> => {
    if (isCheckingPendingEncounterRef.current) {
      return;
    }

    isCheckingPendingEncounterRef.current = true;

    try {
      if (encounterRef.current) {
        await clearPendingEncounter();
        return;
      }

      const pendingEncounterData = await loadPendingEncounter();
      if (pendingEncounterData) {
        const creature = new Creature(pendingEncounterData.creature);
        const encounter = new Encounter({
          creature,
          location: pendingEncounterData.location,
          timestamp: pendingEncounterData.timestamp,
          playerLevel: pendingEncounterData.playerLevel,
          status: pendingEncounterData.status,
        });

        encounterRef.current = encounter;
        isMinimizedRef.current = false;
        showCombatModalRef.current = false;
        victoryProcessedRef.current = false;
        fleeProcessedRef.current = false;

        const clearSuccess = await clearPendingEncounter();
        if (!clearSuccess) {
          encounterRef.current = null;
          isMinimizedRef.current = false;
          showCombatModalRef.current = false;
          victoryProcessedRef.current = false;
          fleeProcessedRef.current = false;
          console.error(
            'Failed to clear pending encounter - skipping encounter display to prevent data loss',
          );
          return;
        }

        setCurrentEncounter(encounter);
        setShowEncounterModal(true);
        setIsEncounterModalMinimized(false);
      }
    } catch (error) {
      console.error('Error checking pending encounter:', error);
    } finally {
      isCheckingPendingEncounterRef.current = false;
    }
  };

  const handleVictory = (playerToUse?: Player): void => {
    const basePlayer = playerToUse || playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !basePlayer) {
      return;
    }

    if (victoryProcessedRef.current) {
      return;
    }

    victoryProcessedRef.current = true;

    const updatedPlayer = new Player(basePlayer.toJSON());
    updatedPlayer.defeatCreature();
    updatedPlayer.incrementEncounters();

    const expGain = currentEncounterState.creature.getExperienceReward();
    const levelsGained = updatedPlayer.addExperience(expGain);

    const droppedItem = dropItem(forceItemDrop);
    let lootMessage = '';
    if (droppedItem) {
      const inventoryIndex = updatedPlayer.addItemToInventory(droppedItem);
      if (inventoryIndex === -1) {
        lootMessage = `\n\n⚠️ Received ${droppedItem.name} but inventory is full!`;
      } else {
        lootMessage = `\n\n✨ Received ${droppedItem.name}!`;
      }
    }

    updatedPlayer.fullHeal();

    setPlayerAndSave(updatedPlayer);
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    fleeProcessedRef.current = false;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);
    setCreatureCombatState(null);

    AnalyticsService.combatVictory(
      currentEncounterState.creature.name,
      basePlayer.level,
      expGain,
      !!droppedItem,
      levelsGained > 0,
    );
    if (levelsGained > 0) {
      AnalyticsService.levelUp(updatedPlayer.level);
      Alert.alert(
        'Victory & Level Up!',
        `You defeated ${currentEncounterState.creature.name}!\nGained ${expGain} XP\nReached level ${updatedPlayer.level}!${lootMessage}`,
      );
    } else {
      Alert.alert(
        'Victory!',
        `You defeated ${currentEncounterState.creature.name} and gained ${expGain} XP!${lootMessage}`,
      );
    }
  };

  const handleFlee = (): void => {
    if (fleeProcessedRef.current) {
      return;
    }

    fleeProcessedRef.current = true;

    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;

    if (currentEncounterState && currentPlayer) {
      AnalyticsService.combatFled(currentEncounterState.creature.name, currentPlayer.level);
      const updatedPlayer = new Player(currentPlayer.toJSON());
      updatedPlayer.incrementEncounters();
      updatedPlayer.fullHeal();
      setPlayerAndSave(updatedPlayer);
    }
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);
    setCreatureCombatState(null);
  };

  const handleFight = (): void => {
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    if (currentPlayer.isDefeated()) {
      return;
    }

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      handleVictory();
      return;
    }

    showCombatModalRef.current = true;
    setShowCombatModal(true);
    // Only initialize once per encounter — preserves accumulated resource/status
    // if the player closes and reopens the combat modal within the same encounter.
    setPlayerCombatState(prev => prev ?? initCombatState(currentPlayer.archetype));
    setCreatureCombatState(prev => prev ?? { statusEffects: [], resource: 0 });
    // Sync resource ref immediately so handleAbility guards work before the first
    // useEffect fires (useEffect runs after paint; ref would otherwise stay at 0
    // for Agile/Mage whose start value is non-zero).
    if (playerCombatState === null) {
      playerResourceRef.current = RESOURCE_CONFIGS[currentPlayer.archetype].startValue;
    }
    AnalyticsService.combatStarted(creature.name, currentPlayer.level);
  };

  const handleAbility = (ability: Ability): boolean => {
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;

    if (!currentEncounterState || !currentPlayer) return false;
    if (victoryProcessedRef.current) return false;

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      handleVictory();
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      return false;
    }

    // Fix 4: synchronous ref check prevents stale-closure double-spend.
    if (ability.resourceCost > playerResourceRef.current) return false;

    const updatedPlayer = new Player(currentPlayer.toJSON());

    // Fix 6: compute effective stats from PRE-tick effects so the active turn
    // benefits from all buffs including those expiring this turn (e.g. Battle Cry
    // at tickDuration=3 gives exactly 3 buffed turns, not 2).
    const currentPlayerState = playerCombatState;
    const playerEffective = computeEffectiveStats(
      updatedPlayer.attack,
      updatedPlayer.defense,
      currentPlayerState?.statusEffects ?? [],
    );

    // Tick creature DoT effects with per-type resistance applied.
    let newCreatureState = creatureCombatState;
    if (newCreatureState && newCreatureState.statusEffects.length > 0) {
      const { dotEffects, updatedState } = tickStatusEffects(newCreatureState);
      let resistedDot = 0;
      for (const { damage, damageType } of dotEffects) {
        resistedDot += applyResistance(
          damage,
          damageType ? (creature.resistances[damageType] ?? 0) : 0,
        );
      }
      if (resistedDot > 0) creature.takeDamage(resistedDot);
      newCreatureState = updatedState;
    }

    // DoT killed creature — return false (queued ability never ran, no cooldown).
    // Fix 5: persist player tick (durations) even though we return early.
    if (creature.isDefeated()) {
      setPlayerCombatState(prev => {
        const base = prev ?? currentPlayerState;
        if (!base || base.statusEffects.length === 0) return base;
        return tickStatusEffects(base).updatedState;
      });
      setCreatureCombatState(prev => newCreatureState ?? prev);
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      setShowEncounterModal(false);
      handleVictory(updatedPlayer);
      return false;
    }

    const creatureEffectiveDefense = computeEffectiveStats(
      0,
      creature.defense,
      newCreatureState?.statusEffects ?? [],
    ).defense;
    const creatureEffectiveAttack = computeEffectiveStats(
      creature.attack,
      0,
      newCreatureState?.statusEffects ?? [],
    ).attack;

    const abilityResult = resolveAbility(
      ability,
      playerEffective.attack,
      creatureEffectiveDefense,
      creature.resistances,
      updatedPlayer.maxHp,
    );

    creature.takeDamage(abilityResult.damage);
    if (abilityResult.heal > 0) updatedPlayer.restoreHp(abilityResult.heal);

    // Route applied effects to the right combatant.
    const selfEffects: StatusEffect[] = [];
    const enemyEffects: StatusEffect[] = [];
    for (const effect of abilityResult.appliedEffects) {
      if (ability.primitive === 'buff_debuff' && (ability as BuffDebuffAbility).targetSelf) {
        selfEffects.push(effect);
      } else {
        enemyEffects.push(effect);
      }
    }

    // Update resource ref synchronously for the next tap's guard check.
    const costAmount = ability.resourceCost;
    const archetype = updatedPlayer.archetype;
    const estimatedResource = Math.min(
      RESOURCE_CONFIGS[archetype].max,
      Math.max(0, (currentPlayerState?.resource ?? 0) - costAmount) +
        RESOURCE_CONFIGS[archetype].regenPerTurn,
    );
    playerResourceRef.current = estimatedResource;

    // Fix 3 + Fix 4 + Fix 6: player tick moved inside functional updater so it
    // applies to `prev` (the latest committed state), not the closure snapshot.
    // This makes rapid-tap sequencing correct and preserves PRE-tick stats above.
    const capturedSelfEffects = selfEffects;
    setPlayerCombatState(prev => {
      const base = prev ?? currentPlayerState;
      if (!base) return null;
      const { updatedState: ticked } =
        base.statusEffects.length > 0 ? tickStatusEffects(base) : { updatedState: base };
      const afterCost = { ...ticked, resource: Math.max(0, ticked.resource - costAmount) };
      const regenedState = regenResource(afterCost, archetype);
      return capturedSelfEffects.length > 0
        ? {
            ...regenedState,
            statusEffects: [...regenedState.statusEffects, ...capturedSelfEffects],
          }
        : regenedState;
    });

    // Fix 2: functional update prevents concurrent ability calls from losing enemy effects.
    setCreatureCombatState(prev => {
      const base = newCreatureState ?? prev ?? { statusEffects: [], resource: 0 };
      return enemyEffects.length > 0
        ? { ...base, statusEffects: [...base.statusEffects, ...enemyEffects] }
        : base;
    });

    // Creature counter-attacks using effective stats (debuffs on creature attack apply here).
    if (!creature.isDefeated()) {
      const creatureDamage = Math.max(1, creatureEffectiveAttack - playerEffective.defense);
      updatedPlayer.takeDamage(creatureDamage);
    }

    setPlayerAndSave(updatedPlayer);

    const updatedEncounter = new Encounter({
      creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    if (creature.isDefeated()) {
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      setShowEncounterModal(false);
      handleVictory(updatedPlayer);
    } else if (updatedPlayer.isDefeated()) {
      const healedPlayer = new Player(updatedPlayer.toJSON());
      healedPlayer.fullHeal();
      healedPlayer.incrementEncounters();

      setPlayerAndSave(healedPlayer);
      encounterRef.current = null;
      isMinimizedRef.current = false;
      showCombatModalRef.current = false;
      setIsEncounterModalMinimized(false);
      setShowCombatModal(false);
      setShowEncounterModal(false);
      setCurrentEncounter(null);
      setPlayerCombatState(null);
      setCreatureCombatState(null);
      playerResourceRef.current = 0;
      AnalyticsService.combatDefeated(creature.name, updatedPlayer.level);

      Alert.alert(
        'Defeated!',
        'You have been defeated! Your HP has been restored to full.',
        [{ text: 'OK' }],
        { cancelable: false },
      );
    }

    return true;
  };

  const handleDebugDefeat = (): void => {
    const currentEncounterState = encounterRef.current;
    const currentPlayer = playerRef.current;

    if (!currentEncounterState || !currentPlayer) {
      return;
    }

    if (victoryProcessedRef.current) {
      return;
    }

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      return;
    }

    creature.takeDamage(creature.hp);

    const updatedEncounter = new Encounter({
      creature,
      location: currentEncounterState.location,
      timestamp: currentEncounterState.timestamp,
      playerLevel: currentEncounterState.playerLevel,
      status: currentEncounterState.status,
    });

    encounterRef.current = updatedEncounter;
    setCurrentEncounter(updatedEncounter);

    showCombatModalRef.current = false;
    setShowCombatModal(false);
    setShowEncounterModal(false);
    handleVictory(currentPlayer);
  };

  const handleMinimize = (): void => {
    isMinimizedRef.current = true;
    setIsEncounterModalMinimized(true);
    setShowEncounterModal(false);
  };

  const handleCloseCombatModal = (): void => {
    showCombatModalRef.current = false;
    setShowCombatModal(false);
  };

  const handleExpandMinimized = (): void => {
    isMinimizedRef.current = false;
    setIsEncounterModalMinimized(false);
    setShowEncounterModal(true);
  };

  const forceEncounter = (): void => {
    const currentLocationData = currentLocationRef.current;
    const currentPlayer = playerRef.current;

    const location: Location = currentLocationData
      ? {
          latitude: currentLocationData.latitude,
          longitude: currentLocationData.longitude,
        }
      : {
          latitude: 37.7749,
          longitude: -122.4194,
        };

    const encounter = EncounterService.forceEncounter(location, currentPlayer?.level || 1);

    encounterRef.current = encounter;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    victoryProcessedRef.current = false;
    fleeProcessedRef.current = false;

    setPlayerCombatState(null);
    setCreatureCombatState(null);
    setCurrentEncounter(encounter);
    setShowEncounterModal(true);
    setIsEncounterModalMinimized(false);
    setEncounterChance(0);
    const blocking = EncounterService.isTimeConstraintBlocking();
    setIsTimeBlocking(blocking);
    setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
  };

  const onDistanceEncounterUpdate = async (
    distanceData: DistanceData,
    currentPlayer: Player | null,
  ): Promise<void> => {
    const { location } = distanceData;

    const currentEncounterState = encounterRef.current;
    const isMinimized = isMinimizedRef.current;
    const isInCombat = showCombatModalRef.current;

    if (currentEncounterState && isMinimized && location && !isInCombat) {
      const encounterLocation = currentEncounterState.location;
      const distanceFromEncounter = LocationService.calculateDistance(
        encounterLocation.latitude,
        encounterLocation.longitude,
        location.latitude,
        location.longitude,
      );

      if (distanceFromEncounter > ENCOUNTER_CONFIG.AUTO_FLEE_DISTANCE) {
        Alert.alert(
          'Encounter Ended',
          `You traveled too far from the encounter location. The ${currentEncounterState.creature.name} has fled.`,
          [{ text: 'OK' }],
        );
        handleFlee();
        return;
      }
    }

    if (currentEncounterState) {
      return;
    }

    if (location) {
      const locationForEncounter: Location = {
        latitude: location.latitude,
        longitude: location.longitude,
      };

      const probabilityThatWillBeUsed = EncounterService.getProbabilityAfterIncremental(
        distanceData.incremental,
      );

      const encounter = EncounterService.processDistanceUpdate(
        distanceData,
        locationForEncounter,
        currentPlayer?.level || 1,
      );

      if (encounter) {
        AnalyticsService.encounterTriggered(
          encounter.creature.name,
          encounter.creature.level,
          encounter.playerLevel,
        );
        const isInBackground = appStateRef.current !== 'active';

        if (isInBackground) {
          try {
            const existingPendingEncounter = await loadPendingEncounter();
            if (existingPendingEncounter) {
              console.warn(
                'Background encounter already pending, skipping new encounter to prevent overwrite',
              );
              return;
            }

            const encounterData: EncounterData = {
              creature: {
                id: encounter.creature.id,
                name: encounter.creature.name,
                type: encounter.creature.type,
                level: encounter.creature.level,
                hp: encounter.creature.hp,
                maxHp: encounter.creature.maxHp,
                attack: encounter.creature.attack,
                defense: encounter.creature.defense,
                speed: encounter.creature.speed,
                rarity: encounter.creature.rarity,
                description: encounter.creature.description,
                encounterRate: encounter.creature.encounterRate,
              },
              location: encounter.location,
              timestamp: encounter.timestamp,
              playerLevel: encounter.playerLevel,
              status: encounter.status,
            };
            const saveSuccess = await savePendingEncounter(encounterData);

            if (!saveSuccess) {
              console.error(
                'Failed to save pending encounter, skipping ref update and notification',
              );
              return;
            }

            await NotificationService.showEncounterNotification(encounter);
          } catch (error) {
            console.error('Error handling background encounter:', error);
          }
        } else {
          encounterRef.current = encounter;
          isMinimizedRef.current = false;
          showCombatModalRef.current = false;
          victoryProcessedRef.current = false;
          fleeProcessedRef.current = false;

          setCurrentEncounter(encounter);
          setShowEncounterModal(true);
          setIsEncounterModalMinimized(false);
        }

        setEncounterChance(0);
        setLastEncounterChance(probabilityThatWillBeUsed);
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      } else {
        setEncounterChance(EncounterService.getDistanceBasedProbability());
        const blocking = EncounterService.isTimeConstraintBlocking();
        setIsTimeBlocking(blocking);
        setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
      }
    } else {
      setEncounterChance(EncounterService.getDistanceBasedProbability());
      const blocking = EncounterService.isTimeConstraintBlocking();
      setIsTimeBlocking(blocking);
      setTimeRemaining(EncounterService.getTimeRemainingUntilEncounter());
    }
  };

  return {
    currentEncounter,
    showEncounterModal,
    setShowEncounterModal,
    showCombatModal,
    setShowCombatModal,
    isEncounterModalMinimized,
    setIsEncounterModalMinimized,
    encounterChance,
    lastEncounterChance,
    isTimeBlocking,
    timeRemaining,
    bypassTimeConstraint,
    setBypassTimeConstraint,
    forceItemDrop,
    setForceItemDrop,
    playerCombatState,
    isProcessingNotificationTapRef,
    checkPendingEncounter,
    handleFight,
    handleAbility,
    handleDebugDefeat,
    handleMinimize,
    handleCloseCombatModal,
    handleExpandMinimized,
    handleFlee,
    forceEncounter,
    onDistanceEncounterUpdate,
    clearEncounter,
  };
}
