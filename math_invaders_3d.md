# Math Invaders 3D — Concept

A first-person reimagining of Math Invaders that borrows the asteroid mechanic from
Math Asteroids. The player sits in the cockpit of a starship, cruising a sector of the
galaxy hunting math facts. Facts drift in from the dark; the player looks around,
picks one, and fires the correct answer at it.

This is a new game built on the bones of the existing two — the missed-fact tracking,
the three-choice answer system, and the level progression all carry over. It is not a
visual reskin of the 2D game.

## Choosing a Ship

Ship selection is how the player picks their operation. There are four squadrons of
six ships each — 24 ships in total.

| Squadron | Colour | Operation |
|----------|--------|-----------|
| Addion   | Green  | Addition |
| Subtrion | Red    | Subtraction |
| Multion  | Blue   | Multiplication |
| Divion   | Yellow | Division |

The six ships within a squadron are **purely cosmetic**. No ship flies faster, shoots
harder, or scores more than any other. This is deliberate: the player gets a real
choice to care about without any risk of accidentally picking a worse game.

## The Cockpit

The player's view is from inside the cockpit, looking out through the canopy.

- **Shield bar** runs across the top of the viewscreen.
- **Instrument panel** across the bottom holds the three answer choices.
- The canopy frame and instrumentation are part of the view, so the playable space is
  the window between them.

### Looking Around

The player does not fly freely through the sector. They **swipe to look around** —
the ship holds position and the view swings to face whatever the player wants to
engage.

This is a deliberate simplification. Free-roam flight in a cockpit is a much larger
build and reads as motion sickness on a phone held close to the face. Swipe-to-look
preserves the feeling of being out in your own sector of space while staying playable
on a touchscreen and cheap to build.

## Answering

Unchanged in spirit from the 2D game:

- Three answer choices appear in the instrument panel. Exactly one is correct.
- The player taps a choice to fire it at the fact.
- A correct answer zaps the fact out of the sector and scores points.
- A wrong answer travels and misses. Three fresh choices appear, minus the wrong one
  already tried, and the player tries again.

## The Sector

Two kinds of object share the same sky, mixed together the way the 2D game mixes
normal and missed-fact aliens:

**Incoming facts** — the threat. They drift toward the ship. Reaching the ship costs
shields.

**Asteroids** — the reward. They carry facts the player has previously missed.
Answering one correctly rebuilds shields.

Because both are in the same sky, they must be **unmistakable at a glance**: different
shape, different colour, and ideally a different approach sound. A player who cannot
instantly tell a threat from a reward will shoot the wrong one and not understand why
their shields moved the wrong way. This is the single most important visual
requirement in the game.

## Shields — the Fail State

When an incoming fact reaches the ship:

- The cockpit **rumbles**.
- **Shields drop by half.**
- The fact is **recorded as missed** and will return later as an asteroid.

Shields start at 100%. Halving alone never reaches zero, so the ship is **destroyed
when shields fall below 10%**. In practice:

```
100  →  50  →  25  →  12  →  6 (destroyed)
```

That gives a young player about four hits before game over, which is forgiving enough
to keep them playing and tight enough to create real pressure.

### Redemption

When the player correctly answers a fact on an asteroid, shields are **restored to
what they were before that fact hit them** — the halving is undone, capped at 100%.
Take a hit on 7×8 and drop from 100 to 50; nail 7×8 on the asteroid and go back to
100. The connection between the mistake and the repair should be obvious to the
player.

**Missing an asteroid costs nothing.** It drifts off and returns later. A player is
already struggling with any fact that reached them; charging them a second time for it
would send shields into a spiral exactly when they most need the practice.

## Level Progression

Multiplication already has a carefully ordered 14-step ladder in the existing game,
running from ×1 through the "Demons" (6×7, 7×8 and their kin), with difficulty
advancing every 60 seconds of clean play.

**Addition, subtraction and division each need their own ladder built from scratch.**
This is curriculum work, independent of anything 3D, and it is the largest piece of
unbuilt design in this concept. Three of the four squadrons cannot ship without it.

## Carried Over From the Existing Games

- Missed-fact tracking with increased exposure for problem facts
- Double points for correctly answering a previously missed fact
- Three-choice multiple choice with wrong answers excluded from the retry
- Difficulty advancing on clean play, speed increasing once the ladder is exhausted
- High scores in local storage
- Touch-first controls and mobile responsiveness

