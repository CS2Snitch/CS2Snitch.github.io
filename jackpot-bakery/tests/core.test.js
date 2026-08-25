"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const Core = require("../core.js");

test("creates a valid new bakery state", function () {
  const state = Core.createState(1234);
  assert.equal(state.version, 2);
  assert.equal(state.crumbs, 25);
  assert.equal(state.machines.length, 5);
  assert.equal(state.machines[0].unlocked, true);
  assert.equal(state.machines[1].unlocked, false);
  assert.equal(state.lastSave, 1234);
});

test("migrates common version-one save fields", function () {
  const migrated = Core.migrateState({
    cookies: 450,
    prestigeCurrency: 3,
    settings: { music: .2, sfx: .4 },
    machines: [{ unlocked: true, level: 7, auto: 2 }]
  }, 2000);
  assert.equal(migrated.crumbs, 450);
  assert.equal(migrated.goldenCrumbs, 3);
  assert.equal(migrated.settings.musicVolume, .2);
  assert.equal(migrated.machines[0].level, 7);
  assert.equal(migrated.machines[0].autoLevel, 2);
});

test("sanitizes corrupted numeric save values", function () {
  const migrated = Core.migrateState({
    crumbs: -50,
    selectedMachine: 99,
    combo: -3,
    hotMeter: 999,
    settings: { musicVolume: 8, sfxVolume: -4 }
  }, 3000);
  assert.equal(migrated.crumbs, 0);
  assert.equal(migrated.selectedMachine, 4);
  assert.equal(migrated.combo, 0);
  assert.equal(migrated.hotMeter, 100);
  assert.equal(migrated.settings.musicVolume, 1);
  assert.equal(migrated.settings.sfxVolume, 0);
});

test("weighted symbol selection reaches common and rare edges", function () {
  assert.equal(Core.weightedSymbol(0, 0, function () { return 0; }).id, "crumb");
  assert.equal(Core.weightedSymbol(4, 12, function () { return .999999; }).id, "crown");
});

test("upgrade curves and level multipliers grow predictably", function () {
  assert.ok(Core.levelMultiplier(10) > Core.levelMultiplier(1));
  assert.ok(Core.upgradeCost(0, 5) > Core.upgradeCost(0, 1));
  assert.ok(Core.autoCost(0, 3) > Core.autoCost(0, 0));
  assert.ok(Core.autoInterval(0, 5) < Core.autoInterval(0, 1));
});

test("locked ovens cannot spin", function () {
  const state = Core.createState(1);
  const result = Core.performSpin(state, 1, function () { return 0; }, 1000);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "locked");
  assert.equal(state.stats.spins, 0);
});

test("a deterministic triple awards crumbs and statistics", function () {
  const state = Core.createState(1);
  const result = Core.performSpin(state, 0, function () { return 0; }, 1000);
  assert.equal(result.ok, true);
  assert.equal(result.match, 3);
  assert.equal(result.symbol.id, "crumb");
  assert.ok(result.amount > 0);
  assert.equal(state.stats.spins, 1);
  assert.equal(state.stats.triples, 1);
  assert.ok(state.crumbs > 25);
});

test("three crowns trigger the fictional jackpot", function () {
  const state = Core.createState(1);
  const result = Core.performSpin(state, 0, function () { return .999999; }, 1000);
  assert.equal(result.jackpot, true);
  assert.equal(state.stats.jackpots, 1);
  assert.ok(result.amount > 1000);
});

test("a full heat meter triggers timed Hot Oven mode", function () {
  const state = Core.createState(1);
  state.hotMeter = 95;
  const result = Core.performSpin(state, 0, function () { return 0; }, 5000);
  assert.equal(result.hotTriggered, true);
  assert.equal(state.hotMeter, 0);
  assert.equal(state.stats.hotOvens, 1);
  assert.ok(state.hotUntil > 5000);
});

test("automatic production is zero before hiring a baker", function () {
  const state = Core.createState(1);
  assert.equal(Core.autoCrumbsPerSecond(state), 0);
});

