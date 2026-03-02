const { createApp } = Vue;

const HEX_SIZE = 52;
const BOARD_CENTER_X = 420;
const BOARD_CENTER_Y = 280;

const RESOURCE_TYPES = ["wood", "goat", "molasses", "cutlass", "gold"];
const RESOURCE_SUPPLY_START = 18;
const MARKETPLACE_START = ["wood", "goat", "molasses", "cutlass", "gold"];
const COCO_DECK_TEMPLATE = [
  ...Array(11).fill({ type: "move_ghost" }),
  ...Array(3).fill({ type: "free_build" }),
  ...Array(3).fill({ type: "goat_cutlass" }),
  ...Array(3).fill({ type: "molasses_wood" })
];

function axialToPixel(q, r) {
  const x = HEX_SIZE * Math.sqrt(3) * (q + r / 2) + BOARD_CENTER_X;
  const y = HEX_SIZE * 1.5 * r + BOARD_CENTER_Y;
  return { x, y };
}

function hexCorners(cx, cy) {
  const pts = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i - 30);
    pts.push({ x: cx + HEX_SIZE * Math.cos(angle), y: cy + HEX_SIZE * Math.sin(angle) });
  }
  return pts;
}

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
      viewBox: "80 60 680 450",
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
    lastRollText() {
      if (!this.lastRoll) return "none";
      return `${this.lastRoll.value}`;
    },
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
      if (this.buildMode === "ship") return "Build a ship adjacent to your lair. Builds must alternate.";
      if (this.buildMode === "lair") return "Build a lair adjacent to your ship. Builds must alternate.";
      return "Build, trade, or buy a Coco tile.";
    },
    cocoLeaderId() {
      let best = -1;
      let bestCount = 0;
      this.players.forEach((p) => {
        if (p.cocoTiles > bestCount) {
          best = p.id;
          bestCount = p.cocoTiles;
        } else if (p.cocoTiles === bestCount) {
          best = -1;
        }
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
      const coords = [];
      for (let q = -2; q <= 2; q++) {
        for (let r = -2; r <= 2; r++) {
          const s = -q - r;
          if (Math.max(Math.abs(q), Math.abs(r), Math.abs(s)) <= 2) coords.push({ q, r });
        }
      }
      coords.sort((a, b) => (a.q === b.q ? a.r - b.r : a.q - b.q));

      const fixedTiles = [
        { resource: "wood", pip: 4 }, { resource: "goat", pip: 2 }, { resource: "molasses", pip: 5 },
        { resource: "cutlass", pip: 3 }, { resource: "gold", pip: 1 }, { resource: "wood", pip: 5 },
        { resource: "goat", pip: 4 }, { resource: "molasses", pip: 2 }, { resource: "cutlass", pip: 1 },
        { resource: "spooky", pip: null },
        { resource: "gold", pip: 4 }, { resource: "wood", pip: 3 }, { resource: "goat", pip: 1 },
        { resource: "molasses", pip: 5 }, { resource: "cutlass", pip: 2 }, { resource: "gold", pip: 3 },
        { resource: "wood", pip: 1 }, { resource: "goat", pip: 5 }, { resource: "molasses", pip: 4 }
      ];

      const nodeMap = new Map();
      const edgeMap = new Map();
      const nodes = [];
      const edges = [];
      const tiles = [];

      coords.forEach((c, idx) => {
        const center = axialToPixel(c.q, c.r);
        const corners = hexCorners(center.x, center.y);
        const tileNodeIds = [];

        for (let i = 0; i < 6; i++) {
          const key = `${Math.round(corners[i].x)}:${Math.round(corners[i].y)}`;
          if (!nodeMap.has(key)) {
            const id = nodes.length;
            nodeMap.set(key, id);
            nodes.push({ id, x: corners[i].x, y: corners[i].y, owner: -1, adjacentNodes: new Set(), adjacentTiles: [] });
          }
          tileNodeIds.push(nodeMap.get(key));
        }

        for (let i = 0; i < 6; i++) {
          const a = tileNodeIds[i];
          const b = tileNodeIds[(i + 1) % 6];
          const ek = a < b ? `${a}-${b}` : `${b}-${a}`;
          if (!edgeMap.has(ek)) {
            const id = edges.length;
            edgeMap.set(ek, id);
            edges.push({ id, a: Math.min(a, b), b: Math.max(a, b), owner: -1 });
          }
          nodes[a].adjacentNodes.add(b);
          nodes[b].adjacentNodes.add(a);
        }

        const tileData = fixedTiles[idx];
        tiles.push({
          id: idx,
          q: c.q,
          r: c.r,
          cx: center.x,
          cy: center.y,
          points: corners.map((p) => `${p.x},${p.y}`).join(" "),
          resource: tileData.resource,
          pip: tileData.pip,
          nodeIds: tileNodeIds,
          hasGhost: tileData.resource === "spooky",
        });
      });

      nodes.forEach((n) => { n.adjacentNodes = Array.from(n.adjacentNodes); });
      tiles.forEach((tile) => tile.nodeIds.forEach((nid) => nodes[nid].adjacentTiles.push(tile.id)));

      this.nodes = nodes;
      this.edges = edges;
      this.tiles = tiles;
      this.viewBox = this.calculateViewBox(nodes);
    },

    placeStartingPieces() {
      const ordered = [...this.nodes].sort((a, b) => Math.atan2(a.y - BOARD_CENTER_Y, a.x - BOARD_CENTER_X) - Math.atan2(b.y - BOARD_CENTER_Y, b.x - BOARD_CENTER_X));
      const step = Math.floor(ordered.length / (this.players.length * 2));
      const startNodes = [];
      for (let p = 0; p < this.players.length; p++) {
        startNodes.push(ordered[(p * step * 2) % ordered.length]);
        startNodes.push(ordered[(p * step * 2 + step) % ordered.length]);
      }

      this.players.forEach((player, pIdx) => {
        const pair = [startNodes[pIdx * 2], startNodes[pIdx * 2 + 1]];
        pair.forEach((nodeCandidate) => {
          let node = nodeCandidate;
          if (node.owner >= 0 || node.adjacentNodes.some((nid) => this.nodes[nid].owner >= 0)) {
            node = this.nodes.find((n) => n.owner < 0 && !n.adjacentNodes.some((nid) => this.nodes[nid].owner >= 0));
          }
          node.owner = player.id;
          player.lairs += 1;
          const startEdge = this.edges.find((e) => e.owner < 0 && (e.a === node.id || e.b === node.id));
          if (startEdge) {
            startEdge.owner = player.id;
            player.ships += 1;
          }
        });
      });
    },

    calculateViewBox(nodes) {
      if (!nodes.length) return "0 0 100 100";
      let minX = Infinity; let minY = Infinity; let maxX = -Infinity; let maxY = -Infinity;
      nodes.forEach((n) => {
        if (n.x < minX) minX = n.x;
        if (n.y < minY) minY = n.y;
        if (n.x > maxX) maxX = n.x;
        if (n.y > maxY) maxY = n.y;
      });
      const padding = HEX_SIZE * 0.9;
      const x = Math.floor(minX - padding);
      const y = Math.floor(minY - padding);
      const width = Math.ceil(maxX - minX + padding * 2);
      const height = Math.ceil(maxY - minY + padding * 2);
      return `${x} ${y} ${width} ${height}`;
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
        if (tile.pip !== value || tile.hasGhost || tile.resource === "spooky") return;
        tile.nodeIds.forEach((nodeId) => {
          const owner = this.nodes[nodeId].owner;
          if (owner >= 0) this.giveResource(owner, tile.resource, 1);
        });
      });
    },

    giveResource(playerId, resource, count) {
      const take = Math.min(count, this.supply[resource]);
      if (take <= 0) return;
      this.players[playerId].resources[resource] += take;
      this.supply[resource] -= take;
    },

    setBuildMode(mode) {
      if (!this.canTakeActions) return;
      this.buildMode = this.buildMode === mode ? null : mode;
    },

    handleTileClick(tile) {
      if (!this.mustMoveGhost || this.winnerId !== null) return;
      this.tiles.forEach((t) => { t.hasGhost = false; });
      tile.hasGhost = true;
      this.mustMoveGhost = false;
      if (this.pendingGhostLoot && tile.resource !== "spooky") {
        this.giveResource(this.currentPlayer.id, tile.resource, 2);
      }
      this.pendingGhostLoot = false;
      this.buildMode = null;
    },

    canBuildShipOn(edge) {
      if (edge.owner >= 0) return false;
      const p = this.currentPlayer.id;
      const current = this.currentPlayer;
      if (current.nextBuildType !== "ship" && this.freeBuildRemaining <= 0) return false;
      return this.nodes[edge.a].owner === p || this.nodes[edge.b].owner === p;
    },

    canBuildLairOn(node) {
      if (node.owner >= 0) return false;
      const p = this.currentPlayer.id;
      const current = this.currentPlayer;
      if (current.nextBuildType !== "lair" && this.freeBuildRemaining <= 0) return false;
      return this.edges.some((e) => e.owner === p && (e.a === node.id || e.b === node.id));
    },

    handleEdgeClick(edge) {
      if (this.buildMode !== "ship" || !this.canTakeActions || !this.canBuildShipOn(edge)) return;
      const player = this.currentPlayer;
      const cost = { goat: 1, wood: 1 };
      if (this.freeBuildRemaining <= 0 && !this.canPayCost(cost, player)) return;
      if (this.freeBuildRemaining > 0) {
        this.freeBuildRemaining -= 1;
      } else {
        this.payCost(cost, player);
      }
      edge.owner = player.id;
      player.ships += 1;
      player.nextBuildType = "lair";
      this.buildMode = null;
    },

    handleNodeClick(node) {
      if (this.buildMode !== "lair" || !this.canTakeActions || !this.canBuildLairOn(node)) return;
      const player = this.currentPlayer;
      const cost = { cutlass: 1, goat: 1, molasses: 1, wood: 1 };
      if (this.freeBuildRemaining <= 0 && !this.canPayCost(cost, player)) return;
      if (this.freeBuildRemaining > 0) {
        this.freeBuildRemaining -= 1;
      } else {
        this.payCost(cost, player);
      }
      node.owner = player.id;
      player.lairs += 1;
      player.nextBuildType = "ship";
      this.checkWin(player.id);
      this.buildMode = null;
    },

    canPayCost(cost, player) {
      return Object.entries(cost).every(([res, amount]) => (player.resources[res] || 0) >= amount);
    },

    payCost(cost, player) {
      Object.entries(cost).forEach(([res, amount]) => {
        player.resources[res] -= amount;
        this.supply[res] += amount;
      });
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
        const count = this.marketplace.filter((b) => b === res).length;
        if (count >= 5) this.marketplace = [...MARKETPLACE_START];
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
      if (tile.type === "free_build") {
        this.freeBuildRemaining += 1;
      } else if (tile.type === "goat_cutlass") {
        this.giveResource(player.id, "goat", 2);
        this.giveResource(player.id, "cutlass", 2);
      } else if (tile.type === "molasses_wood") {
        this.giveResource(player.id, "molasses", 2);
        this.giveResource(player.id, "wood", 2);
      } else if (tile.type === "move_ghost") {
        this.mustMoveGhost = true;
        this.pendingGhostLoot = true;
      }
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