## Open Questions

- **Scoring across operations.** Should an addition fact and a multiplication fact be
  worth the same? High score tables may need to be per-squadron.
- **Session length.** With four survivable hits and no bottom of the screen, what ends
  a run other than destruction? A sector clear? A wave count?
- **Does the 3D actually feel good on a phone?** No document can answer this. A rough
  playable cockpit prototype is the cheapest way to find out, and should come before
  any serious build.

## Fact Ladders

Multiplication uses **the exact ladder the 2D Math Invaders uses** — ×1, ×2, ×0, ×10, ×5,
the square facts, ×4, ×3, ×9, ×11, ×6, ×7, ×8, then the Demons (6×7, 7×8 and their kin).
The other three operations were built to the same teaching order:

| | Addition | Subtraction | Division |
|---|---|---|---|
| Start | + 1 (counting on) | − 1 (counting back) | ÷ 1 |
| | + 2, + 0, + 10, + 5 | − 2, − 0, − 10, − 5 | ÷ 2, ÷ 10, ÷ 5 |
| Middle | doubles 3+3 … 9+9 | halving the doubles 6−3 … 18−9 | square roots 9÷3 … 81÷9 |
| | + 4, + 3, + 9, + 11, + 6, + 7, + 8 | − 4, − 3, − 9, − 11, − 6, − 7, − 8 | ÷ 4, ÷ 3, ÷ 9, ÷ 11, ÷ 6, ÷ 7, ÷ 8 |
| End | Demons (bridging ten) | Demons (crossing ten) | Demons (42÷6, 56÷7 …) |

Division has thirteen rungs rather than fourteen: there is no "divide by zero" fact to
teach. Every other operation matches rung for rung.

As in the 2D game, reaching a new rung does not retire the old ones — facts are drawn from
every rung reached so far, so new material is introduced while old material keeps returning.

**Progression is driven by clearing facts, not by a clock.** Six facts cleared without a
shield breach opens the next rung; a breach resets that count. Once the ladder is exhausted
the sector simply gets faster.

Multiplication misses are shared with the 2D Math Invaders through its own saved data, so a
child's problem facts follow them between the two games.

## Prototype

A playable version lives in `math_invaders_3d.html`, reachable from the arcade menu
alongside the two 2D games.

**Flying.** Drag to look — left and right to turn, up and down to pitch. Tap a fact, on the
glass or as a blip on the contact strip, to swing the view straight onto it. On an iPhone or
iPad, *Tilt to Look* steers by tipping the device: tilting left or right turns the ship (the
further you tilt, the faster it turns, so you can sweep the whole sector), and tipping
forward or back looks up and down.

**The sector.** Never more than three facts at once, spawned at least fifty degrees apart,
plus at most one asteroid — so the sky stays readable.

**Sound.** A click on target lock, a whoosh on launch, six different explosions so the same
fact never dies the same way twice, and a heavy metallic clank when an asteroid is mined for
shields. These are synthesised in the browser rather than played from files.

**Ships.** Six hulls per squadron, drawn from the concept art. Class 1 is the Vanguard
flight — the Vanguard interceptor, the Aethelgard capital ship and the Nomad modular
hauler. Class 2 is the Aurelia-class medium cruisers, AUR-01 through AUR-03, unlocked by
clearing 30 facts in a single flight. Each squadron flies the same six hulls in its own
colour. Ship choice remains purely cosmetic.

**The bridge.** A wide oval window set into a plated steel frame with segment seams,
rivets and corner gussets, following the reference bridge view: cyan status blocks in the
lower corners of the glass, a segmented shield column up the right-hand side, and a
console below the window. The starfield is deliberately sparse — pinpricks plus a scatter
of distant galaxies rather than a snowstorm.

## Still Open

- **Scoring across operations.** An addition fact and a multiplication fact currently score
  the same. High score tables may need to be per-squadron.
- **No high score table yet.**
- **The licensed sound effects were not used.** The four Epidemic Sound tracks are behind a
  subscription and cannot be downloaded here. The game synthesises its own equivalents
  instead. If the real recordings are wanted, they can be dropped into the game's sound
  table and will be used automatically in place of the synthesised versions.
- **Whether the tilt control feels good to a child** is still the open question a document
  cannot answer.