test("automatic production increases with baker ranks", function () {
  const state = Core.createState(1);
  state.machines[0].autoLevel = 1;
  const first = Core.autoCrumbsPerSecond(state);
  state.machines[0].autoLevel = 4;
  const fourth = Core.autoCrumbsPerSecond(state);
  assert.ok(first > 0);
  assert.ok(fourth > first);
});

test("offline progress is capped at eight hours", function () {
  const state = Core.createState(1);
  state.lastSave = 1;
  state.machines[0].autoLevel = 2;
  const report = Core.offlineProgress(state, 1 + Core.MAX_OFFLINE_SECONDS * 3000);
  assert.equal(report.seconds, Core.MAX_OFFLINE_SECONDS);
  assert.ok(report.amount > 0);
  assert.equal(state.stats.offlineSeconds, Core.MAX_OFFLINE_SECONDS);
});

test("prestige potential follows lifetime crumb milestones", function () {
  const state = Core.createState(1);
  state.stats.lifetimeCrumbs = 9000000;
  assert.equal(Core.prestigePotential(state), 3);
  assert.equal(Core.prestigeGain(state), 3);
  state.prestigeClaimed = 2;
  assert.equal(Core.prestigeGain(state), 1);
});

test("prestige resets ovens but preserves permanent data", function () {
  const state = Core.createState(1);
  state.stats.lifetimeCrumbs = 4000000;
  state.crumbs = 900000;
  state.machines[1].unlocked = true;
  state.machines[1].level = 8;
  state.perks.power = 2;
  state.settings.musicVolume = .25;
  const result = Core.applyPrestige(state, 9999);
  assert.equal(result.ok, true);
  assert.equal(result.gain, 2);
  assert.equal(state.goldenCrumbs, 2);
  assert.equal(state.perks.power, 2);
  assert.equal(state.settings.musicVolume, .25);
  assert.equal(state.machines[1].unlocked, false);
  assert.equal(state.stats.prestiges, 1);
});

test("Golden Crumb perks charge the correct currency", function () {
  const state = Core.createState(1);
  state.goldenCrumbs = 10;
  const cost = Core.perkCost("power", 0);
  const result = Core.purchasePerk(state, "power");
  assert.equal(result.ok, true);
  assert.equal(result.cost, cost);
  assert.equal(state.perks.power, 1);
  assert.equal(state.goldenCrumbs, 10 - cost);
});

test("achievement catalog contains and unlocks all 25 goals", function () {
  const state = Core.createState(1);
  assert.equal(Core.ACHIEVEMENTS.length, 25);
  state.stats.spins = 1;
  const unlocked = Core.checkAchievements(state);
  assert.ok(unlocked.some(function (item) { return item.id === "first_bake"; }));
  assert.equal(state.achievements.first_bake, true);
});

test("number formatting and save parsing remain stable", function () {
  assert.equal(Core.formatNumber(1250, true), "1.25K");
  assert.equal(Core.formatNumber(1250, false), "1,250");
  const original = Core.createState(77);
  original.crumbs = 12345;
  const parsed = Core.parseSave(Core.serialize(original, 88), 99);
  assert.equal(parsed.crumbs, 12345);
  assert.equal(parsed.version, 2);
  assert.equal(Core.parseSave("not-json", 99), null);
});

test("generated theme is true 48 kHz stereo 16-bit PCM", function () {
  const musicPath = path.join(__dirname, "..", "assets", "audio", "jackpot-bakery-theme-48k.wav");
  const wav = fs.readFileSync(musicPath);
  assert.equal(wav.toString("ascii", 0, 4), "RIFF");
  assert.equal(wav.toString("ascii", 8, 12), "WAVE");
  assert.equal(wav.readUInt16LE(20), 1);
  assert.equal(wav.readUInt16LE(22), 2);
  assert.equal(wav.readUInt32LE(24), 48000);
  assert.equal(wav.readUInt16LE(34), 16);
  const dataBytes = wav.readUInt32LE(40);
  const frames = dataBytes / 4;
  assert.equal(frames / 48000, 60);
});
