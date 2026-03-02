const { createApp } = Vue;

const RESOURCE_TYPES = ["wood", "goat", "molasses", "cutlass", "gold"];
const RESOURCE_SUPPLY_START = 18;
const MARKETPLACE_START = ["wood", "goat", "molasses", "cutlass", "gold"];
const COCO_DECK_TEMPLATE = [
  ...Array(11).fill({ type: "move_ghost" }),
  ...Array(3).fill({ type: "free_build" }),
  ...Array(3).fill({ type: "goat_cutlass" }),
  ...Array(3).fill({ type: "molasses_wood" })
];

const TWO_PLAYER_ISLANDS = [
  { id: 0, x: 610, y: 170, rx: 72, ry: 82, resource: "spooky", pip: null, label: "Spooky" },
  { id: 1, x: 430, y: 205, rx: 84, ry: 76, resource: "molasses", pip: 5, label: "Molasses" },
  { id: 2, x: 295, y: 285, rx: 74, ry: 72, resource: "wood", pip: 4, label: "Wood" },
  { id: 3, x: 585, y: 300, rx: 84, ry: 78, resource: "goat", pip: 2, label: "Goat" },
  { id: 4, x: 450, y: 360, rx: 58, ry: 48, resource: "gold", pip: 1, label: "Gold" },
  { id: 5, x: 610, y: 450, rx: 84, ry: 80, resource: "wood", pip: 3, label: "Wood" },
  { id: 6, x: 430, y: 500, rx: 86, ry: 78, resource: "molasses", pip: 4, label: "Molasses" },
  { id: 7, x: 280, y: 455, rx: 84, ry: 78, resource: "goat", pip: 3, label: "Goat" },
  { id: 8, x: 235, y: 590, rx: 76, ry: 86, resource: "spooky", pip: null, label: "Spooky" }
];

const SEA_NODES = [
  { id: 0, x: 500, y: 170 }, { id: 1, x: 545, y: 230 }, { id: 2, x: 500, y: 285 }, { id: 3, x: 420, y: 285 },
  { id: 4, x: 350, y: 235 }, { id: 5, x: 350, y: 345 }, { id: 6, x: 420, y: 350 }, { id: 7, x: 500, y: 355 },
  { id: 8, x: 560, y: 350 }, { id: 9, x: 545, y: 430 }, { id: 10, x: 500, y: 480 }, { id: 11, x: 420, y: 480 },
  { id: 12, x: 350, y: 440 }, { id: 13, x: 350, y: 520 }, { id: 14, x: 420, y: 560 }, { id: 15, x: 500, y: 560 }
];

const SEA_EDGES = [
  [0, 1], [1, 2], [2, 3], [3, 4], [4, 0],
  [3, 5], [5, 6], [6, 7], [7, 2],
  [7, 8], [8, 9], [9, 10], [10, 11], [11, 6],
  [11, 12], [12, 13], [13, 14], [14, 15], [15, 10],
  [5, 12], [9, 8]
];

const ISLAND_NODE_LINKS = {
  0: [0, 1],
  1: [0, 2, 3, 4],
  2: [3, 4, 5],
  3: [2, 7, 8],
  4: [5, 6, 7, 11],
  5: [8, 9, 10],
  6: [10, 11, 14, 15],
  7: [5, 12, 13],
  8: [13, 14]
};

