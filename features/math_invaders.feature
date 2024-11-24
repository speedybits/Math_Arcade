@math-invaders
Feature: Math Invaders Game
  As a player
  I want to play Math Invaders
  So that I can practice multiplication facts while having fun

@basic
# Basic Movement and Controls
Scenario: Cannon movement with three positions
  When I click the left third of the screen
  Then the cannon should move to the left position
  When I click the middle third of the screen
  Then the cannon should move to the middle position
  When I click the right third of the screen
  Then the cannon should move to the right position

@basic
# Alien Mechanics
Scenario: Aliens fall in three positions
  When an alien appears
  Then it appears in either the left, center or right position
  And it descends toward the bottom of the screen

@basic
Scenario: Multiple aliens descend simultaneously
  When the game starts
  Then I should see multiple math problems descending
  And they should maintain proper spacing between each other
  And I should be able to solve any problem that aligns with my cannon

@basic
Scenario: Maximum number of simultaneous aliens
  When the game starts
  Then I should never see more than 4 aliens at once
  And new aliens should only spawn when space is available

# Answer Mechanics
@basic
Scenario: Answer circles appear when aligned
  And there is an alien with the problem "3 × 4" above the cannon
  Then I should see 3 answer circles below the alien 
  And one of them should contain "12"
  When I click any answer circle
  Then that answer should be fired at the alien

@basic
Scenario: Multiple choice answers positioning
  And there is an alien with the problem "3 × 4" above the cannon
  Then I should see 3 answer circles centered below the math problem
  And the middle answer should be directly beneath the problem
  And the other answers should be evenly spaced to either side
  And the circles should move down the screen as the alien does

@basic
Scenario: No circles without alien alignment
  And there are no aliens above the cannon
  Then there should be no answer circles visible

Scenario: Wrong answer mechanics
  And there is an alien with the problem "3 × 4" above the cannon
  When I click an answer circle with the wrong answer
  Then that answer should be fired but not destroy the alien
  And new answer circles should appear
  And the previous wrong answer should not be among the new options

Scenario: Correct answer mechanics
  And there is an alien with the problem "3 × 4" above the cannon
  When I click the answer circle containing "12"
  Then that answer should be fired and destroy the alien
  And the answer circles should disappear
  And I should receive points

# Scoring System
Scenario: Basic score calculation
  And I solve a math problem correctly
  And I have not previously missed this problem
  When the problem was "4 × 5"
  Then my score should increase by exactly 20 points

Scenario: Double points for previously missed problems
  And I have previously missed the problem "6 × 7"
  When this problem appears again as an orange alien
  And I solve it correctly
  Then I should receive double points

# Learning Optimization
Scenario: Tracking missed problems
  When I incorrectly answer a problem
  Then that problem should be added to my missed problems list
  And it should appear 3 times more frequently than other problems

Scenario: Visual indication of missed problems
  And I have previously missed the problem "6 × 7"
  When this problem appears again
  Then it should be displayed as an orange alien

# Difficulty Progression
Scenario: Initial difficulty level
  When I start a new game
  Then I should only see multiplication problems with "× 1"
  And the aliens should descend at the base speed

Scenario: Difficulty progression timing
  Given I am solving problems correctly
  When I maintain perfect accuracy for 60 seconds
  Then the difficulty level should increase
  And I should see problems from the next level

Scenario: Level progression order
  When I progress through levels
  Then I should see problems in this order:
    | Level | Problems                                    |
    | 0     | × 1 (identity principle)                   |
    | 1     | × 2 (doubling)                             |
    | 2     | × 0                                        |
    | 3     | × 10                                       |
    | 4     | × 5                                        |
    | 5     | Square Facts (3×3 through 9×9)             |
    | 6     | × 4                                        |
    | 7     | × 3                                        |
    | 8     | × 9                                        |
    | 9     | × 11                                       |
    | 10    | × 6                                        |
    | 11    | × 7                                        |
    | 12    | × 8                                        |
    | 13    | The Demons (6×7, 7×8, etc)                |

Scenario: Final level mechanics
  And I am at Level 13
  When I solve all demon problems correctly for 60 seconds
  Then all multiplication facts should appear randomly
  And the alien descent speed should increase by 20% every 60 seconds

# Visual Features
Scenario: Bullet animation
  When I fire an answer at an alien
  Then I should see an animated bullet with the answer
  And it should travel from the cannon to the alien

Scenario: Visual feedback elements
  Then I should see a futuristic cannon with glowing core
  And the current level should be displayed in the upper right corner
  And the interface should have a clean arcade-style appearance

# Game State
Scenario: Game over conditions
  When an alien reaches the bottom of the screen
  Then the game should end
  And I should see a "Game Over" message
  And I should be prompted to enter my initials for the high score

Scenario: High score system
  When the game ends
  And my score is in the top 10
  Then I should be able to enter my initials
  And my score should be saved locally
  And I should see the updated high score list

# Accessibility Features
Scenario: Accessibility controls
  Then the game should have high contrast visuals
  And I should be able to adjust game speed with the down arrow
  And the controls should be simple and intuitive
  And answer choices should be clearly associated with their problems
