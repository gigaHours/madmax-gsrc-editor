/**
 * Node category definitions for visual grouping and coloring.
 * Categories are assigned based on node class name patterns.
 */

export interface NodeCategory {
  name: string;
  color: string;       // Main color
  bgColor: string;     // Background
  borderColor: string; // Border
  icon: string;        // Unicode icon
}

export const NODE_CATEGORIES: Record<string, NodeCategory> = {
  spawn: {
    name: 'Spawn',
    color: '#E85D3A',
    bgColor: '#1C0F0A',
    borderColor: '#E85D3A',
    icon: '⬡',
  },
  debug: {
    name: 'Debug',
    color: '#888888',
    bgColor: '#151515',
    borderColor: '#555555',
    icon: '🔧',
  },
  variable: {
    name: 'Variables',
    color: '#4EC9B0',
    bgColor: '#0A1917',
    borderColor: '#4EC9B0',
    icon: '⬢',
  },
  math: {
    name: 'Math',
    color: '#B5CEA8',
    bgColor: '#121610',
    borderColor: '#B5CEA8',
    icon: '∑',
  },
  flow: {
    name: 'Flow Control',
    color: '#C586C0',
    bgColor: '#170F17',
    borderColor: '#C586C0',
    icon: '◇',
  },
  object: {
    name: 'Object',
    color: '#569CD6',
    bgColor: '#0A1220',
    borderColor: '#569CD6',
    icon: '□',
  },
  trigger: {
    name: 'Trigger',
    color: '#DCDCAA',
    bgColor: '#1A1A0F',
    borderColor: '#DCDCAA',
    icon: '⚡',
  },
  sound: {
    name: 'Sound',
    color: '#CE9178',
    bgColor: '#1A120E',
    borderColor: '#CE9178',
    icon: '♪',
  },
  gui: {
    name: 'GUI',
    color: '#D7BA7D',
    bgColor: '#1A160E',
    borderColor: '#D7BA7D',
    icon: '🖥',
  },
  vehicle: {
    name: 'Vehicle',
    color: '#F44747',
    bgColor: '#1A0A0A',
    borderColor: '#F44747',
    icon: '🚗',
  },
  character: {
    name: 'Character',
    color: '#6A9955',
    bgColor: '#0F1A0A',
    borderColor: '#6A9955',
    icon: '🧑',
  },
  ai: {
    name: 'AI',
    color: '#D16969',
    bgColor: '#1A0E0E',
    borderColor: '#D16969',
    icon: '🧠',
  },
  map: {
    name: 'Map',
    color: '#9CDCFE',
    bgColor: '#0E171A',
    borderColor: '#9CDCFE',
    icon: '🗺',
  },
  effect: {
    name: 'Effects',
    color: '#FF79C6',
    bgColor: '#1A0A15',
    borderColor: '#FF79C6',
    icon: '✨',
  },
  economy: {
    name: 'Economy',
    color: '#FFD700',
    bgColor: '#1A1700',
    borderColor: '#FFD700',
    icon: '💰',
  },
  mission: {
    name: 'Mission',
    color: '#FF6600',
    bgColor: '#1A0F00',
    borderColor: '#FF6600',
    icon: '🎯',
  },
  road: {
    name: 'Road',
    color: '#8B8B00',
    bgColor: '#15150A',
    borderColor: '#8B8B00',
    icon: '🛣',
  },
  xvm: {
    name: 'XVM Script',
    color: '#DA70D6',
    bgColor: '#1A0E1A',
    borderColor: '#DA70D6',
    icon: '📜',
  },
  save: {
    name: 'Save Data',
    color: '#00CED1',
    bgColor: '#001A1A',
    borderColor: '#00CED1',
    icon: '💾',
  },
  convoy: {
    name: 'Convoy',
    color: '#CD853F',
    bgColor: '#1A1308',
    borderColor: '#CD853F',
    icon: '🚛',
  },
  anim: {
    name: 'Animation',
    color: '#87CEEB',
    bgColor: '#0E151A',
    borderColor: '#87CEEB',
    icon: '🎬',
  },
  transform: {
    name: 'Transform',
    color: '#DDA0DD',
    bgColor: '#1A101A',
    borderColor: '#DDA0DD',
    icon: '↻',
  },
  unknown: {
    name: 'Unknown',
    color: '#888888',
    bgColor: '#111111',
    borderColor: '#444444',
    icon: '?',
  },
};