createApp({
  data() {
    return {
      resources: RESOURCE_TYPES,
      setup: {
        playerCount: 2,
        names: ["Red Pirate", "Blue Pirate", "Green Pirate", "Orange Pirate"],
      },
      gameStarted: false,
      players: [],
      currentPlayerIndex: 0,
      turn: 1,
      rolledThisTurn: false,
      lastRoll: null,
      winnerId: null,
      mustMoveGhost: false,
      pendingGhostLoot: false,
      buildMode: null,
      nodes: [],
      edges: [],
      tiles: [],
      viewBox: "120 20 620 760",
      supply: { wood: 0, goat: 0, molasses: 0, cutlass: 0, gold: 0 },
      marketplace: [],
      usedCocoTiles: [],
      cocoDeck: [],
      marketplaceUsedThisTurn: false,
      freeBuildRemaining: 0,
      tradeGive: "wood",
      tradeTake: "goat",
      stockpileFrom: "wood",
      stockpileTo: "goat",
    };
  },
  computed: {
    currentPlayer() { return this.players[this.currentPlayerIndex] || { name: "-", color: "#000" }; },
    canRoll() { return this.gameStarted && !this.rolledThisTurn && this.winnerId === null; },
    canTakeActions() { return this.gameStarted && this.rolledThisTurn && !this.mustMoveGhost && this.winnerId === null; },
    canEndTurn() { return this.canTakeActions; },
    lastRollText() { return this.lastRoll ? `${this.lastRoll.value}` : "none"; },
    turnPhaseLabel() {
      if (this.winnerId !== null) return "Game over";
      if (!this.rolledThisTurn) return "Roll die";
      if (this.mustMoveGhost) return "Move Ghost Captain";
      if (this.buildMode) return `Build ${this.buildMode}`;
      return "Take actions or end turn";
    },
    hintText() {
      if (this.winnerId !== null) return "Start a new game by refreshing the page.";
      if (!this.rolledThisTurn) return "Roll 1 die (1-5 produce resources, 6 moves Ghost Captain).";
      if (this.mustMoveGhost) return "Click an island to move the Ghost Captain.";
      if (this.buildMode === "ship") return "Build a ship on a sea lane connected to your network.";
      if (this.buildMode === "lair") return "Build a lair on an empty island connected to your ships.";
      return "Build, trade, or buy a Coco tile.";
    },
    cocoLeaderId() {
      let best = -1;
      let bestCount = 0;
      this.players.forEach((p) => {
        if (p.cocoTiles > bestCount) { best = p.id; bestCount = p.cocoTiles; }
        else if (p.cocoTiles === bestCount) best = -1;
      });
      return bestCount > 0 ? best : -1;
    }
  },
  methods: {
    startGame() {
      const colors = ["#e53935", "#1e88e5", "#43a047", "#f4511e"];
      this.players = Array.from({ length: this.setup.playerCount }, (_, id) => ({
        id,
        name: (this.setup.names[id] || `Player ${id + 1}`).trim(),
        color: colors[id],
        lairs: 0,
        ships: 0,
        nextBuildType: "lair",
        cocoTiles: 0,
        resources: { wood: 1, goat: 0, molasses: 1, cutlass: 0, gold: 0 }
      }));
      this.currentPlayerIndex = 0;
      this.turn = 1;
      this.rolledThisTurn = false;
      this.lastRoll = null;
      this.winnerId = null;
      this.mustMoveGhost = false;
      this.pendingGhostLoot = false;
      this.buildMode = null;
      this.marketplaceUsedThisTurn = false;
      this.freeBuildRemaining = 0;
      this.supply = { wood: RESOURCE_SUPPLY_START, goat: RESOURCE_SUPPLY_START, molasses: RESOURCE_SUPPLY_START, cutlass: RESOURCE_SUPPLY_START, gold: RESOURCE_SUPPLY_START };
      this.marketplace = [...MARKETPLACE_START];
      this.cocoDeck = this.shuffle(COCO_DECK_TEMPLATE.map((c) => ({ ...c })));
      this.usedCocoTiles = [];
      this.buildBoard();
      this.placeStartingPieces();
      this.gameStarted = true;
    },

    buildBoard() {
      this.nodes = SEA_NODES.map((n) => ({ ...n, adjacentIslands: [] }));
      this.edges = SEA_EDGES.map(([a, b], id) => ({ id, a, b, owner: -1 }));
      this.tiles = TWO_PLAYER_ISLANDS.map((i) => ({ ...i, owner: -1, hasGhost: i.resource === "spooky" && i.id === 8, nodeIds: ISLAND_NODE_LINKS[i.id] || [] }));
      this.tiles.forEach((tile) => tile.nodeIds.forEach((nodeId) => this.nodes[nodeId].adjacentIslands.push(tile.id)));
    },

    placeStartingPieces() {
      const starts = [[2, 6], [3, 7], [1, 5], [0, 8]];
      this.players.forEach((player) => {
        const [a, b] = starts[player.id];
        [a, b].forEach((tileId) => {
          const tile = this.tiles[tileId];
          if (!tile || tile.owner >= 0 || tile.resource === "spooky") return;
          tile.owner = player.id;
          player.lairs += 1;
          const edge = this.edges.find((e) => e.owner < 0 && this.tiles[tileId].nodeIds.includes(e.a));
          if (edge) {
            edge.owner = player.id;
            player.ships += 1;
          }
        });
      });
    },

    rollDie() {
      if (!this.canRoll) return;
      const value = 1 + Math.floor(Math.random() * 6);
      this.lastRoll = { value };
      this.rolledThisTurn = true;
      this.buildMode = null;
      if (value === 6) {
        this.mustMoveGhost = true;
        this.pendingGhostLoot = true;
        return;
      }
      this.distributeResources(value);
    },

    distributeResources(value) {
      this.tiles.forEach((tile) => {
        if (tile.pip !== value || tile.hasGhost || tile.resource === "spooky" || tile.owner < 0) return;
        this.giveResource(tile.owner, tile.resource, 1);
      });
    },

    giveResource(playerId, resource, count) {
      const take = Math.min(count, this.supply[resource]);
      if (take <= 0) return;
      this.players[playerId].resources[resource] += take;
      this.supply[resource] -= take;
    },

    setBuildMode(mode) { if (this.canTakeActions) this.buildMode = this.buildMode === mode ? null : mode; },

    handleTileClick(tile) {
      if (this.mustMoveGhost && this.winnerId === null) {
        this.tiles.forEach((t) => { t.hasGhost = false; });
        tile.hasGhost = true;
        this.mustMoveGhost = false;
        if (this.pendingGhostLoot && tile.resource !== "spooky") this.giveResource(this.currentPlayer.id, tile.resource, 2);
        this.pendingGhostLoot = false;
        this.buildMode = null;
        return;
      }

      if (this.buildMode !== "lair" || !this.canTakeActions || !this.canBuildLairOn(tile)) return;
      const player = this.currentPlayer;
      const cost = { cutlass: 1, goat: 1, molasses: 1, wood: 1 };
      if (this.freeBuildRemaining <= 0 && !this.canPayCost(cost, player)) return;
      if (this.freeBuildRemaining > 0) this.freeBuildRemaining -= 1;
      else this.payCost(cost, player);

      tile.owner = player.id;
      player.lairs += 1;
      player.nextBuildType = "ship";
      this.checkWin(player.id);
      this.buildMode = null;
    },

    canBuildShipOn(edge) {
      if (edge.owner >= 0) return false;
      const p = this.currentPlayer.id;
      if (this.currentPlayer.nextBuildType !== "ship" && this.freeBuildRemaining <= 0) return false;
      const nodeTouchesOwnedIsland = [edge.a, edge.b].some((nid) => this.nodes[nid].adjacentIslands.some((tileId) => this.tiles[tileId].owner === p));
      const nodeTouchesOwnedShip = this.edges.some((e) => e.owner === p && (e.a === edge.a || e.a === edge.b || e.b === edge.a || e.b === edge.b));
      return nodeTouchesOwnedIsland || nodeTouchesOwnedShip;
    },

    canBuildLairOn(tile) {
      if (tile.owner >= 0 || tile.resource === "spooky") return false;
      const p = this.currentPlayer.id;
      if (this.currentPlayer.nextBuildType !== "lair" && this.freeBuildRemaining <= 0) return false;
      return this.edges.some((e) => e.owner === p && (tile.nodeIds.includes(e.a) || tile.nodeIds.includes(e.b)));
    },

    handleEdgeClick(edge) {
      if (this.buildMode !== "ship" || !this.canTakeActions || !this.canBuildShipOn(edge)) return;
      const player = this.currentPlayer;
      const cost = { goat: 1, wood: 1 };
      if (this.freeBuildRemaining <= 0 && !this.canPayCost(cost, player)) return;
      if (this.freeBuildRemaining > 0) this.freeBuildRemaining -= 1;
      else this.payCost(cost, player);
      edge.owner = player.id;
      player.ships += 1;
      player.nextBuildType = "lair";
      this.buildMode = null;
    },

    canPayCost(cost, player) { return Object.entries(cost).every(([res, amount]) => (player.resources[res] || 0) >= amount); },
    payCost(cost, player) {
      Object.entries(cost).forEach(([res, amount]) => { player.resources[res] -= amount; this.supply[res] += amount; });
    },

    doMarketplaceTrade() {
      if (!this.canTakeActions || this.marketplaceUsedThisTurn) return;
      const player = this.currentPlayer;
      const boothIndex = this.marketplace.findIndex((r) => r === this.tradeTake);
      if (boothIndex < 0 || player.resources[this.tradeGive] <= 0) return;
      player.resources[this.tradeGive] -= 1;
      player.resources[this.tradeTake] += 1;
      this.marketplace[boothIndex] = this.tradeGive;
      this.marketplaceUsedThisTurn = true;
      this.refreshMarketplaceIfFlooded();
    },

    refreshMarketplaceIfFlooded() {
      RESOURCE_TYPES.forEach((res) => {
        if (this.marketplace.filter((b) => b === res).length >= 5) this.marketplace = [...MARKETPLACE_START];
      });
    },

    doStockpileTrade() {
      if (!this.canTakeActions) return;
      const player = this.currentPlayer;
      if (player.resources[this.stockpileFrom] < 2 || this.supply[this.stockpileTo] <= 0) return;
      player.resources[this.stockpileFrom] -= 2;
      this.supply[this.stockpileFrom] += 2;
      player.resources[this.stockpileTo] += 1;
      this.supply[this.stockpileTo] -= 1;
    },

    buyCocoTile() {
      if (!this.canTakeActions || this.cocoDeck.length === 0) return;
      const player = this.currentPlayer;
      const cost = { cutlass: 1, molasses: 1, gold: 1 };
      if (!this.canPayCost(cost, player)) return;
      this.payCost(cost, player);
      const tile = this.cocoDeck.pop();
      player.cocoTiles += 1;
      this.usedCocoTiles.push({ owner: player.id, type: tile.type });
      if (tile.type === "free_build") this.freeBuildRemaining += 1;
      else if (tile.type === "goat_cutlass") { this.giveResource(player.id, "goat", 2); this.giveResource(player.id, "cutlass", 2); }
      else if (tile.type === "molasses_wood") { this.giveResource(player.id, "molasses", 2); this.giveResource(player.id, "wood", 2); }
      else if (tile.type === "move_ghost") { this.mustMoveGhost = true; this.pendingGhostLoot = true; }
      this.checkWin(player.id);
    },

    checkWin(playerId) {
      const player = this.players[playerId];
      const spookyBonus = this.cocoLeaderId === playerId ? 1 : 0;
      if (player.lairs + spookyBonus >= 7) this.winnerId = playerId;
    },

    endTurn() {
      if (!this.canEndTurn) return;
      this.buildMode = null;
      this.rolledThisTurn = false;
      this.lastRoll = null;
      this.marketplaceUsedThisTurn = false;
      this.freeBuildRemaining = 0;
      this.currentPlayerIndex = (this.currentPlayerIndex + 1) % this.players.length;
      if (this.currentPlayerIndex === 0) this.turn += 1;
    },

    shuffle(arr) {
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  }
}).mount("#app");
