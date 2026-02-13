// @ts-nocheck
/**
 * Jenkins lookup3 hashlittle2 - the hash function used by Mad Max / Avalanche engine
 * All names in GraphScript are stored as uint32 hashes of their string names.
 */

import { HASHC_STRINGS } from './hashc-strings';

export function jenkinsLookup3(key: string, initval: number = 0): number {
  const k = new TextEncoder().encode(key);
  const length = k.length;

  let a = 0xdeadbeef + length + initval;
  let b = a;
  let c = a;

  let offset = 0;
  while (length - offset > 12) {
    a += k[offset] | (k[offset + 1] << 8) | (k[offset + 2] << 16) | (k[offset + 3] << 24);
    b += k[offset + 4] | (k[offset + 5] << 8) | (k[offset + 6] << 16) | (k[offset + 7] << 24);
    c += k[offset + 8] | (k[offset + 9] << 8) | (k[offset + 10] << 16) | (k[offset + 11] << 24);

    a -= c; a ^= (c << 4) | (c >>> 28); c = (c + b) | 0;
    b -= a; b ^= (a << 6) | (a >>> 26); a = (a + c) | 0;
    c -= b; c ^= (b << 8) | (b >>> 24); b = (b + a) | 0;
    a -= c; a ^= (c << 16) | (c >>> 16); c = (c + b) | 0;
    b -= a; b ^= (a << 19) | (a >>> 13); a = (a + c) | 0;
    c -= b; c ^= (b << 4) | (b >>> 28); b = (b + a) | 0;

    offset += 12;
  }

  const remaining = length - offset;
  switch (remaining) {
    case 12: c += k[offset + 11] << 24; // fallthrough
    case 11: c += k[offset + 10] << 16;
    case 10: c += k[offset + 9] << 8;
    case 9:  c += k[offset + 8];
    case 8:  b += k[offset + 7] << 24;
    case 7:  b += k[offset + 6] << 16;
    case 6:  b += k[offset + 5] << 8;
    case 5:  b += k[offset + 4];
    case 4:  a += k[offset + 3] << 24;
    case 3:  a += k[offset + 2] << 16;
    case 2:  a += k[offset + 1] << 8;
    case 1:  a += k[offset];
             break;
    case 0:  return c >>> 0;
  }

  c ^= b; c -= (b << 14) | (b >>> 18);
  a ^= c; a -= (c << 11) | (c >>> 21);
  b ^= a; b -= (a << 25) | (a >>> 7);
  c ^= b; c -= (b << 16) | (b >>> 16);
  a ^= c; a -= (c << 4) | (c >>> 28);
  b ^= a; b -= (a << 14) | (a >>> 18);
  c ^= b; c -= (b << 24) | (b >>> 8);

  return c >>> 0;
}

export function hashString(s: string): number {
  return jenkinsLookup3(s);
}

// Pre-computed hashes for known GraphScript identifiers
export const KNOWN_HASHES: Record<number, string> = {};

