(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.JackpotCore = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var VERSION = 2;
  var SAVE_KEYS = ["jackpotBakerySave", "jackpotBakerySave_v1", "jackpot_bakery_save"];
  var MAX_OFFLINE_SECONDS = 8 * 60 * 60;

  var SYMBOLS = [
    { id: "crumb", label: "Crumb", glyph: "·", weight: 28, value: 1 },
    { id: "cookie", label: "Cookie", glyph: "●", weight: 24, value: 2 },
    { id: "milk", label: "Milk", glyph: "M", weight: 17, value: 4 },
    { id: "choco", label: "Chocolate", glyph: "◆", weight: 13, value: 7 },
    { id: "berry", label: "Berry", glyph: "♥", weight: 9, value: 12 },
    { id: "star", label: "Sugar Star", glyph: "★", weight: 6, value: 22 },
    { id: "crown", label: "Baker Crown", glyph: "♛", weight: 3, value: 50 }
  ];

  var MACHINES = [
    {
      id: "copper",
      name: "Copper Cookie",
      subtitle: "The little oven that could",
      unlockCost: 0,
      baseYield: 2,
      autoInterval: 4.2,
      accent: "#e9823e"
    },
    {
      id: "frosted",
      name: "Frosted Fortune",
      subtitle: "Icing, sprinkles, momentum",
      unlockCost: 750,
      baseYield: 32,
      autoInterval: 3.5,
      accent: "#67c7d4"
    },
    {
      id: "cocoa",
      name: "Chocolate Foundry",
      subtitle: "Industrial-strength sweetness",
      unlockCost: 65000,
      baseYield: 620,
      autoInterval: 2.9,
      accent: "#bd714f"
    },
    {
      id: "moon",
      name: "Moonlight Mixer",
      subtitle: "Night-shift cosmic batches",
      unlockCost: 8500000,
      baseYield: 18000,
      autoInterval: 2.3,
      accent: "#9d7bdd"
    },
    {
      id: "royal",
      name: "Royal Crumb Works",
      subtitle: "The crown jewel of baking",
      unlockCost: 1800000000,
      baseYield: 900000,
      autoInterval: 1.7,
      accent: "#efc75e"
    }
  ];

  var PERKS = [
    { id: "power", name: "Gilded Flour", description: "+15% all crumb rewards per rank", baseCost: 1, max: 20 },
    { id: "offline", name: "Night Bakers", description: "+10% offline earnings per rank", baseCost: 2, max: 10 },
    { id: "luck", name: "Lucky Whisk", description: "Better rare-symbol odds per rank", baseCost: 2, max: 12 },
    { id: "heat", name: "Everlasting Ember", description: "+2 seconds of Hot Oven per rank", baseCost: 3, max: 10 }
  ];

  var ACHIEVEMENTS = [
    { id: "first_bake", name: "First Batch", description: "Bake once.", test: function (s) { return s.stats.spins >= 1; } },
    { id: "hundred_bakes", name: "Busy Hands", description: "Bake 100 times.", test: function (s) { return s.stats.spins >= 100; } },
    { id: "thousand_bakes", name: "Master Mixer", description: "Bake 1,000 times.", test: function (s) { return s.stats.spins >= 1000; } },
    { id: "first_match", name: "Pair of Pastries", description: "Land a matching pair.", test: function (s) { return s.stats.matches >= 1; } },
    { id: "triple", name: "Three of a Kind", description: "Land three matching symbols.", test: function (s) { return s.stats.triples >= 1; } },
    { id: "jackpot", name: "Royal Recipe", description: "Land the Baker Crown jackpot.", test: function (s) { return s.stats.jackpots >= 1; } },
    { id: "hot_oven", name: "Preheated", description: "Trigger Hot Oven mode.", test: function (s) { return s.stats.hotOvens >= 1; } },
    { id: "combo_10", name: "On a Roll", description: "Reach a 10 combo.", test: function (s) { return s.stats.bestCombo >= 10; } },
    { id: "combo_25", name: "Bakery Rush", description: "Reach a 25 combo.", test: function (s) { return s.stats.bestCombo >= 25; } },
    { id: "crumb_1k", name: "Crumb Jar", description: "Bake 1,000 lifetime crumbs.", test: function (s) { return s.stats.lifetimeCrumbs >= 1000; } },
    { id: "crumb_1m", name: "Million-Crumb Smile", description: "Bake 1 million lifetime crumbs.", test: function (s) { return s.stats.lifetimeCrumbs >= 1000000; } },
    { id: "crumb_1b", name: "Crumb Magnate", description: "Bake 1 billion lifetime crumbs.", test: function (s) { return s.stats.lifetimeCrumbs >= 1000000000; } },
    { id: "unlock_2", name: "Second Oven", description: "Unlock Frosted Fortune.", test: function (s) { return s.machines[1].unlocked; } },
    { id: "unlock_3", name: "Factory Floor", description: "Unlock Chocolate Foundry.", test: function (s) { return s.machines[2].unlocked; } },
    { id: "unlock_4", name: "Midnight Shift", description: "Unlock Moonlight Mixer.", test: function (s) { return s.machines[3].unlocked; } },
    { id: "unlock_all", name: "Bakery Empire", description: "Unlock every oven.", test: function (s) { return s.machines.every(function (m) { return m.unlocked; }); } },
    { id: "level_10", name: "Ten Layers", description: "Raise an oven to level 10.", test: function (s) { return s.machines.some(function (m) { return m.level >= 10; }); } },
    { id: "level_50", name: "Industrial Baker", description: "Raise an oven to level 50.", test: function (s) { return s.machines.some(function (m) { return m.level >= 50; }); } },
    { id: "auto_first", name: "Helping Hands", description: "Hire an auto-baker.", test: function (s) { return s.machines.some(function (m) { return m.autoLevel >= 1; }); } },
    { id: "auto_25", name: "Clockwork Kitchen", description: "Hire 25 total auto-baker ranks.", test: function (s) { return s.machines.reduce(function (a, m) { return a + m.autoLevel; }, 0) >= 25; } },
    { id: "prestige_first", name: "Golden Restart", description: "Prestige once.", test: function (s) { return s.stats.prestiges >= 1; } },
    { id: "gold_10", name: "Golden Dozen Minus Two", description: "Earn 10 total Golden Crumbs.", test: function (s) { return s.prestigeClaimed >= 10; } },
    { id: "perk_first", name: "Secret Ingredient", description: "Buy a prestige perk.", test: function (s) { return Object.keys(s.perks).some(function (k) { return s.perks[k] > 0; }); } },
    { id: "offline_hour", name: "While You Were Away", description: "Claim an hour of offline production.", test: function (s) { return s.stats.offlineSeconds >= 3600; } },
    { id: "completionist", name: "Perfect Bake", description: "Unlock 24 other achievements.", test: function (s) { return Object.keys(s.achievements).filter(function (id) { return id !== "completionist" && s.achievements[id]; }).length >= 24; } }
  ];

  function machineState(index) {
    return {
      unlocked: index === 0,
      level: index === 0 ? 1 : 0,
      autoLevel: 0,
      autoEnabled: true,
      autoProgress: 0
    };
  }

  function createState(now) {
    return {
      version: VERSION,
      crumbs: 25,
      goldenCrumbs: 0,
      prestigeClaimed: 0,
      selectedMachine: 0,
      combo: 0,
      hotMeter: 0,
      hotUntil: 0,
      perks: { power: 0, offline: 0, luck: 0, heat: 0 },
      machines: MACHINES.map(function (_, i) { return machineState(i); }),
      achievements: {},
      settings: {
        musicVolume: 0.58,
        sfxVolume: 0.7,
        muted: false,
        compactNumbers: true
      },
      stats: {
        spins: 0,
        matches: 0,
        triples: 0,
        jackpots: 0,
        hotOvens: 0,
        bestCombo: 0,
        lifetimeCrumbs: 0,
        highestBalance: 25,
        prestiges: 0,
        offlineSeconds: 0,
        playSeconds: 0
      },
      lastSave: Number(now || Date.now())
    };
  }

  function finiteNumber(value, fallback) {
    var n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function migrateState(raw, now) {
    var base = createState(now);
    if (!raw || typeof raw !== "object") return base;

    base.crumbs = Math.max(0, finiteNumber(raw.crumbs, finiteNumber(raw.cookies, base.crumbs)));
    base.goldenCrumbs = Math.max(0, Math.floor(finiteNumber(raw.goldenCrumbs, finiteNumber(raw.prestigeCurrency, 0))));
    base.prestigeClaimed = Math.max(base.goldenCrumbs, Math.floor(finiteNumber(raw.prestigeClaimed, finiteNumber(raw.totalGoldenCrumbs, base.goldenCrumbs))));
    base.selectedMachine = clamp(Math.floor(finiteNumber(raw.selectedMachine, 0)), 0, MACHINES.length - 1);
    base.combo = Math.max(0, Math.floor(finiteNumber(raw.combo, 0)));
    base.hotMeter = clamp(finiteNumber(raw.hotMeter, 0), 0, 100);
    base.hotUntil = Math.max(0, finiteNumber(raw.hotUntil, 0));

    if (raw.perks && typeof raw.perks === "object") {
      PERKS.forEach(function (perk) {
        base.perks[perk.id] = clamp(Math.floor(finiteNumber(raw.perks[perk.id], 0)), 0, perk.max);
      });
    }

    if (Array.isArray(raw.machines)) {
      MACHINES.forEach(function (_, index) {
        var incoming = raw.machines[index] || {};
        var target = base.machines[index];
        target.unlocked = index === 0 || Boolean(incoming.unlocked);
        target.level = target.unlocked ? Math.max(1, Math.floor(finiteNumber(incoming.level, target.level || 1))) : 0;
        target.autoLevel = Math.max(0, Math.floor(finiteNumber(incoming.autoLevel, finiteNumber(incoming.auto, 0))));
        target.autoEnabled = incoming.autoEnabled !== false;
        target.autoProgress = clamp(finiteNumber(incoming.autoProgress, 0), 0, 1);
      });
    }

    if (raw.settings && typeof raw.settings === "object") {
      base.settings.musicVolume = clamp(finiteNumber(raw.settings.musicVolume, finiteNumber(raw.settings.music, base.settings.musicVolume)), 0, 1);
      base.settings.sfxVolume = clamp(finiteNumber(raw.settings.sfxVolume, finiteNumber(raw.settings.sfx, base.settings.sfxVolume)), 0, 1);
      base.settings.muted = Boolean(raw.settings.muted);
      base.settings.compactNumbers = raw.settings.compactNumbers !== false;
    }

    if (raw.stats && typeof raw.stats === "object") {
      Object.keys(base.stats).forEach(function (key) {
        base.stats[key] = Math.max(0, finiteNumber(raw.stats[key], base.stats[key]));
      });
    }
    base.stats.lifetimeCrumbs = Math.max(base.stats.lifetimeCrumbs, finiteNumber(raw.lifetimeCrumbs, 0), base.crumbs);
    base.stats.highestBalance = Math.max(base.stats.highestBalance, base.crumbs);

    if (raw.achievements && typeof raw.achievements === "object") {
      ACHIEVEMENTS.forEach(function (achievement) {
        if (raw.achievements[achievement.id]) base.achievements[achievement.id] = true;
      });
    }

    base.lastSave = Math.max(0, finiteNumber(raw.lastSave, finiteNumber(raw.savedAt, Number(now || Date.now()))));
    base.version = VERSION;
    return base;
  }

  function weightedSymbol(machineIndex, luckRank, random) {
    var rng = typeof random === "function" ? random : Math.random;
    var rareBoost = 1 + Math.max(0, luckRank || 0) * 0.045 + machineIndex * 0.018;
    var weights = SYMBOLS.map(function (symbol, index) {
      return symbol.weight * (index >= 4 ? rareBoost : 1);
    });
    var total = weights.reduce(function (a, b) { return a + b; }, 0);
    var roll = clamp(rng(), 0, 0.999999999) * total;
    for (var i = 0; i < weights.length; i += 1) {
      roll -= weights[i];
      if (roll < 0) return SYMBOLS[i];
    }
    return SYMBOLS[0];
  }

  function levelMultiplier(level) {
    var safeLevel = Math.max(1, level || 1);
    return Math.pow(1.145, safeLevel - 1) * (1 + Math.floor(safeLevel / 10) * 0.35);
  }

  function permanentMultiplier(state) {
    return (1 + state.prestigeClaimed * 0.045) * (1 + state.perks.power * 0.15);
  }

  function isHot(state, now) {
    return finiteNumber(state.hotUntil, 0) > Number(now || Date.now());
  }

  function spinReward(state, machineIndex, reels, now) {
    var machine = MACHINES[machineIndex];
    var owned = state.machines[machineIndex];
    var counts = {};
    reels.forEach(function (symbol) { counts[symbol.id] = (counts[symbol.id] || 0) + 1; });
    var best = 1;
    var matchingSymbol = reels[0];
    reels.forEach(function (symbol) {
      if (counts[symbol.id] > best) {
        best = counts[symbol.id];
        matchingSymbol = symbol;
      }
    });

    var average = reels.reduce(function (sum, symbol) { return sum + symbol.value; }, 0) / reels.length;
    var patternMultiplier = best === 3 ? 12 * matchingSymbol.value : best === 2 ? 3.2 * matchingSymbol.value : 0.65 * average;
    var jackpot = best === 3 && matchingSymbol.id === "crown";
    if (jackpot) patternMultiplier *= 20;

    var comboMultiplier = 1 + Math.min(state.combo, 50) * 0.025;
    var hotMultiplier = isHot(state, now) ? 2 : 1;
    var reward = machine.baseYield * levelMultiplier(owned.level) * permanentMultiplier(state) * patternMultiplier * comboMultiplier * hotMultiplier;
    return {
      amount: Math.max(1, Math.floor(reward)),
      match: best,
      symbol: matchingSymbol,
      jackpot: jackpot,
      hot: hotMultiplier > 1,
      patternMultiplier: patternMultiplier
    };
  }

  function performSpin(state, machineIndex, random, now) {
    var index = clamp(Math.floor(machineIndex), 0, MACHINES.length - 1);
    if (!state.machines[index].unlocked) return { ok: false, reason: "locked", reels: [] };
    var reels = [
      weightedSymbol(index, state.perks.luck, random),
      weightedSymbol(index, state.perks.luck, random),
      weightedSymbol(index, state.perks.luck, random)
    ];
    var result = spinReward(state, index, reels, now);

    state.stats.spins += 1;
    if (result.match >= 2) {
      state.combo += 1;
      state.stats.matches += 1;
      state.hotMeter = clamp(state.hotMeter + (result.match === 3 ? 24 : 11), 0, 100);
    } else {
      state.combo = Math.max(0, state.combo - 1);
      state.hotMeter = clamp(state.hotMeter + 2, 0, 100);
    }
    if (result.match === 3) state.stats.triples += 1;
    if (result.jackpot) state.stats.jackpots += 1;

    if (state.hotMeter >= 100) {
      state.hotMeter = 0;
      state.hotUntil = Number(now || Date.now()) + (20 + state.perks.heat * 2) * 1000;
      state.stats.hotOvens += 1;
      result.hotTriggered = true;
    }

    state.stats.bestCombo = Math.max(state.stats.bestCombo, state.combo);
    addCrumbs(state, result.amount);
    result.ok = true;
    result.reels = reels;
    result.combo = state.combo;
    return result;
  }

  function addCrumbs(state, amount) {
    var value = Math.max(0, finiteNumber(amount, 0));
    state.crumbs += value;
    state.stats.lifetimeCrumbs += value;
    state.stats.highestBalance = Math.max(state.stats.highestBalance, state.crumbs);
    return value;
  }

  function upgradeCost(machineIndex, level) {
    var machine = MACHINES[machineIndex];
    var safeLevel = Math.max(1, Math.floor(level || 1));
    return Math.floor(machine.baseYield * 42 * Math.pow(1.19, safeLevel - 1) + 20);
  }

  function autoCost(machineIndex, autoLevel) {
    var machine = MACHINES[machineIndex];
    var safeLevel = Math.max(0, Math.floor(autoLevel || 0));
    return Math.floor(machine.baseYield * 180 * Math.pow(1.72, safeLevel) + 120);
  }

  function autoInterval(machineIndex, autoLevel) {
    var base = MACHINES[machineIndex].autoInterval;
    return Math.max(0.42, base * Math.pow(0.91, Math.max(0, autoLevel - 1)));
  }

  function expectedSpinReward(state, machineIndex) {
    var machine = MACHINES[machineIndex];
    var owned = state.machines[machineIndex];
    return machine.baseYield * levelMultiplier(owned.level) * permanentMultiplier(state) * 4.6;
  }

  function autoCrumbsPerSecond(state) {
    return state.machines.reduce(function (total, owned, index) {
      if (!owned.unlocked || !owned.autoEnabled || owned.autoLevel <= 0) return total;
      return total + expectedSpinReward(state, index) * owned.autoLevel / autoInterval(index, owned.autoLevel);
    }, 0);
  }

  function offlineProgress(state, now) {
    var current = Number(now || Date.now());
    var elapsed = clamp((current - finiteNumber(state.lastSave, current)) / 1000, 0, MAX_OFFLINE_SECONDS);
    var rate = autoCrumbsPerSecond(state);
    var offlineMultiplier = 0.35 + state.perks.offline * 0.1;
    var amount = Math.floor(rate * elapsed * offlineMultiplier);
    if (amount > 0) addCrumbs(state, amount);
    state.stats.offlineSeconds += elapsed;
    state.lastSave = current;
    return { seconds: elapsed, amount: amount, rate: rate };
  }

  function prestigePotential(state) {
    return Math.floor(Math.sqrt(Math.max(0, state.stats.lifetimeCrumbs) / 1000000));
  }

  function prestigeGain(state) {
    return Math.max(0, prestigePotential(state) - state.prestigeClaimed);
  }

  function applyPrestige(state, now) {
    var gain = prestigeGain(state);
    if (gain < 1) return { ok: false, gain: 0 };
    var golden = state.goldenCrumbs + gain;
    var claimed = state.prestigeClaimed + gain;
    var perks = Object.assign({}, state.perks);
    var settings = Object.assign({}, state.settings);
    var achievements = Object.assign({}, state.achievements);
    var stats = Object.assign({}, state.stats);
    var fresh = createState(now);
    Object.keys(state).forEach(function (key) { delete state[key]; });
    Object.assign(state, fresh);
    state.goldenCrumbs = golden;
    state.prestigeClaimed = claimed;
    state.perks = perks;
    state.settings = settings;
    state.achievements = achievements;
    state.stats = stats;
    state.stats.prestiges += 1;
    state.lastSave = Number(now || Date.now());
    return { ok: true, gain: gain };
  }

  function perkCost(perkId, rank) {
    var perk = PERKS.find(function (item) { return item.id === perkId; });
    if (!perk) return Infinity;
    return Math.ceil(perk.baseCost * Math.pow(1.65, Math.max(0, rank || 0)));
  }

  function purchasePerk(state, perkId) {
    var perk = PERKS.find(function (item) { return item.id === perkId; });
    if (!perk) return { ok: false, reason: "missing" };
    var rank = state.perks[perkId] || 0;
    if (rank >= perk.max) return { ok: false, reason: "max" };
    var cost = perkCost(perkId, rank);
    if (state.goldenCrumbs < cost) return { ok: false, reason: "funds", cost: cost };
    state.goldenCrumbs -= cost;
    state.perks[perkId] = rank + 1;
    return { ok: true, cost: cost, rank: rank + 1 };
  }

  function checkAchievements(state) {
    var unlocked = [];
    ACHIEVEMENTS.forEach(function (achievement) {
      if (!state.achievements[achievement.id] && achievement.test(state)) {
        state.achievements[achievement.id] = true;
        unlocked.push(achievement);
      }
    });
    var completion = ACHIEVEMENTS[ACHIEVEMENTS.length - 1];
    if (!state.achievements[completion.id] && completion.test(state)) {
      state.achievements[completion.id] = true;
      unlocked.push(completion);
    }
    return unlocked;
  }

  function formatNumber(value, compact) {
    var n = finiteNumber(value, 0);
    if (!compact || Math.abs(n) < 1000) return Math.floor(n).toLocaleString("en-US");
    var units = [
      { value: 1e24, suffix: "Sp" },
      { value: 1e21, suffix: "Sx" },
      { value: 1e18, suffix: "Qi" },
      { value: 1e15, suffix: "Qa" },
      { value: 1e12, suffix: "T" },
      { value: 1e9, suffix: "B" },
      { value: 1e6, suffix: "M" },
      { value: 1e3, suffix: "K" }
    ];
    for (var i = 0; i < units.length; i += 1) {
      if (Math.abs(n) >= units[i].value) {
        var scaled = n / units[i].value;
        var digits = Math.abs(scaled) >= 100 ? 0 : Math.abs(scaled) >= 10 ? 1 : 2;
        return scaled.toFixed(digits).replace(/\.0+$|(\.\d*[1-9])0+$/, "$1") + units[i].suffix;
      }
    }
    return String(Math.floor(n));
  }

  function serialize(state, now) {
    state.lastSave = Number(now || Date.now());
    return JSON.stringify(state);
  }

  function parseSave(text, now) {
    try {
      return migrateState(JSON.parse(text), now);
    } catch (_) {
      return null;
    }
  }

  return {
    VERSION: VERSION,
    SAVE_KEYS: SAVE_KEYS,
    MAX_OFFLINE_SECONDS: MAX_OFFLINE_SECONDS,
    SYMBOLS: SYMBOLS,
    MACHINES: MACHINES,
    PERKS: PERKS,
    ACHIEVEMENTS: ACHIEVEMENTS,
    createState: createState,
    migrateState: migrateState,
    weightedSymbol: weightedSymbol,
    levelMultiplier: levelMultiplier,
    permanentMultiplier: permanentMultiplier,
    spinReward: spinReward,
    performSpin: performSpin,
    addCrumbs: addCrumbs,
    upgradeCost: upgradeCost,
    autoCost: autoCost,
    autoInterval: autoInterval,
    expectedSpinReward: expectedSpinReward,
    autoCrumbsPerSecond: autoCrumbsPerSecond,
    offlineProgress: offlineProgress,
    prestigePotential: prestigePotential,
    prestigeGain: prestigeGain,
    applyPrestige: applyPrestige,
    perkCost: perkCost,
    purchasePerk: purchasePerk,
    checkAchievements: checkAchievements,
    formatNumber: formatNumber,
    serialize: serialize,
    parseSave: parseSave,
    isHot: isHot,
    clamp: clamp
  };
});
