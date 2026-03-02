const { createApp } = Vue;

const HEX_SIZE = 52;
const BOARD_CENTER_X = 420;
const BOARD_CENTER_Y = 280;
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
      resources: ["lumber", "goat", "molasses", "sword", "gold"],
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
      buildMode: null,
      mustMoveGhost: false,
      setupPlacement: { active: true, stage: "hideout" },
      nodes: [],
      edges: [],
      tiles: [],
      viewBox: "80 60 680 450",
    };
  },
  computed: {
    currentPlayer() { return this.players[this.currentPlayerIndex] || { name: "-", color: "#000" }; },
    canRoll() { return this.gameStarted && !this.rolledThisTurn && this.winnerId === null && !this.setupPlacement.active; },
    canBuild() { return this.gameStarted && this.rolledThisTurn && !this.mustMoveGhost && this.winnerId === null; },
    canEndTurn() { return this.gameStarted && this.rolledThisTurn && !this.mustMoveGhost && this.winnerId === null && !this.setupPlacement.active; },
    lastRollText() {
      if (!this.lastRoll) return "none";
      return `${this.lastRoll.d1} + ${this.lastRoll.d2} = ${this.lastRoll.total}`;
    },
    turnPhaseLabel() {
      if (this.winnerId !== null) return "Game over";
      if (this.setupPlacement.active) return `Setup: place ${this.setupPlacement.stage}`;
      if (!this.rolledThisTurn) return "Roll dice";
      if (this.mustMoveGhost) return "Move Ghost";
      if (this.buildMode) return `Build ${this.buildMode}`;
      return "Build or End Turn";
    },
    hintText() {
      if (this.winnerId !== null) return "Start a new game by refreshing the page.";
      if (this.setupPlacement.active) {
        return this.setupPlacement.stage === "hideout"
          ? "Click a highlighted node to place your starting hideout."
          : "Click a highlighted edge connected to your new hideout to place your starting ship.";
      }
      if (!this.rolledThisTurn) return "Roll dice to collect resources.";
      if (this.mustMoveGhost) return "You rolled 7: click a tile to move the Ghost there.";
      if (this.buildMode === "ship") return "Click a highlighted edge to build a ship.";
      if (this.buildMode === "hideout") return "Click a highlighted node to build a hideout.";
      return "Build or end your turn.";
    },
  },
  methods: {
    startGame() {
      const colors = ["#e53935", "#1e88e5", "#43a047", "#f4511e"];
      this.players = Array.from({ length: this.setup.playerCount }, (_, id) => ({
        id,
        name: (this.setup.names[id] || `Player ${id + 1}`).trim(),
        color: colors[id],
        hideouts: 0,
        resources: { lumber: 0, goat: 0, molasses: 0, sword: 0, gold: 0 }
      }));
      this.currentPlayerIndex = 0;
      this.turn = 1;
      this.rolledThisTurn = false;
      this.lastRoll = null;
      this.winnerId = null;
      this.mustMoveGhost = false;
      this.buildMode = null;
      this.setupPlacement = { active: true, stage: "hideout", anchorNode: null };
      this.buildBoard();
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
      const resourceBag = [
        "lumber", "lumber", "lumber", "lumber",
        "goat", "goat", "goat", "goat",
        "molasses", "molasses", "molasses", "molasses",
        "sword", "sword", "sword", "sword",
        "gold", "gold", "gold"
      ];
      const numbers = [2, 3, 3, 4, 4, 5, 5, 6, 6, 8, 8, 9, 9, 10, 10, 11, 11, 12, 7];
      this.shuffle(resourceBag);
      this.shuffle(numbers);

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

        const res = resourceBag[idx % resourceBag.length];
        const number = numbers[idx % numbers.length];
        tiles.push({
          id: idx,
          q: c.q,
          r: c.r,
          cx: center.x,
          cy: center.y,
          points: corners.map(p => `${p.x},${p.y}`).join(" "),
          resource: res,
          number,
          nodeIds: tileNodeIds,
          hasGhost: false,
        });
      });

      nodes.forEach(n => { n.adjacentNodes = Array.from(n.adjacentNodes); });
      const startGhostTile = tiles.find(t => t.number === 7) || tiles[0];
      startGhostTile.hasGhost = true;

      tiles.forEach(tile => tile.nodeIds.forEach(nid => nodes[nid].adjacentTiles.push(tile.id)));

      this.nodes = nodes;
      this.edges = edges;
      this.tiles = tiles;
      this.viewBox = this.calculateViewBox(nodes);
    },

    calculateViewBox(nodes) {
      if (!nodes.length) return "0 0 100 100";
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
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

    rollDice() {
      if (!this.canRoll) return;
      const d1 = 1 + Math.floor(Math.random() * 6);
      const d2 = 1 + Math.floor(Math.random() * 6);
      const total = d1 + d2;
      this.lastRoll = { d1, d2, total };
      this.rolledThisTurn = true;
      this.buildMode = null;

      if (total === 7) {
        this.mustMoveGhost = true;
        return;
      }

      this.distributeResources(total);
    },

    distributeResources(total) {
      this.tiles.forEach(tile => {
        if (tile.number !== total || tile.hasGhost) return;
        tile.nodeIds.forEach(nodeId => {
          const owner = this.nodes[nodeId].owner;
          if (owner >= 0) this.players[owner].resources[tile.resource] += 1;
        });
      });
    },

    setBuildMode(mode) {
      if (mode === "ghost") {
        this.buildMode = "ghost";
        return;
      }
      if (!this.canBuild) return;
      this.buildMode = this.buildMode === mode ? null : mode;
    },

    handleTileClick(tile) {
      if (!this.mustMoveGhost || this.winnerId !== null) return;
      this.tiles.forEach(t => (t.hasGhost = false));
      tile.hasGhost = true;
      this.mustMoveGhost = false;
      this.buildMode = null;
    },

    canBuildShipOn(edge) {
      if (edge.owner >= 0) return false;
      const p = this.currentPlayer.id;
      if (this.setupPlacement.active && this.setupPlacement.stage === "ship") {
        return edge.a === this.setupPlacement.anchorNode || edge.b === this.setupPlacement.anchorNode;
      }
      const touchesOwnNetwork = this.nodes[edge.a].owner === p || this.nodes[edge.b].owner === p ||
        this.edgeTouchesPlayer(edge.a, p) || this.edgeTouchesPlayer(edge.b, p);
      return touchesOwnNetwork;
    },

    edgeTouchesPlayer(nodeId, playerId) {
      return this.edges.some(e => e.owner === playerId && (e.a === nodeId || e.b === nodeId));
    },

    handleEdgeClick(edge) {
      if (this.winnerId !== null) return;
      const p = this.currentPlayer;

      if (this.setupPlacement.active && this.setupPlacement.stage === "ship") {
        if (!this.canBuildShipOn(edge)) return;
        edge.owner = p.id;
        this.nextSetupStep();
        return;
      }

      if (this.buildMode !== "ship" || !this.canBuild) return;
      if (!this.canBuildShipOn(edge)) return;
      if (!this.canPayCost({ lumber: 1, molasses: 1 }, p)) return;

      this.payCost({ lumber: 1, molasses: 1 }, p);
      edge.owner = p.id;
    },

    canBuildHideoutOn(node) {
      if (node.owner >= 0) return false;
      if (node.adjacentNodes.some(nid => this.nodes[nid].owner >= 0)) return false;
      const p = this.currentPlayer.id;

      if (this.setupPlacement.active && this.setupPlacement.stage === "hideout") return true;

      const touchingShip = this.edges.some(e => e.owner === p && (e.a === node.id || e.b === node.id));
      return touchingShip;
    },

    handleNodeClick(node) {
      if (this.winnerId !== null) return;
      const p = this.currentPlayer;

      if (this.setupPlacement.active && this.setupPlacement.stage === "hideout") {
        if (!this.canBuildHideoutOn(node)) return;
        node.owner = p.id;
        p.hideouts += 1;
        this.setupPlacement.anchorNode = node.id;
        this.setupPlacement.stage = "ship";
        return;
      }

      if (this.buildMode !== "hideout" || !this.canBuild) return;
      if (!this.canBuildHideoutOn(node)) return;
      const cost = { lumber: 1, goat: 1, molasses: 1, sword: 1 };
      if (!this.canPayCost(cost, p)) return;

      this.payCost(cost, p);
      node.owner = p.id;
      p.hideouts += 1;
      if (p.hideouts >= 7) this.winnerId = p.id;
    },

    nextSetupStep() {
      this.setupPlacement.anchorNode = null;
      this.setupPlacement.stage = "hideout";
      if (this.currentPlayerIndex < this.players.length - 1) {
        this.currentPlayerIndex++;
      } else {
        this.setupPlacement.active = false;
        this.currentPlayerIndex = 0;
      }
    },

    canPayCost(cost, player) {
      let neededGold = 0;
      for (const [res, amount] of Object.entries(cost)) {
        const has = player.resources[res] || 0;
        if (has < amount) neededGold += amount - has;
      }
      return neededGold <= player.resources.gold;
    },

    payCost(cost, player) {
      for (const [res, amount] of Object.entries(cost)) {
        const used = Math.min(player.resources[res], amount);
        player.resources[res] -= used;
        const remaining = amount - used;
        if (remaining > 0) player.resources.gold -= remaining;
      }
    },

    endTurn() {
      if (!this.canEndTurn) return;
      this.buildMode = null;
      this.rolledThisTurn = false;
      this.lastRoll = null;
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
