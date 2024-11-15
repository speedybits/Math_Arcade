# Math Invaders

A Space Invaders-style educational game that helps students practice multiplication facts.

## Gameplay

- Control a cannon that moves between three positions (left, center, right)
- Aliens descend from the top of the screen displaying multiplication problems
- Use the appropriate controls to shoot the correct answer at the aliens
- Hit aliens with correct answers to score points
- Game ends if any alien reaches the bottom

## Controls & Gameplay Mechanics

### Movement
- Tap/Click left third of screen to move cannon left
- Tap/Click right third of screen to move cannon right
- Center third of screen is for aiming/firing only

### Answer Mechanics
- When cannon aligns under an alien, three circular buttons appear near the cannon
- Each circle contains a possible answer to the alien's multiplication problem
- Only one of the three answers is correct
- Circles remain visible until:
  - A correct answer is fired (alien destroyed)
  - No alien is above the cannon
  - The player moves the cannon to a different position

### Firing System
- Tap/Click any answer circle to fire that number at the alien
- If correct answer hits alien:
  - Alien is destroyed
  - Points are awarded
  - Answer circles disappear until next alien alignment
- If wrong answer is fired:
  - Bullet still travels to alien but causes no damage
  - Original circles disappear
  - Three new circles appear immediately with:
    - Different answer options
    - Only one correct answer
    - Previous wrong answer will not appear in new options
  - Process repeats until correct answer is fired or alien moves

## Features

### Adaptive Difficulty
- Level 0 (0-60s): Numbers 0-3
- Level 1 (60-120s): Numbers 0-6
- Level 2 (120s+): Numbers 0-9
- Descent speed increases with difficulty

### Learning Optimization
- Tracks missed multiplication facts
- Orange aliens indicate previously missed problems
- Double points for correctly answering missed problems
- Missed facts appear more frequently (3x exposure)

### Scoring System
- Points based on problem difficulty
- Minimum 1 point per correct answer
- Double points for missed facts
- High score tracking with initials
- Top 10 scores stored locally

### Visual Features
- Futuristic cannon design with glowing core
- Animated bullets with answers
- Color-coded feedback for missed problems
- Clean, arcade-style interface

## Technical Details

- Built using HTML5 Canvas
- Local storage for high scores and missed facts
- Responsive design
- Frame-rate independent movement

## Educational Benefits

- Reinforces multiplication facts through repetition
- Adaptive learning focuses on problem areas
- Gamification increases engagement
- Real-time feedback helps identify areas for improvement
- Progress tracking through high scores
- Increased challenge as skills improve

## Accessibility

- Clear visual feedback
- Simple, intuitive controls
- High contrast visuals
- Adjustable game speed with down arrow
