# Math Invaders

A Space Invaders-style educational game that helps students practice multiplication facts.

## Gameplay

- Control a cannon that moves between three positions (left, center, right)
- Aliens descend from the top of the screen displaying multiplication problems
- Multiple choice answers appear below each aligned problem
- Use the appropriate controls to shoot the correct answer at the aliens
- Hit aliens with correct answers to score points
- Game ends if any alien reaches the bottom

## Controls & Gameplay Mechanics

### Movement
- Tap/Click left third of screen to move cannon left
- Tap/Click right third of screen to move cannon right
- Center third of screen is for aiming/firing only

### Answer Mechanics
- When cannon aligns under an alien, three answer choices appear directly below that alien's math problem
- The middle answer choice is centered directly beneath the problem
- The other two answers are evenly spaced to either side
- Only one of the three answers is correct
- Answer choices remain visible until:
  - A correct answer is fired (alien destroyed)
  - The cannon moves away from alignment with the alien
  - The alien is destroyed

### Firing System
- Tap/Click any answer choice to fire that number at the alien
- If correct answer hits alien:
  - Alien is destroyed
  - Points are awarded
  - Answer choices disappear
- If wrong answer is fired:
  - Bullet still travels to alien but causes no damage
  - Original choices disappear
  - Three new choices appear immediately with:
    - Different answer options
    - Only one correct answer
    - Previous wrong answer will not appear in new options
  - Process repeats until correct answer is fired or alien moves

## Features

### Adaptive Difficulty 
#### Problems are presented in the following order, with increasing difficulty every 60 seconds where there are no missed answers:
    x1 (identity principle)
    x2 (doubling)
    x0 
    x10
    x5
    The "Square Facts" (3x3, 4x4, 5x5, 6x6, 7x7, 8x8, 9x9)
    x4
    x3
    x9
    x11
    x6
    x7
    x8
    The Demons: 6x7, 7x6, 6x8, 8x6, 8x7, 7x8, 8x4, 4x8, 6x4, 4x6
#### Once "The Demons" are all answered correctly for 60s, then every 60s the speed of the aliens descent increases by 20% every 60s and all the math facts are randomized together.

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
- Multiple choice answers visually connected to math problems
- Clean, arcade-style interface

## Technical Details

- Built using HTML5 Canvas
- Local storage for high scores and missed facts
- Responsive design
- Frame-rate independent movement
- Dynamic answer positioning system

## Educational Benefits

- Reinforces multiplication facts through repetition
- Adaptive learning focuses on problem areas
- Gamification increases engagement
- Real-time feedback helps identify areas for improvement
- Progress tracking through high scores
- Increased challenge as skills improve
- Clear visual connection between problems and answers

## Accessibility

- Clear visual feedback
- Simple, intuitive controls
- High contrast visuals
- Adjustable game speed with down arrow
- Answer choices clearly associated with their problems
