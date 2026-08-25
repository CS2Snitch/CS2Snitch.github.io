(function () {
  "use strict";

  var Core = window.JackpotCore;
  if (!Core) throw new Error("JackpotCore failed to load.");

  var state = loadState();
  var spinning = false;
  var lastFrame = performance.now();
  var lastUiRefresh = 0;
  var lastAutosave = performance.now();
  var audioContext = null;
  var audioUnlocked = false;
  var gamepadPrevious = {};
  var confirmAction = null;

  var els = {
    crumbCount: byId("crumbCount"),
    goldCount: byId("goldCount"),
    crumbRate: byId("crumbRate"),
    machineCount: byId("machineCount"),
    machineList: byId("machineList"),
    activeMachineName: byId("activeMachineName"),
    activeMachineSubtitle: byId("activeMachineSubtitle"),
    activeLevel: byId("activeLevel"),
    hotStatus: byId("hotStatus"),
    comboLabel: byId("comboLabel"),
    hotMeterFill: byId("hotMeterFill"),
    slotCabinet: byId("slotCabinet"),
    reels: Array.prototype.slice.call(document.querySelectorAll(".reel")),
    spinButton: byId("spinButton"),
    spinResult: byId("spinResult"),
    levelUpgradeButton: byId("levelUpgradeButton"),
    levelUpgradeEffect: byId("levelUpgradeEffect"),
    levelUpgradeCost: byId("levelUpgradeCost"),
    autoUpgradeButton: byId("autoUpgradeButton"),
    autoUpgradeTitle: byId("autoUpgradeTitle"),
    autoUpgradeEffect: byId("autoUpgradeEffect"),
    autoUpgradeCost: byId("autoUpgradeCost"),
    autoToggle: byId("autoToggle"),
    autoProgressFill: byId("autoProgressFill"),
    autoTimer: byId("autoTimer"),
    statLifetime: byId("statLifetime"),
    statSpins: byId("statSpins"),
    statCombo: byId("statCombo"),
    statJackpots: byId("statJackpots"),
    statProduction: byId("statProduction"),
    prestigeGain: byId("prestigeGain"),
    prestigeButton: byId("prestigeButton"),
    prestigeHint: byId("prestigeHint"),
    perkList: byId("perkList"),
    saveStatus: byId("saveStatus"),
    musicStatus: byId("musicStatus"),
    toastStack: byId("toastStack"),
    achievementsButton: byId("achievementsButton"),
    settingsButton: byId("settingsButton"),
    fullscreenButton: byId("fullscreenButton"),
    achievementsDialog: byId("achievementsDialog"),
    settingsDialog: byId("settingsDialog"),
    achievementProgress: byId("achievementProgress"),
    achievementMeter: byId("achievementMeter"),
    achievementGrid: byId("achievementGrid"),
    musicVolume: byId("musicVolume"),
    musicVolumeOutput: byId("musicVolumeOutput"),
    sfxVolume: byId("sfxVolume"),
    sfxVolumeOutput: byId("sfxVolumeOutput"),
    muteToggle: byId("muteToggle"),
    compactToggle: byId("compactToggle"),
    dialogFullscreenButton: byId("dialogFullscreenButton"),
    exportButton: byId("exportButton"),
    importButton: byId("importButton"),
    resetButton: byId("resetButton"),
    saveText: byId("saveText"),
    confirmDialog: byId("confirmDialog"),
    confirmTitle: byId("confirmTitle"),
    confirmMessage: byId("confirmMessage"),
    confirmAccept: byId("confirmAccept"),
    themeMusic: byId("themeMusic")
  };

  function byId(id) {
    return document.getElementById(id);
  }

  function loadState() {
    var now = Date.now();
    for (var i = 0; i < Core.SAVE_KEYS.length; i += 1) {
      var raw = localStorage.getItem(Core.SAVE_KEYS[i]);
      if (!raw) continue;
      var parsed = Core.parseSave(raw, now);
      if (parsed) return parsed;
    }
    return Core.createState(now);
  }

  function saveGame(showStatus) {
    try {
      var text = Core.serialize(state, Date.now());
      localStorage.setItem(Core.SAVE_KEYS[0], text);
      for (var i = 1; i < Core.SAVE_KEYS.length; i += 1) {
        if (localStorage.getItem(Core.SAVE_KEYS[i])) localStorage.removeItem(Core.SAVE_KEYS[i]);
      }
      if (showStatus !== false) {
        els.saveStatus.textContent = "Saved " + new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return true;
    } catch (error) {
      toast("Save error", "The browser could not store your bakery save.");
      return false;
    }
  }

  function number(value) {
    return Core.formatNumber(value, state.settings.compactNumbers);
  }

  function loadOfflineProgress() {
    var report = Core.offlineProgress(state, Date.now());
    if (report.amount > 0 && report.seconds >= 20) {
      var minutes = Math.floor(report.seconds / 60);
      toast("Welcome back, baker!", "Your night crew baked " + number(report.amount) + " crumbs in " + (minutes >= 60 ? (minutes / 60).toFixed(1) + " hours" : Math.max(1, minutes) + " minutes") + ".");
    }
    saveGame(false);
  }

  function renderAll() {
    renderCurrencies();
    renderMachines();
    renderStage();
    renderStats();
    renderPrestige();
    renderPerks();
    renderAchievements();
    renderSettings();
  }

  function renderCurrencies() {
    els.crumbCount.textContent = number(state.crumbs);
    els.goldCount.textContent = number(state.goldenCrumbs);
    els.crumbRate.textContent = number(Core.autoCrumbsPerSecond(state));
  }

  function renderMachines() {
    els.machineList.textContent = "";
    var unlockedCount = 0;

    Core.MACHINES.forEach(function (machine, index) {
      var owned = state.machines[index];
      if (owned.unlocked) unlockedCount += 1;

      var button = document.createElement("button");
      button.type = "button";
      button.className = "machine-card" + (state.selectedMachine === index ? " active" : "") + (owned.unlocked ? "" : " locked");
      button.style.setProperty("--machine-accent", machine.accent);
      button.setAttribute("aria-pressed", state.selectedMachine === index ? "true" : "false");

      var art = document.createElement("span");
      art.className = "machine-art";
      art.textContent = owned.unlocked ? ["●", "✦", "◆", "☾", "♛"][index] : "×";

      var info = document.createElement("span");
      info.className = "machine-info";
      var name = document.createElement("strong");
      name.textContent = machine.name;
      var detail = document.createElement("small");
      detail.textContent = owned.unlocked ? "Level " + owned.level + " • Auto " + owned.autoLevel : "Locked oven";
      var price = document.createElement("em");
      price.textContent = owned.unlocked ? number(Core.expectedSpinReward(state, index)) + " avg. batch" : number(machine.unlockCost) + " crumbs to unlock";

      info.appendChild(name);
      info.appendChild(detail);
      info.appendChild(price);
      button.appendChild(art);
      button.appendChild(info);
      button.addEventListener("click", function () {
        if (owned.unlocked) {
          state.selectedMachine = index;
          playSfx("select");
          renderAll();
        } else {
          unlockMachine(index);
        }
      });
      els.machineList.appendChild(button);
    });

    els.machineCount.textContent = unlockedCount + " / " + Core.MACHINES.length;
  }

  function renderStage() {
    var index = state.selectedMachine;
    var machine = Core.MACHINES[index];
    var owned = state.machines[index];
    var levelCost = Core.upgradeCost(index, owned.level);
    var bakerCost = Core.autoCost(index, owned.autoLevel);
    var now = Date.now();
    var hot = Core.isHot(state, now);

    els.activeMachineName.textContent = machine.name;
    els.activeMachineSubtitle.textContent = machine.subtitle.toUpperCase();
    els.activeLevel.textContent = owned.level;
    els.comboLabel.textContent = "COMBO ×" + state.combo;
    els.hotMeterFill.style.width = (hot ? 100 : state.hotMeter) + "%";
    els.hotStatus.textContent = hot ? Math.max(0, (state.hotUntil - now) / 1000).toFixed(1) + "s • 2× rewards" : "Build heat with matches";
    els.slotCabinet.classList.toggle("hot", hot);

    els.levelUpgradeCost.textContent = number(levelCost);
    els.levelUpgradeButton.disabled = state.crumbs < levelCost || spinning;
    els.levelUpgradeEffect.textContent = "+14.5% base output • next level " + (owned.level + 1);

    els.autoUpgradeCost.textContent = number(bakerCost);
    els.autoUpgradeButton.disabled = state.crumbs < bakerCost || spinning;
    els.autoUpgradeTitle.textContent = owned.autoLevel > 0 ? "Train Baker • Rank " + owned.autoLevel : "Hire First Baker";
    els.autoUpgradeEffect.textContent = owned.autoLevel > 0 ? "Faster automatic batches" : "Bakes while you play";

    els.autoToggle.checked = owned.autoEnabled;
    els.autoToggle.disabled = owned.autoLevel < 1;
    els.autoProgressFill.style.width = (owned.autoProgress * 100) + "%";
    els.autoTimer.textContent = owned.autoLevel < 1 ? "No baker hired" : owned.autoEnabled ? (Core.autoInterval(index, owned.autoLevel) / owned.autoLevel).toFixed(1) + "s per batch" : "Paused";

    els.spinButton.disabled = spinning || !owned.unlocked;
  }

  function renderStats() {
    var rate = Core.autoCrumbsPerSecond(state);
    els.statLifetime.textContent = number(state.stats.lifetimeCrumbs);
    els.statSpins.textContent = number(state.stats.spins);
    els.statCombo.textContent = number(state.stats.bestCombo);
    els.statJackpots.textContent = number(state.stats.jackpots);
    els.statProduction.textContent = number(rate) + "/s";
  }

  function renderPrestige() {
    var gain = Core.prestigeGain(state);
    els.prestigeGain.textContent = number(gain);
    els.prestigeButton.disabled = gain < 1;
    var potential = Core.prestigePotential(state);
    if (gain > 0) {
      els.prestigeHint.textContent = "Ready: permanent power will increase after reset.";
    } else {
      var nextClaim = Math.max(state.prestigeClaimed + 1, potential + 1);
      var needed = nextClaim * nextClaim * 1000000;
      els.prestigeHint.textContent = number(Math.max(0, needed - state.stats.lifetimeCrumbs)) + " more lifetime crumbs until the next reward.";
    }
  }

  function renderPerks() {
    els.perkList.textContent = "";
    Core.PERKS.forEach(function (perk) {
      var rank = state.perks[perk.id] || 0;
      var cost = Core.perkCost(perk.id, rank);
      var button = document.createElement("button");
      button.type = "button";
      button.className = "perk-item";
      button.disabled = rank >= perk.max || state.goldenCrumbs < cost;

      var copy = document.createElement("span");
      var title = document.createElement("strong");
      title.textContent = perk.name + " • " + rank + "/" + perk.max;
      var description = document.createElement("small");
      description.textContent = perk.description;
      copy.appendChild(title);
      copy.appendChild(description);

      var price = document.createElement("span");
      price.className = "perk-price";
      price.textContent = rank >= perk.max ? "MAX" : cost + " ◆";

      button.appendChild(copy);
      button.appendChild(price);
      button.addEventListener("click", function () {
        var result = Core.purchasePerk(state, perk.id);
        if (result.ok) {
          playSfx("upgrade");
          toast("Golden recipe improved", perk.name + " reached rank " + result.rank + ".");
          afterChange();
        }
      });
      els.perkList.appendChild(button);
    });
  }

  function renderAchievements() {
    els.achievementGrid.textContent = "";
    var count = 0;
    Core.ACHIEVEMENTS.forEach(function (achievement, index) {
      var unlocked = Boolean(state.achievements[achievement.id]);
      if (unlocked) count += 1;
      var card = document.createElement("article");
      card.className = "achievement-card" + (unlocked ? "" : " locked");
      var icon = document.createElement("span");
      icon.className = "achievement-icon";
      icon.textContent = unlocked ? ["★", "◆", "●", "♛"][index % 4] : "?";
      var copy = document.createElement("span");
      var title = document.createElement("strong");
      title.textContent = achievement.name;
      var detail = document.createElement("small");
      detail.textContent = achievement.description;
      copy.appendChild(title);
      copy.appendChild(detail);
      card.appendChild(icon);
      card.appendChild(copy);
      els.achievementGrid.appendChild(card);
    });
    els.achievementProgress.textContent = count + " / " + Core.ACHIEVEMENTS.length + " unlocked";
    els.achievementMeter.style.width = (count / Core.ACHIEVEMENTS.length * 100) + "%";
  }

  function renderSettings() {
    var musicPercent = Math.round(state.settings.musicVolume * 100);
    var sfxPercent = Math.round(state.settings.sfxVolume * 100);
    els.musicVolume.value = musicPercent;
    els.musicVolumeOutput.value = musicPercent + "%";
    els.musicVolumeOutput.textContent = musicPercent + "%";
    els.sfxVolume.value = sfxPercent;
    els.sfxVolumeOutput.value = sfxPercent + "%";
    els.sfxVolumeOutput.textContent = sfxPercent + "%";
    els.muteToggle.checked = state.settings.muted;
    els.compactToggle.checked = state.settings.compactNumbers;
    applyAudioSettings();
  }

  function unlockMachine(index) {
    var machine = Core.MACHINES[index];
    var owned = state.machines[index];
    if (owned.unlocked) return;
    if (state.crumbs < machine.unlockCost) {
      toast("More crumbs needed", "Bake " + number(machine.unlockCost - state.crumbs) + " more crumbs to unlock " + machine.name + ".");
      playSfx("error");
      return;
    }
    state.crumbs -= machine.unlockCost;
    owned.unlocked = true;
    owned.level = 1;
    state.selectedMachine = index;
    playSfx("unlock");
    toast("New oven unlocked!", machine.name + " has joined the bakery floor.");
    afterChange();
  }

  function purchaseLevel() {
    var index = state.selectedMachine;
    var owned = state.machines[index];
    var cost = Core.upgradeCost(index, owned.level);
    if (state.crumbs < cost) return playSfx("error");
    state.crumbs -= cost;
    owned.level += 1;
    playSfx("upgrade");
    afterChange();
  }

  function purchaseAuto() {
    var index = state.selectedMachine;
    var owned = state.machines[index];
    var cost = Core.autoCost(index, owned.autoLevel);
    if (state.crumbs < cost) return playSfx("error");
    state.crumbs -= cost;
    owned.autoLevel += 1;
    owned.autoEnabled = true;
    playSfx("upgrade");
    if (owned.autoLevel === 1) toast("Auto-baker hired", Core.MACHINES[index].name + " now produces while you play and while you are away.");
    afterChange();
  }

  function spin(auto) {
    if (spinning) return;
    var owned = state.machines[state.selectedMachine];
    if (!owned.unlocked) return;
    unlockAudio();
    spinning = true;
    els.reels.forEach(function (reel) { reel.classList.add("spinning"); });
    els.spinResult.className = "spin-result";
    els.spinResult.textContent = auto ? "Your auto-baker is loading the reels..." : "Mixing a fresh batch...";
    playSfx("spin");
    renderStage();

    var delay = auto ? 420 : 620;
    window.setTimeout(function () {
      var result = Core.performSpin(state, state.selectedMachine, Math.random, Date.now());
      updateReels(result.reels);
      els.reels.forEach(function (reel) { reel.classList.remove("spinning"); });

      if (result.jackpot) {
        els.spinResult.textContent = "ROYAL JACKPOT! +" + number(result.amount) + " crumbs!";
        playSfx("jackpot");
        toast("Royal Recipe Jackpot!", "Three Baker Crowns baked " + number(result.amount) + " crumbs.");
      } else if (result.match === 3) {
        els.spinResult.textContent = "Perfect triple! +" + number(result.amount) + " crumbs";
        playSfx("triple");
      } else if (result.match === 2) {
        els.spinResult.textContent = "Sweet pair! +" + number(result.amount) + " crumbs";
        playSfx("match");
      } else {
        els.spinResult.textContent = "Fresh batch: +" + number(result.amount) + " crumbs";
        playSfx("crumb");
      }
      if (result.match >= 2) els.spinResult.className = "spin-result win";
      if (result.hotTriggered) toast("HOT OVEN!", "All crumb rewards are doubled while the oven glows.");

      spinning = false;
      afterChange(false);
    }, delay);
  }

  function updateReels(reels) {
    reels.forEach(function (symbol, index) {
      var reel = els.reels[index];
      var icon = reel.querySelector(".symbol");
      var label = reel.querySelector("small");
      icon.className = "symbol symbol-" + symbol.id;
      icon.textContent = symbol.glyph;
      label.textContent = symbol.label.toUpperCase();
    });
  }

  function processAuto(deltaSeconds) {
    state.machines.forEach(function (owned, index) {
      if (!owned.unlocked || !owned.autoEnabled || owned.autoLevel <= 0) return;
      var interval = Core.autoInterval(index, owned.autoLevel);
      owned.autoProgress += deltaSeconds * owned.autoLevel / interval;
      var batches = Math.min(1000, Math.floor(owned.autoProgress));
      if (batches <= 0) return;
      owned.autoProgress -= batches;
      var reward = Core.expectedSpinReward(state, index) * batches;
      if (Core.isHot(state, Date.now())) reward *= 2;
      Core.addCrumbs(state, Math.floor(reward));
      state.stats.spins += batches;
    });
  }

  function afterChange(forceSave) {
    unlockNewAchievements();
    renderAll();
    if (forceSave !== false) saveGame(false);
  }

  function unlockNewAchievements() {
    var unlocked = Core.checkAchievements(state);
    unlocked.forEach(function (achievement, index) {
      window.setTimeout(function () {
        playSfx("achievement");
        toast("Achievement unlocked!", achievement.name + " — " + achievement.description);
      }, index * 180);
    });
  }

  function toast(title, message) {
    var node = document.createElement("div");
    node.className = "toast";
    var heading = document.createElement("strong");
    heading.textContent = title;
    var copy = document.createElement("span");
    copy.textContent = message;
    node.appendChild(heading);
    node.appendChild(copy);
    els.toastStack.appendChild(node);
    window.setTimeout(function () {
      node.classList.add("out");
      window.setTimeout(function () { node.remove(); }, 260);
    }, 4200);
  }

  function unlockAudio() {
    if (!audioContext) {
      var AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) audioContext = new AudioContextClass();
    }
    if (audioContext && audioContext.state === "suspended") audioContext.resume();
    if (!audioUnlocked) {
      audioUnlocked = true;
      applyAudioSettings();
      if (!state.settings.muted && state.settings.musicVolume > 0) {
        els.themeMusic.play().catch(function () {
          els.musicStatus.textContent = "♪ CLICK BAKE FOR MUSIC";
        });
      }
    }
  }

  function applyAudioSettings() {
    els.themeMusic.volume = state.settings.muted ? 0 : state.settings.musicVolume;
    els.themeMusic.muted = state.settings.muted;
    els.musicStatus.textContent = state.settings.muted || state.settings.musicVolume <= 0 ? "♪ MUSIC MUTED" : "♪ MIDNIGHT BATCH • 48 KHZ";
    if (audioUnlocked && !state.settings.muted && state.settings.musicVolume > 0 && els.themeMusic.paused) {
      els.themeMusic.play().catch(function () {});
    }
  }

  function playSfx(kind) {
    if (state.settings.muted || state.settings.sfxVolume <= 0) return;
    unlockAudio();
    if (!audioContext) return;

    var now = audioContext.currentTime;
    var gain = audioContext.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.001, state.settings.sfxVolume * 0.16), now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + (kind === "jackpot" ? 1.1 : .22));
    gain.connect(audioContext.destination);

    var notes = {
      spin: [220, 330],
      crumb: [392],
      match: [523, 659],
      triple: [523, 659, 784],
      jackpot: [523, 659, 784, 1047],
      upgrade: [330, 494],
      unlock: [262, 392, 523],
      select: [440],
      error: [150, 120],
      achievement: [659, 784, 988]
    }[kind] || [330];

    notes.forEach(function (frequency, index) {
      var oscillator = audioContext.createOscillator();
      var noteGain = audioContext.createGain();
      var start = now + index * (kind === "jackpot" ? .16 : .055);
      oscillator.type = kind === "error" ? "sawtooth" : "square";
      oscillator.frequency.setValueAtTime(frequency, start);
      noteGain.gain.setValueAtTime(.65 / Math.max(1, notes.length), start);
      noteGain.gain.exponentialRampToValueAtTime(.0001, start + .13);
      oscillator.connect(noteGain);
      noteGain.connect(gain);
      oscillator.start(start);
      oscillator.stop(start + .15);
    });
  }

  function toggleFullscreen() {
    if (window.jackpotDesktop && window.jackpotDesktop.toggleFullscreen) {
      window.jackpotDesktop.toggleFullscreen().catch(function () {});
      return;
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(function () {});
    } else {
      document.exitFullscreen().catch(function () {});
    }
  }

  function openDialog(dialog) {
    if (!dialog.open) dialog.showModal();
  }

  function askConfirmation(title, message, action, destructive) {
    els.confirmTitle.textContent = title;
    els.confirmMessage.textContent = message;
    els.confirmAccept.className = destructive ? "danger-button" : "gold-button";
    confirmAction = action;
    openDialog(els.confirmDialog);
  }

  function doPrestige() {
    var gain = Core.prestigeGain(state);
    if (gain < 1) return;
    askConfirmation(
      "Prestige Bakery",
      "Reset ovens, levels, auto-bakers, crumbs, combo, and heat for " + gain + " Golden Crumb" + (gain === 1 ? "" : "s") + "? Achievements, settings, statistics, and permanent perks stay.",
      function () {
        var result = Core.applyPrestige(state, Date.now());
        if (result.ok) {
          playSfx("jackpot");
          toast("A golden dawn", "You earned " + result.gain + " Golden Crumb" + (result.gain === 1 ? "" : "s") + ".");
          afterChange();
        }
      },
      false
    );
  }

  function exportSave() {
    saveGame(false);
    var json = Core.serialize(state, Date.now());
    try {
      els.saveText.value = "JB1:" + btoa(unescape(encodeURIComponent(json)));
    } catch (_) {
      els.saveText.value = json;
    }
    els.saveText.focus();
    els.saveText.select();
    if (navigator.clipboard && window.isSecureContext) {
      navigator.clipboard.writeText(els.saveText.value).then(function () {
        toast("Save exported", "The backup was copied to your clipboard.");
      }).catch(function () {
        toast("Save exported", "Copy the highlighted backup text somewhere safe.");
      });
    } else {
      toast("Save exported", "Copy the highlighted backup text somewhere safe.");
    }
  }

  function importSave() {
    var text = els.saveText.value.trim();
    if (!text) return toast("Nothing to import", "Paste an exported save into the box first.");
    var json = text;
    try {
      if (text.indexOf("JB1:") === 0) json = decodeURIComponent(escape(atob(text.slice(4))));
    } catch (_) {
      return toast("Invalid backup", "That encoded save could not be read.");
    }
    var imported = Core.parseSave(json, Date.now());
    if (!imported) return toast("Invalid backup", "The pasted text is not a valid Jackpot Bakery save.");
    askConfirmation(
      "Import Save",
      "Replace the current bakery with the pasted backup? Export the current save first if you may want it later.",
      function () {
        state = imported;
        Core.offlineProgress(state, Date.now());
        saveGame();
        renderAll();
        toast("Save imported", "Your bakery backup loaded successfully.");
      },
      true
    );
  }

  function resetGame() {
    askConfirmation(
      "Reset Everything",
      "Permanently erase crumbs, ovens, prestige, perks, statistics, and achievements on this PC? This cannot be undone unless you exported a backup.",
      function () {
        state = Core.createState(Date.now());
        saveGame();
        renderAll();
        toast("Fresh bakery", "All local progress has been reset.");
      },
      true
    );
  }

  function bindEvents() {
    els.spinButton.addEventListener("click", function () { spin(false); });
    els.levelUpgradeButton.addEventListener("click", purchaseLevel);
    els.autoUpgradeButton.addEventListener("click", purchaseAuto);
    els.autoToggle.addEventListener("change", function () {
      state.machines[state.selectedMachine].autoEnabled = els.autoToggle.checked;
      playSfx("select");
      afterChange();
    });
    els.prestigeButton.addEventListener("click", doPrestige);
    els.achievementsButton.addEventListener("click", function () {
      unlockAudio();
      renderAchievements();
      openDialog(els.achievementsDialog);
    });
    els.settingsButton.addEventListener("click", function () {
      unlockAudio();
      renderSettings();
      openDialog(els.settingsDialog);
    });
    els.fullscreenButton.addEventListener("click", toggleFullscreen);
    els.dialogFullscreenButton.addEventListener("click", toggleFullscreen);

    els.musicVolume.addEventListener("input", function () {
      state.settings.musicVolume = Number(els.musicVolume.value) / 100;
      els.musicVolumeOutput.value = els.musicVolume.value + "%";
      els.musicVolumeOutput.textContent = els.musicVolume.value + "%";
      unlockAudio();
      applyAudioSettings();
      saveGame(false);
    });
    els.sfxVolume.addEventListener("input", function () {
      state.settings.sfxVolume = Number(els.sfxVolume.value) / 100;
      els.sfxVolumeOutput.value = els.sfxVolume.value + "%";
      els.sfxVolumeOutput.textContent = els.sfxVolume.value + "%";
      saveGame(false);
    });
    els.muteToggle.addEventListener("change", function () {
      state.settings.muted = els.muteToggle.checked;
      applyAudioSettings();
      saveGame(false);
    });
    els.compactToggle.addEventListener("change", function () {
      state.settings.compactNumbers = els.compactToggle.checked;
      renderAll();
      saveGame(false);
    });
    els.exportButton.addEventListener("click", exportSave);
    els.importButton.addEventListener("click", importSave);
    els.resetButton.addEventListener("click", resetGame);

    els.confirmDialog.addEventListener("close", function () {
      var action = confirmAction;
      confirmAction = null;
      if (els.confirmDialog.returnValue === "confirm" && action) action();
    });

    document.addEventListener("pointerdown", unlockAudio, { once: true });
    document.addEventListener("keydown", function (event) {
      unlockAudio();
      var activeTag = document.activeElement ? document.activeElement.tagName : "";
      var typing = activeTag === "INPUT" || activeTag === "TEXTAREA";
      if (event.key === "F11") {
        event.preventDefault();
        toggleFullscreen();
      } else if (!typing && event.code === "Space" && !anyDialogOpen()) {
        event.preventDefault();
        spin(false);
      } else if (!typing && event.key === "ArrowLeft" && !anyDialogOpen()) {
        selectAdjacentMachine(-1);
      } else if (!typing && event.key === "ArrowRight" && !anyDialogOpen()) {
        selectAdjacentMachine(1);
      } else if (event.key === "Escape" && document.fullscreenElement) {
        document.exitFullscreen().catch(function () {});
      }
    });

    els.themeMusic.addEventListener("error", function () {
      els.musicStatus.textContent = "♪ MUSIC FILE MISSING";
    });

    window.addEventListener("beforeunload", function () { saveGame(false); });
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) saveGame(false);
    });
  }

  function anyDialogOpen() {
    return els.achievementsDialog.open || els.settingsDialog.open || els.confirmDialog.open;
  }

  function selectAdjacentMachine(direction) {
    var next = state.selectedMachine;
    for (var i = 0; i < Core.MACHINES.length; i += 1) {
      next = (next + direction + Core.MACHINES.length) % Core.MACHINES.length;
      if (state.machines[next].unlocked) {
        state.selectedMachine = next;
        playSfx("select");
        renderAll();
        return;
      }
    }
  }

  function pollGamepads() {
    if (!navigator.getGamepads) return;
    var pads = navigator.getGamepads();
    var pad = null;
    for (var i = 0; i < pads.length; i += 1) {
      if (pads[i]) {
        pad = pads[i];
        break;
      }
    }
    if (!pad) return;
    var current = {
      a: Boolean(pad.buttons[0] && pad.buttons[0].pressed),
      y: Boolean(pad.buttons[3] && pad.buttons[3].pressed),
      left: Boolean(pad.buttons[14] && pad.buttons[14].pressed) || (pad.axes[0] || 0) < -.72,
      right: Boolean(pad.buttons[15] && pad.buttons[15].pressed) || (pad.axes[0] || 0) > .72
    };
    if (current.a && !gamepadPrevious.a && !anyDialogOpen()) spin(false);
    if (current.y && !gamepadPrevious.y && !anyDialogOpen()) {
      renderAchievements();
      openDialog(els.achievementsDialog);
    }
    if (current.left && !gamepadPrevious.left && !anyDialogOpen()) selectAdjacentMachine(-1);
    if (current.right && !gamepadPrevious.right && !anyDialogOpen()) selectAdjacentMachine(1);
    gamepadPrevious = current;
  }

  function frame(now) {
    var delta = Math.min(.25, Math.max(0, (now - lastFrame) / 1000));
    lastFrame = now;
    state.stats.playSeconds += delta;
    processAuto(delta);
    pollGamepads();

    if (now - lastUiRefresh > 160) {
      renderCurrencies();
      renderStage();
      renderStats();
      renderPrestige();
      unlockNewAchievements();
      lastUiRefresh = now;
    }
    if (now - lastAutosave > 15000) {
      saveGame();
      lastAutosave = now;
    }
    requestAnimationFrame(frame);
  }

  loadOfflineProgress();
  bindEvents();
  renderAll();
  unlockNewAchievements();
  requestAnimationFrame(frame);
})();