const KNOWN_STRINGS = [
  // Data types
  'bool', 'int', 'uint32', 'int64', 'uint64', 'float', 'vector', 'enum',
  'string', 'string_ptr', 'data_block',
  // Pin categories
  'input_pins', 'output_pins', 'variable_pins',
  // File extension
  '.gsrc',
  // Special datasets
  'GlobalVariableData',
  // Node class names (from CGraphScriptGameObjectFunctionMap)
  'Debug', 'DebugText', 'IsEditor', 'GriffaSetState', 'GriffaGetState',
  'GriffaTriggerCutsceneNumber', 'GetUpgradeableValue', 'SpawnStorm',
  'InStormArea', 'InTerritoryArea', 'GetLocationInfoForLocationTrackedItem',
  'GetNearestLocationInfo', 'CompleteTrackedItem', 'IsAllTrackedItemsComplete',
  'GetTrackedItemCount', 'GetLocationInfoDataByNameHash',
  'GetLocationInfoIdFromObjRef', 'GetObjectiveStringByType',
  'GetCampCountForTerritory', 'SpawnGetIdFromObject',
  'SpawnRequestDespawnOnDestroy', 'SpawnMultipleEntitiesAvailable',
  'SpawnBeginMultipleEntities', 'SpawnEndMultipleEntities',
  'RequestDespawn', 'RequestSpawn', 'GetSpawnStatus', 'IterateSpawnedObjects',
  'BookEncounterSpawnPoint', 'BookEncounterWithSpawnPoint',
  'FreeEncounterSpawnPoint', 'GetEncounterSpawnPointTransform',
  'SpawnUpdateTransform', 'IsSpawningActive', 'SpawnSetPriority',
  'SpawnSetRangedPriority', 'SpawnPriorityEnum', 'SpawnGetPos',
  'SpawnHoldAfterResourcesLoaded', 'SpawnResourcesLoaded',
  'SpawnBudgetCreateGroup', 'EncounterFindSpawnPointInRange',
  'EncounterGetIdFromObject', 'SpawnInfoDataSet', 'SpawnInfoDataGet',
  'SpawnInfoDataGetTaggedWithSpawnId', 'SetMapIconProfile', 'SetMapIconText',
  'MapIconSetPosition', 'MapIconGetStatus', 'MapIconType',
  'MapIconSetIconTypeOverride', 'MapIconResetIconTypeOverride',
  'MapIconSetVisible', 'MapIconSetDiscovered',
  'IsRaceTrophyUnlocked', 'IsRaceTrophyLegendAwarded',
  'IsRaceTrophyStandardAwarded', 'UnlockRaceTrophy', 'AwardRaceTrophyLegend',
  'AwardRaceTrophyStandard', 'GetRaceTrophyId', 'GetLastSelectedRaceTrophyId',
  'ApplyDeathRunModifier', 'GetExpEntityFromRaceTrophyId',
  'GetRaceTrophyGUIData', 'GetScrapFromRaceTrophyId',
  'SaveBestRaceTime', 'LoadBestRaceTime',
  'OpusWarsSetCurrentLeaderboard', 'OpusWarsGetLeaderboardBestTime',
  'GetGriffaTokenCount', 'NukeAllSpawnedEntities',
  'SetDictionaryVariable', 'GetDictionaryVariable', 'GUIActionPrompt',
  'FireValidEntries', 'GetPlayerCharacter', 'PlayerSetActiveDeathRunId',
  'PlayerGetActiveDeathRunValueHash', 'GetPlayerLegendInfo',
  'GetPlayerUpgradeInfo', 'SetPlayerUpgradeLevel', 'TryToDoInteraction',
  'GetGraphParent', 'FadeObject', 'GetAlias', 'Teleport',
  'TeleportPlayerWithLoad', 'DespawnObject', 'IsWithinTimeOfDay',
  'SetTimeOfDay', 'SetEconomyResource', 'GetEconomyResource',
  'ConsumeEconomyResource', 'GetAreaResourceAmount',
  'DepleteAllThreatInRegion', 'SetHealthBlock', 'GetItem', 'GiveItem',
  'RemoveItem', 'GetEconomyResourceId', 'SpawnPickup',
  'IsEncampmentUnlocked', 'TriggerProjectRequirement',
  'CheckProjectComplete', 'GetProjectStatus', 'SetProjectStatus',
  'SpawnEncounter', 'GetActiveEncounterCount', 'GetSequenceLength',
  'IsIndoor', 'GetCampInfo', 'GetChallenge', 'AddChallengePoints',
  'ShowChallenge', 'GetRegionName', 'GetRegionThreat',
  'GetEncampmentLevel', 'HasEncampmentLevelChanged',
  'UpdateLastEncampmentLevel', 'RevealIcons', 'RevealRandomIcons',
  'CountUnrevealedIcons', 'EffectSpawnerControl',
  'EffectSpawnerSetParameter', 'EffectSpawnerIsPlaying',
  'EffectSpawnerSetMaterial', 'EffectSpawnerSetTransform',
  'EffectSpawnerSetVelocity', 'EffectPointEmitterPlay',
  'EffectPointEmitterStop', 'EffectPointEmitterIsPlaying',
  'WaitForButton', 'SelectCardinalMovementDirection', 'CheckButtonInput',
  'GUIMessage', 'FadeScreen', 'Mission', 'Objective', 'Checkpoint',
  'FastTravelIsUnlocked', 'GetTimeStamp', 'Timer', 'TimeLock',
  'SleepFrame', 'SetGameSpeed', 'Repeater', 'GetTimeOffline', 'GetDeltaTime',
  'GetScrapCrewReward', 'WaitForEnvironmentTagCallback',
  'DistanceCheck', 'SoundControl', 'ParameterControl', 'DecibelConvert',
  'SoundModuleFunction', 'SoundModuleSetFunction', 'SoundModuleController',
  'VehicleSoundEvent', 'IsCharacter', 'IsPlayer', 'IsPlayerEnemy',
  'IsCharacterDead', 'IsCharacterInSequence', 'GetCharacterSpeed',
  'CharacterDialoguePromptSetEnabled', 'CharacterDialoguePromptSetMuted',
  'CharacterDialogueBroadcastIntent', 'CharacterDialogueMuteChildren',
  'CharacterIsVehicleDriver', 'DoAct', 'ResetAFSM', 'SetAFSM',
  'SetHealthMode', 'GetHealth', 'SetHealth', 'SetLinkTarget',
  'InflictDamage', 'SendGlobalEvent', 'WaitForGlobalEvent',
  'EventSendGlobalOnDestroy', 'FindObjectByAlias', 'ObjectWithAliasExists',
  'EnableObject', 'DisableObject', 'ForEachObject', 'AddToObjectList',
  'ObjectAddChild', 'FindByNameInObjectList', 'FindByNameInObjectHierarchy',
  'ExtractAliasesFromObjectOrderedList', 'ReverseObjectOrderedList',
  'ClearObjectList', 'CheckObjectInObjectList', 'RemoveFromObjectList',
  'ObjectListGetClosestTo', 'IsValidObject', 'IsVisibleObject',
  'HasTag', 'GetTag', 'ObjectGetParent', 'ObjectGetTransform',
  'ObjectSetTransform', 'ObjectSetPosition', 'ValidateTransformOnTerrain',
  'ValidateTransformOnTerrainFirstHit', 'InRangeOfObjects', 'SetTransform',
  'TurnTakerAddToGroup', 'TurnTakerRemove', 'TurnTakerObjectIsReady',
  'TurnTakerObjectDeregister', 'RaycastStatic', 'RaycastStaticFromCamera',
  'TagCacheIterateIds', 'TagCacheGetRandomInRange',
  'OneShotIntroductionsGetNumProfiles', 'OneShotIntroductionInitData',
  'OneShotIntroductionFlagAsIntroduced', 'OneShotIntroductionScoreObject',
  'OneShotIntroductionUpdateIconsForType', 'OneShotIntroductionHideIcons',
  'OneShotIntroductionBroadcastToGui', 'OneShotIntroductionGetProfileFloat',
  'OneShotIntroductionAutoUnlockAll', 'IntroScoreDataInit',
  'IntroScoreDataReset', 'IntroScoreDataAdd', 'IntroScoreDataGetBestVisible',
  'SplineSelectInRangeFOV', 'SplineMoverAssignSpline', 'SplineMoverGetSpline',
  'SplineMoverUpdate', 'SplineMoverUpdateToObject', 'SplineMoverGetProgress',
  'SplineMoverUpdateAvoidance', 'SetAnimSpline', 'CheckAnim', 'StartAnim',
  'StopAnim', 'AnimSpeedControl', 'RotateTowards',
  'WaitForShapeTrigger', 'CheckShapeTrigger', 'WaitForShapeTriggerChange',
  'ShapeTriggerEnable', 'Counter', 'WaitForCount', 'GameZoneTrigger',
  'HeightTrigger', 'ProximityCheck', 'CheckAltitude',
  'CheckObjectInShapeTrigger', 'CheckObjectInsideConeAngle',
  'CheckAlignedInDirection', 'ForEachObjectInTrigger',
  'FindNearestObjectInTrigger', 'InteractionGetScriptPropertyFloat',
  'ScriptObjectGetPropertyFloat', 'LoadLocation', 'UnloadLocation',
  'UnloadAllLocations', 'CheckIfLocationLoaded', 'CheckIfBlockLoaded',
  'XVMCall', 'XVMCall1Parameter', 'XVMCall2Parameters',
  'XVMCall3Parameters', 'XVMCall4Parameters', 'XVMScript',
  'DecrementInt', 'SetRandomInt', 'SetRandomFloat', 'SetVariable',
  'CompareVariable', 'CheckVariable', 'AddToVariable', 'SelectRandom',
  'MathOperator', 'MathOperatorInt', 'MathOperatorVector', 'ScaleFloat',
  'MinFloat', 'MaxFloat', 'Spawn', 'SpawnIterateObjects',
  'SetAIRole', 'ModifyLoadedAIRole', 'HasBehaviourTree',
  'IsPlayerVehicle', 'IsVehicle', 'IsSignatureVehicle', 'GetSignatureVehicle',
  'GetVehicle', 'VehicleHasUpgrade', 'VehicleUpgradeOwned',
  'VehicleUpgradeShown', 'VehicleUpgradeCurrentLevel',
  'VehicleSetBlackboardValue', 'VehicleCheckBlackboardFlagValue',
  'VehicleGetSpeed', 'VehicleGetAeroSpeed', 'VehicleIsIncapacitated',
  'CharacterSetBlackboardValue', 'CharacterGetBlackboardValue',
  'InstallArchetype', 'VehicleDeathOnNextImpact', 'SetVehicleHealth',
  'VehicleGetCarCombatDirectorTransform', 'VehicleHasEnemyDriver',
  'ArchangelCanBeInstalled', 'ArchangelIsInstalled', 'ArchetypeIsValid',
  'AiGameStateInRange', 'AiGameStateInRangeCount',
  'CarCombatInActivationRange', 'CarCombatInRange',
  'CarGameStateInRange', 'CarGameStateInRangeCount',
  'PlayerInVehicle', 'PlayerPressure', 'PlayerFury', 'PlayerFuryMultiplier',
  'GameState', 'GameStateInRun', 'GameStateInLoad',
  'NpcCounterCar', 'NpcCounterCharacter', 'GatingGetProfile',
  'GatingDisplayProfile', 'GatingGetRammingLvl', 'GatingGetHarpoonLvl',
  'GatingGetExplosionLvl', 'GatingGetJimmyBar', 'GatingGetPliers',
  'GatingGetNightVision', 'GatingGetVisualRange',
  'GatingGetRaycastValidationInfo', 'GatingCalculateCullFade',
  'CreateScoutableIcons', 'DeleteCreatedScoutableIcons',
  'HasFoundScoutableIcons', 'RoadBuildPathsForRoute',
  'RoadPositionOnRoute', 'RoadPositionRelativeToObjectOnRoute',
  'RoadMoveAlongRoute', 'RoadCreateWaypoints', 'RoadUpdateRouteProgression',
  'RoadEncounterSetup', 'RoadEncounterGenerateDestination',
  'RoadGetNearestEdgeId', 'RoadPathCacheContainsEdgeId',
  'RoadPathCacheInsideExtents', 'RoadPathCacheInsideMoverExtents',
  'RoadPathCacheReverse', 'RoadMoverRepel', 'RoadMoverClamp',
  'RoadMoverReverse', 'RoadMoverGenerateSpeed',
  'TransformGetPos', 'TransformSetPos', 'TransformRotateLocal',
  'TransformFlipDir', 'TransformProjectDirPos', 'TransformInterpolate',
  'TransformToPointResult', 'DistanceBetweenPoints',
  'RoadMoverGetRoute', 'DebugGfxObjectMarker', 'GuiSetBlackboardValue',
  'GuiFullscreenClaim', 'GuiFullscreenRelease', 'GUIPostTicket',
  'GUIRequestTicket', 'GUITicket', 'DebugGfxTransformMarker',
  'DebugGfxLine', 'DebugGfxPosMarker', 'DebugGfxAIFlee',
  'AILoadConstantsProfiles_Flee', 'AILoadConstantsProfiles_CarCombat',
  'AILoadConstantsProfiles_VehicleMaps',
  'AILoadConstantsProfiles_ConvoyGuardRanges',
  'AILoadConstantsProfiles_ConvoysComposition',
  'AILoadConstantsProfiles_EntitiesComposition',
  'AILoadConstantsProfiles_DeathRunProfiles',
  'AILoadConstantsProfiles_IntroductionProfiles',
  'AILoadConstantsProfiles_ScoutingProfiles',
  'AILoadConstantsProfiles_TargetProfiles',
  'AILoadConstantsProfiles_LevelValues',
  'AILoadConstantsProfiles_EntityMapping',
  'AILoadConstantsProfiles_SpawningBackups',
  'FactionSet', 'FactionGet', 'FactionInInfluenceRange',
  'FactionInfluenceObjectSet', 'ConvoyAnyRouteDiscovered',
  'ConvoyDataGetWrecked', 'ConvoyDataSetWrecked',
  'ConvoyDataGetDiscovered', 'ConvoyDataSetDiscovered',
  'ConvoyDataSetMoverData', 'ConvoyDataGetMoverData',
  'ConvoyDataCCMapBlockSpawn', 'ConvoyDataCCMapClearIdTracking',
  'ConvoyDataCCMapClearBlocked', 'ConvoyDataCCMapFromSpawnId',
  'ConvoyDataCCMapInitTracking', 'ConvoyDataCCMapIsBlocked',
  'ConvoyDataCCMapTrackSpawn', 'ConvoysCompositionGetEntity',
  'ConvoysCompositionIterateGuards', 'ConvoysCompositionGetGuardCCMapId',
  'ConvoyMetricIsSpawnPossibleFailed', 'ConvoyMetricInProgressSpawningFailed',
  'EntitiesCompositionIterateIds', 'EntitiesCompositionRandomId',
  'RigidObjectMakeDynamic', 'RelicIsCollected', 'GUIXAddConvoyRoute',
  'GUIXSetConvoyRouteRelicCollected', 'GUIXSetConvoyRouteWrecked',
  'DatablockIntArrayInit', 'DatablockIntArrayAdd',
  'DatablockIntArrayIterate', 'DatablockIntArrayIterateRemove',
  'DatablockIntArraySize', 'DatablockIntArrayGet', 'DatablockIntArrayRemove',
  'DatablockUInt32ArrayInit', 'DatablockUInt64ArrayInit',
  'GlobalSaveGetBool', 'GlobalSaveSetBool', 'GlobalSaveGetInt',
  'GlobalSaveSetInt', 'GlobalSaveGetFloat', 'GlobalSaveSetFloat',
  'OrderedExecute', 'InventoryGetItem', 'WeaponGetInfo',
  'ActionMapIsEnabled', 'GarageClearRuntimeLock', 'GarageSetRuntimeLock',
  'TestLootRewardReset', 'DeathrunSummaryEvent', 'StatGameProgressionSet',
  // Variable node types
  'VariableFloat', 'VariableInt', 'VariableBool', 'VariableString',
  'VariableHash', 'VariableVector', 'VariableObject', 'VariableTransform',
  'VariableUint32', 'VariableUint64', 'VariableEnum',
  'ExternalVariableFloat', 'ExternalVariableInt', 'ExternalVariableBool',
  'ExternalVariableString', 'ExternalVariableHash', 'ExternalVariableVector',
  'ExternalVariableObject', 'ExternalVariableUint32', 'ExternalVariableUint64',
  'ExternalVariableTransform', "ExternalVariableEventSend", "ExternalVariableEventReceive", "ExternalVariableGraphFile",  "ExternalVariableFile", "ExternalVariableGlobalRef",
  'GlobalVariableFloat', 'GlobalVariableInt', 'GlobalVariableBool',
  'GlobalVariableString', 'GlobalVariableHash', 'GlobalVariableVector',
  'GlobalVariableObject', 'GlobalVariableUint32', 'GlobalVariableUint64',
  'GlobalVariableTransform',
  // Flow control
  'Start', 'Return', 'Entry', 'Exit', "Main", "Output", "Error", "ExternalGraph", "Selection", "Block", "Mulitlock",
  // Common variable/pin names
  'VariableStringHash', 'ExternalVariableStringHash', 'GlobalVariableStringHash',
  'update', 'destroy', 'on_spawn', 'on_despawn', 'result', 'value',
  'target', 'source', 'object', 'position', 'transform', 'distance',
  'radius', 'enabled', 'disabled', 'true', 'false', 'index', 'count',
  'name', 'type', 'id', 'hash', 'priority', 'state',
  'in', 'out', 'start', 'done', 'next', 'then',
  'Value', 'Name', 'Type', 'Alias', 'Id',
  'amount', 'economy_id', 'parent', 'character',
  'found', 'not_found', 'success', 'fail',
];

// Build the reverse lookup table
for (const s of KNOWN_STRINGS) {
  const h = hashString(s);
  KNOWN_HASHES[h] = s;
}

// Register all strings from pc_key.hashc (engine-wide hash dictionary)
for (const s of HASHC_STRINGS) {
  const h = hashString(s);
  if (!(h in KNOWN_HASHES)) KNOWN_HASHES[h] = s;  // don't overwrite manual entries
}

/**
 * Resolve a hash to its string name, or return hex representation
 */
export function resolveHash(hash: number): string {
  return KNOWN_HASHES[hash] ?? `0x${hash.toString(16).padStart(8, '0').toUpperCase()}`;
}

/**
 * Register additional known hash strings at runtime
 */
export function registerHashString(s: string): number {
  const h = hashString(s);
  KNOWN_HASHES[h] = s;
  return h;
}
