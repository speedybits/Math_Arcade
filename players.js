/* Who is playing on this device.
 *
 * Every game in the arcade saves progress to localStorage. Before this, those
 * keys were global, so two children sharing a tablet shared one set of missed
 * facts and one unlock state — each of them quietly overwriting the other.
 *
 * This holds a small list of players, remembers which one is at the controls,
 * and hands out storage keys scoped to them. Games call Players.key('someKey')
 * instead of naming the key directly, and otherwise carry on as before.
 *
 * Shared by all three games on purpose: the key naming has to agree across
 * them, and three copies of that logic is how a child's saved progress gets
 * lost. Loaded with a plain <script> tag; there is no build step here.
 */
(function (global) {
    'use strict';

    var PLAYERS_KEY = 'mathArcade_players';
    var ACTIVE_KEY = 'mathArcade_activePlayer';

    /* Keys written before players existed. When the first player is created
     * they inherit all of it, so nobody loses progress to this change. */
    var LEGACY_KEYS = [
        'mathInvaders3D_missedFacts',
        'mathInvaders3D_bestCleared',
        'mathInvaders_missedFacts',
        'mathInvaders_highScores',
        'mathInvaders_lastInitials',
        'mathAsteroids_missedFacts',
        'highScores'
    ];

    function readRaw(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function writeRaw(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* private mode */ }
    }
    function removeRaw(key) {
        try { localStorage.removeItem(key); } catch (e) { /* private mode */ }
    }

    function list() {
        try {
            var v = JSON.parse(readRaw(PLAYERS_KEY));
            return Array.isArray(v) ? v : [];
        } catch (e) { return []; }
    }

    function saveList(players) {
        writeRaw(PLAYERS_KEY, JSON.stringify(players));
    }

    function newId() {
        return 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
    }

    function activeId() {
        var id = readRaw(ACTIVE_KEY);
        var players = list();
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === id) return id;
        }
        // Stale or missing: fall back to the only sensible answer.
        return players.length ? players[0].id : null;
    }

    function active() {
        var id = activeId();
        var players = list();
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === id) return players[i];
        }
        return null;
    }

    function setActive(id) {
        writeRaw(ACTIVE_KEY, id);
    }

    /* The first player adopts whatever was already saved on this device, so a
     * child who has been playing for weeks keeps their carried facts. Runs once
     * and only once, because after it there are no legacy keys left to move. */
    function adoptLegacy(id) {
        for (var i = 0; i < LEGACY_KEYS.length; i++) {
            var base = LEGACY_KEYS[i];
            var old = readRaw(base);
            if (old === null) continue;
            var scoped = base + '__' + id;
            if (readRaw(scoped) === null) writeRaw(scoped, old);
            removeRaw(base);
        }
    }

    function add(name) {
        var players = list();
        var player = {
            id: newId(),
            name: String(name || '').trim().slice(0, 24) || 'Player',
            created: Date.now()
        };
        var first = players.length === 0;
        players.push(player);
        saveList(players);
        if (first) adoptLegacy(player.id);
        setActive(player.id);
        return player;
    }

    function rename(id, name) {
        var players = list();
        for (var i = 0; i < players.length; i++) {
            if (players[i].id === id) {
                players[i].name = String(name || '').trim().slice(0, 24) || players[i].name;
                saveList(players);
                return players[i];
            }
        }
        return null;
    }

    /* Removing a player takes their saved progress with them. */
    function remove(id) {
        var players = list().filter(function (p) { return p.id !== id; });
        saveList(players);
        for (var i = 0; i < LEGACY_KEYS.length; i++) removeRaw(LEGACY_KEYS[i] + '__' + id);
        if (readRaw(ACTIVE_KEY) === id) {
            if (players.length) setActive(players[0].id);
            else removeRaw(ACTIVE_KEY);
        }
    }

    /* The one function games actually call. With no players yet it returns the
     * bare key, so a game opened before anyone is named still works. */
    function key(base) {
        var id = activeId();
        return id ? base + '__' + id : base;
    }

    global.Players = {
        list: list,
        active: active,
        activeId: activeId,
        setActive: setActive,
        add: add,
        rename: rename,
        remove: remove,
        key: key,
        LEGACY_KEYS: LEGACY_KEYS
    };
})(window);
