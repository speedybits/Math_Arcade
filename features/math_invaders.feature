@math-invaders
Feature: Math Invaders Game
  As a player
  I want to play Math Invaders
  So that I can practice multiplication facts while having fun

# Learning Optimization
@learning
Scenario: Tracking missed problems
  When I incorrectly answer a problem
  Then that problem should be added to my missed problems list
  And it should appear 3 times more frequently than other problems

@learning
Scenario: Visual indication of missed problems
  When in Math Invaders I have previously missed the problem "6 × 7"
  And in Math Invaders this problem appears again
  Then it should be displayed as an orange alien

@learning
Scenario: Initial difficulty level
  When I start a new game
  Then I should only see multiplication problems with "× 1"
  And the aliens should descend at the base speed

@learning
Scenario: Difficulty progression timing
  Given I am solving problems correctly
  When I maintain perfect accuracy for 60 seconds
  Then the difficulty level should increase
  And I should see problems from the next level

@learning
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