const CATEGORY_PATTERNS: [RegExp, string][] = [
  [/^Debug|^DebugGfx|^DebugText/, 'debug'],
  [/^Spawn|^RequestSpawn|^RequestDespawn|^Despawn|^Nuke|^IsSpawning/, 'spawn'],
  [/^(External|Global)?Variable(Float|Int|Bool|String|Hash|Vector|Object|Transform|Uint32|Uint64|Enum|StringHash)$/, 'variable'],
  [/^Set(Random|Variable|Dictionary)|^Get(Dictionary)|^Check(Variable)|^Compare|^Decrement|^AddTo/, 'variable'],
  [/^Math|^Scale|^Min|^Max/, 'math'],
  [/^(Start|Return|Entry|Exit)$/, 'flow'],
  [/^OrderedExecute|^Repeater|^Sleep|^Timer|^TimeLock|^SelectRandom|^FireValid|^GetDelta|^GetTime/, 'flow'],
  [/^(Find|Enable|Disable|ForEach|Is(Valid|Visible)|Has(Tag)|Get(Tag)|Object|AddTo(Object)|Remove(From)|Clear(Object)|Check(Object)|Reverse)/, 'object'],
  [/^(Wait|Check|Shape|Game|Height|Proximity|Counter|ForEachObject).*Trigger|^ShapeTrigger|^WaitForCount|^CheckAltitude|^InRange/, 'trigger'],
  [/^Sound|^Parameter|^Decibel|^VehicleSound/, 'sound'],
  [/^GUI|^Gui|^Fade(Screen|Object)/, 'gui'],
  [/^Vehicle|^IsVehicle|^IsPlayer(Vehicle)|^GetVehicle|^SetVehicle|^IsSignature|^GetSignature|^Archangel|^Archetype|^Install/, 'vehicle'],
  [/^(Is)?Character|^IsPlayer$|^IsPlayerEnemy|^DoAct|^SetAFSM|^ResetAFSM|^SetHealth(Mode)?$|^GetHealth$|^SetLink|^Inflict/, 'character'],
  [/^AI|^Gating|^NpcCounter|^CarCombat|^CarGameState|^AiGameState|^PlayerPressure|^PlayerFury|^GameState|^PlayerIn/, 'ai'],
  [/^Map|^SetMap|^Reveal|^Count(Unrevealed)|^Create(Scoutable)|^Delete(Created)|^HasFound/, 'map'],
  [/^Effect|^RigidObject/, 'effect'],
  [/^(Set|Get|Consume)Economy|^GetArea|^Deplete|^GetItem|^GiveItem|^RemoveItem|^SpawnPickup|^GetScrap|^Inventory|^Weapon/, 'economy'],
  [/^Mission|^Objective|^Checkpoint|^GetProject|^SetProject|^Trigger(Project)|^Check(Project)|^IsEncampment|^Challenge|^GetRegion|^GetEncampment|^HasEncampment|^Update(Last)/, 'mission'],
  [/^Road|^Spline/, 'road'],
  [/^XVM/, 'xvm'],
  [/^Global(Save)|^Datablock/, 'save'],
  [/^Convoy|^Entities(Composition)|^Faction|^Relic/, 'convoy'],
  [/^(Start|Stop|Check|Set)Anim|^AnimSpeed|^RotateTowards/, 'anim'],
  [/^Transform|^Distance|^Teleport|^ValidateTransform|^SetTransform|^ObjectGet(Transform|Parent)|^ObjectSet(Transform|Position)/, 'transform'],
  [/^Griffa|^GetUpgradeable|^(In)?(Storm|Territory)/, 'mission'],
  [/^OneShotIntroduction|^IntroScore/, 'flow'],
  [/^TagCache|^TurnTaker|^Raycast/, 'object'],
  [/^FastTravel|^LoadLocation|^UnloadLocation|^UnloadAll|^CheckIf(Location|Block)/, 'flow'],
  [/^SendGlobal|^WaitForGlobal|^EventSend/, 'flow'],
  [/^WaitForButton|^SelectCardinal|^CheckButton|^ActionMap/, 'trigger'],
  [/^IsEditor|^IsIndoor|^GetSequence/, 'flow'],
  [/^SetTime|^IsWithinTime|^GetTimeOffline/, 'flow'],
  [/^Player(Set|Get)Active|^GetPlayer(Legend|Upgrade|Character)|^SetPlayer|^TryToDoInteraction|^GetGraphParent|^GetAlias/, 'character'],
  [/^Race|^Award|^Unlock|^GetLast|^ApplyDeath|^GetExp|^SaveBest|^LoadBest|^OpusWars|^Deathrun/, 'mission'],
  [/^BookEncounter|^FreeEncounter|^GetEncounter|^EncounterFind|^EncounterGet/, 'spawn'],
  [/^SpawnBudget|^SpawnInfo|^SpawnSet|^SpawnGet|^SpawnHold|^SpawnResource|^SpawnPriority|^SpawnUpdate|^SpawnIterateObjects/, 'spawn'],
  [/^GetLocationInfo|^GetNearest|^Complete(Tracked)|^IsAll(Tracked)|^GetTracked|^GetObjective|^GetCampCount/, 'map'],
  [/^GUIAction|^GUIX|^GUIPost|^GUIRequest|^GUITicket/, 'gui'],
  [/^CharacterDialogue|^CharacterIs|^CharacterSet|^CharacterGet/, 'character'],
  [/^VehicleCheck|^VehicleDeath|^VehicleGet|^VehicleHas|^VehicleUpgrade|^VehicleIs/, 'vehicle'],
  [/^Garage|^TestLoot|^Stat/, 'economy'],
  [/^Loc(ation)?|^IsRace/, 'map'],
];

export function getNodeCategory(className: string): NodeCategory {
  for (const [pattern, categoryKey] of CATEGORY_PATTERNS) {
    if (pattern.test(className)) {
      return NODE_CATEGORIES[categoryKey];
    }
  }
  return NODE_CATEGORIES.unknown;
}
