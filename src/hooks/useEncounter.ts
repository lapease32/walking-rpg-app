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
import { getItemSlot } from '../models/Item';
import { RewardReveal } from '../components/RewardRevealModal';
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
  const [rewardReveal, setRewardReveal] = useState<RewardReveal | null>(null);
  // Authoritative refs — always current, used for synchronous reads inside handlers.
  // playerCombatStateRef replaces the old playerResourceRef pattern and extends it to
  // the full state so every handler sees post-last-ability values, not stale closures.
  const playerCombatStateRef = useRef<CombatantState | null>(null);
  const creatureCombatStateRef = useRef<CombatantState | null>(null);

  const victoryProcessedRef = useRef<boolean>(false);
  const fleeProcessedRef = useRef<boolean>(false);
  const isCheckingPendingEncounterRef = useRef<boolean>(false);
  const isProcessingNotificationTapRef = useRef<boolean>(false);
  const encounterRef = useRef<Encounter | null>(null);
  const isMinimizedRef = useRef<boolean>(false);
  const showCombatModalRef = useRef<boolean>(false);

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
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setCurrentEncounter(null);
    setShowEncounterModal(false);
    setShowCombatModal(false);
    setIsEncounterModalMinimized(false);
    setPlayerCombatState(null);
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

    const droppedItem = dropItem(forceItemDrop, updatedPlayer.level);
    let inventoryFull = false;
    let isUpgrade = false;
    if (droppedItem) {
      const inventoryIndex = updatedPlayer.addItemToInventory(droppedItem);
      inventoryFull = inventoryIndex === -1;
      // Simple upgrade hint for the reveal badge: higher combined primary stats than
      // whatever is currently equipped in the item's slot (or an empty slot).
      const equipped = updatedPlayer.equipment[getItemSlot(droppedItem)];
      const statTotal = (
        it: { attack?: number; defense?: number; maxHp?: number; hp?: number } | null,
      ): number => (it?.attack ?? 0) + (it?.defense ?? 0) + (it?.maxHp ?? 0) + (it?.hp ?? 0);
      isUpgrade = statTotal(droppedItem) > statTotal(equipped);
      AnalyticsService.itemDropped(
        droppedItem.rarity,
        droppedItem.type,
        droppedItem.level,
        updatedPlayer.level,
      );
    }

    updatedPlayer.fullHeal();

    setPlayerAndSave(updatedPlayer);
    encounterRef.current = null;
    isMinimizedRef.current = false;
    showCombatModalRef.current = false;
    fleeProcessedRef.current = false;
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);

    AnalyticsService.combatVictory(
      currentEncounterState.creature.name,
      basePlayer.level,
      expGain,
      !!droppedItem,
      levelsGained > 0,
    );
    if (levelsGained > 0) {
      AnalyticsService.levelUp(updatedPlayer.level);
    }
    setRewardReveal({
      creatureName: currentEncounterState.creature.name,
      xpGained: expGain,
      leveledUp: levelsGained > 0,
      newLevel: updatedPlayer.level,
      item: droppedItem ?? null,
      isUpgrade,
      inventoryFull,
    });
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
    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setIsEncounterModalMinimized(false);
    setShowCombatModal(false);
    setShowEncounterModal(false);
    setCurrentEncounter(null);
    setPlayerCombatState(null);
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
    // Ref update is synchronous so handleAbility guards are correct before first render.
    if (playerCombatStateRef.current === null) {
      const initialState = initCombatState(currentPlayer.archetype);
      playerCombatStateRef.current = initialState;
      setPlayerCombatState(initialState);
    }
    if (creatureCombatStateRef.current === null) {
      creatureCombatStateRef.current = { statusEffects: [], resource: 0 };
    }
    AnalyticsService.combatStarted(creature.name, currentPlayer.level);
  };

  const handleAbility = (ability: Ability): boolean => {
    const currentPlayer = playerRef.current;
    const currentEncounterState = encounterRef.current;
    // Read from ref — always the post-last-ability state, never a stale closure snapshot.
    const currentPlayerState = playerCombatStateRef.current;

    if (!currentEncounterState || !currentPlayer || !currentPlayerState) return false;
    if (victoryProcessedRef.current) return false;

    const creature = currentEncounterState.creature;

    if (creature.isDefeated()) {
      handleVictory();
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      return false;
    }

    // Synchronous resource check: ref value is updated immediately on each ability use.
    if (ability.resourceCost > currentPlayerState.resource) return false;

    const updatedPlayer = new Player(currentPlayer.toJSON());

    // Effective stats from PRE-tick state — buffs expiring this turn still apply.
    const playerEffective = computeEffectiveStats(
      updatedPlayer.attack,
      updatedPlayer.defense,
      currentPlayerState.statusEffects,
    );

    // Snapshot PRE-tick creature state so debuffs expiring this turn still apply to
    // effective stat computation (symmetric with player buff pre-tick above).
    const preTickCreatureState = creatureCombatStateRef.current;

    // Tick creature DoT effects with per-type resistance applied.
    let newCreatureState = preTickCreatureState;
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

    // DoT killed creature — persist player tick even though the ability never ran.
    if (creature.isDefeated()) {
      const tickedPlayer =
        currentPlayerState.statusEffects.length > 0
          ? tickStatusEffects(currentPlayerState).updatedState
          : currentPlayerState;
      playerCombatStateRef.current = tickedPlayer;
      setPlayerCombatState(tickedPlayer);
      creatureCombatStateRef.current = newCreatureState;
      showCombatModalRef.current = false;
      setShowCombatModal(false);
      setShowEncounterModal(false);
      handleVictory(updatedPlayer);
      return false;
    }

    // Use PRE-tick creature state so debuffs give their full labeled duration.
    const creatureEffectiveDefense = computeEffectiveStats(
      0,
      creature.defense,
      preTickCreatureState?.statusEffects ?? [],
    ).defense;
    const creatureEffectiveAttack = computeEffectiveStats(
      creature.attack,
      0,
      preTickCreatureState?.statusEffects ?? [],
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

    // Compute new player state synchronously from the ref and write back immediately.
    // Rapid-tap sequences read the already-updated ref on the next tap rather than a
    // stale closure snapshot, so resource deductions and buff durations are always correct.
    const archetype = updatedPlayer.archetype;
    const { updatedState: tickedPlayer } =
      currentPlayerState.statusEffects.length > 0
        ? tickStatusEffects(currentPlayerState)
        : { updatedState: currentPlayerState };
    const afterCost = {
      ...tickedPlayer,
      resource: Math.max(0, tickedPlayer.resource - ability.resourceCost),
    };
    const regenedState = regenResource(afterCost, archetype);
    const newPlayerState: CombatantState =
      selfEffects.length > 0
        ? { ...regenedState, statusEffects: [...regenedState.statusEffects, ...selfEffects] }
        : regenedState;
    playerCombatStateRef.current = newPlayerState;
    setPlayerCombatState(newPlayerState);

    // Compute new creature state synchronously.
    const creatureBase = newCreatureState ?? { statusEffects: [], resource: 0 };
    const newCreatureStateFinal: CombatantState =
      enemyEffects.length > 0
        ? { ...creatureBase, statusEffects: [...creatureBase.statusEffects, ...enemyEffects] }
        : creatureBase;
    creatureCombatStateRef.current = newCreatureStateFinal;

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
      playerCombatStateRef.current = null;
      creatureCombatStateRef.current = null;
      setIsEncounterModalMinimized(false);
      setShowCombatModal(false);
      setShowEncounterModal(false);
      setCurrentEncounter(null);
      setPlayerCombatState(null);
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

    playerCombatStateRef.current = null;
    creatureCombatStateRef.current = null;
    setPlayerCombatState(null);
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

  const dismissReward = (): void => setRewardReveal(null);

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
    playerCombatStateRef,
    rewardReveal,
    dismissReward,
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
