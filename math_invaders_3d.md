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
glass or as a blip on the contact strip, to swing the view straight onto it.

**Tilt to Look** works the way a stargazing app does. The device becomes a window on the
sector: hold it up in front of you and turn on the spot, and the view goes wherever the back
of the device points. Orientation is read absolutely from the sensors rather than as a rate,
so returning the device to where it was returns the view with it — turn right and back again
and you are looking at the same fact. Whichever way the player is facing when a flight begins
counts as straight ahead, which means it works on hardware with no true-north reference.
Up and down are inverted from the usual stargazing convention — tipping the device back looks
down the sector and tipping it forward looks up — because that is the way round it reads in
the hand.

With tilt on, dragging no longer moves the view (the device is doing the aiming) and tapping
a fact locks onto it where it is rather than swinging the view across. The horizon does not
roll when the device is rolled — deliberately, so the problems stay upright and readable.

**The sector.** Never more than three facts at once, spawned at least fifty degrees apart,
plus at most one asteroid — so the sky stays readable.

**Closing in.** A fact takes about eighteen seconds to reach the ship and keeps growing on
screen almost the whole way. As it closes it pulses, the proximity tone repeats faster, a
red wash creeps in from the edge of the glass, and the RANGE readout counts down.

**Clearing a fact.** A solved fact is not blown up — the ship's repulsor throws it back out
of the sector. It is knocked off at an angle rather than straight back, so it visibly sails
away across the sky: tumbling end over end, shrinking, fading, dragging a short motion trail
behind it, with an expanding ring of field left at the point of contact and a kick back
through the hull.

**Clearing an asteroid.** An asteroid is harvested, not destroyed. A salvage claw runs out
from under the canopy on a heavy jointed arm — plated booms with ribbed casing, a hydraulic
ram whose polished rod slides out as it extends, bolted pivots at the shoulder, elbow and
knuckles, and caution banding behind the wrist — opens, closes its fingers around the rock
with a puff of dust, and hauls it back down into the hull. The rock is drawn in at an even pace: the ease is
tuned against the perspective so it glides steadily down toward the hull and dissolves into
it, rather than rushing the camera at the last instant and reading as an impact. The shields
are credited at the moment the rock is stowed — about a second and a half after the answer
lands — so the reward is
something the player watches arrive rather than a number that jumps on impact. While the claw has hold of a rock the sector is
held: nothing new arrives and nothing closes on the ship, so bringing salvage aboard is a
moment the player watches rather than a moment they get hit in. Aiming and firing still work
throughout, and shots already away still land. Everything resumes exactly where it left off
once the rock is stowed. The earlier safeguard remains as a backstop — if a fact somehow
reaches the ship with a rock still in the claw, the salvage is banked first.

**Sound.** A click on target lock, a diving energy-bolt "pew" with a slap-back echo on
launch, a four-flavour repulsor shove when a fact is cleared — a sub-bass push, a rising
charge, then a bright field falling in pitch as the fact recedes — and, for asteroids, the
whirr of the salvage arm running out, a clank as the fingers bite, and a heavy thunk with a
rising two-note chime as the rock comes aboard. Everything happens in a vacuum: shots and clears are
fed into a long, dark reverb. A limiter on the output keeps overlapping sounds from
distorting. These are synthesised in the browser rather than played from files.

**Ships.** Three hulls, traced directly from the squadron concept sheet rather than drawn
by hand: the Vanguard battlecruiser, the Aethelgard dreadnought and the Nomad fleet carrier.
Each is stored as a stack of seven nested tone bands — the darkest band is the full
silhouette and each lighter one sits inside the last — so a single set of shapes repaints in
any squadron's colour by swapping the seven-step ramp built from that squadron's
`dark`/`mid`/`light`. Class 2 flies the same three hulls in an up-armoured mark, wearing a
brighter finish and a rim light, unlocked by clearing 30 facts in a single flight. Exhaust
is drawn procedurally from nozzle anchors measured off the concept art, and is cyan-white on
every squadron. Ship choice remains purely cosmetic.

The battlecruiser and the dreadnought are painted lit from one side, with the shadowed half
too dark to separate from the nebula behind it; both are symmetric ships, so each is rebuilt
by mirroring its well-lit half. The carrier is a three-quarter view and is traced whole.

**The bridge.** A broad rounded-rectangle window set into the forward bulkhead: plated
hull with bevelled seams, structural stanchions up the side pillars, a bracing beam across
the top, hatched corner gussets and a ribbed collar following the window's own shape.
Cyan status blocks sit in the lower corners of the glass, a segmented shield column runs
up the right-hand side, and faint navigation arcs are etched across it.

**The control console** occupies the deck below the window and is instrumentation rather
than decoration: a lit switch bank whose first lamp shows target lock, two dials reading
shield strength and progress toward the next rung, a scope plotting every contact in the
sector by bearing and range, throttle levers and an auxiliary rocker bank. On a shallow
deck — a phone held sideways — the same stations lay out wide instead of tall.

**The starfield** follows the same reference — stars in white, blue, gold and amber, the
brighter ones carrying a soft halo and the brightest a cross flare, with a scatter of
distant galaxies. It is deliberately thinner than the reference photograph, which is a
dense sky; here it is roughly a tenth as crowded so the maths stays the thing you look at.

The bridge frame never changes between frames, so it is rendered once and reused, and star
halos are pre-rendered per colour. Without that the phone loses about a quarter of its
frame rate to redrawing furniture.

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
