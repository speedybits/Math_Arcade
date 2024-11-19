@math-invaders
Feature: Math Invaders Game
  As a player
  I want to play Math Invaders
  So that I can practice multiplication facts while having fun

  @basic @score_calculation
  Scenario: Basic score calculation
    Given I am playing Math Invaders
    And I solved a problem correctly
    And I solve a math problem correctly
    And I have not previously missed this problem
    When the problem was "4 × 5"
    Then my score should increase by exactly 20 points

  @basic
  Scenario: Cannon movement with three positions
    Given I am playing Math Invaders
    When I click the left third of the screen
    Then the cannon should move to the left position
    When I click the middle third of the screen
    Then the cannon should stay in its current position
    When I click the right third of the screen
    Then the cannon should move to the right position

  @basic @multiple_choice
  Scenario: Answer circles appear when aligned
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    Then I should see 3 answer circles near the cannon
    And one of them should contain "12"
    When I click any answer circle
    Then that answer should be fired at the alien

  @basic @multiple_choice
  Scenario: No circles without alien alignment
    Given I am playing Math Invaders
    And there are no aliens above the cannon
    Then there should be no answer circles visible

  @basic @facts_appear_quickly
  Scenario: Math facts appear quickly
    Given I am playing Math Invaders
    Then I should see math facts within 5 seconds of starting the game

  @intermediate @multiple_choice
  Scenario: Wrong answer mechanics
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click an answer circle with the wrong answer
    Then that answer should be fired but not destroy the alien
    And new answer circles should appear
    And the previous wrong answer should not be among the new options

  @intermediate @multiple_choice
  Scenario: Correct answer mechanics
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click the answer circle containing "12"
    Then that answer should be fired and destroy the alien
    And the answer circles should disappear
    And I should receive points

  @intermediate @multiple_choice
  Scenario: Circles disappear on movement
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    And I can see the answer circles
    When I move the cannon to a different position
    Then the answer circles should disappear

  @intermediate @score_calculation
  Scenario: Learning optimization for missed problems
    Given I am playing Math Invaders
    And I have previously missed the problem "6 × 7"
    When this problem appears again
    Then it should be displayed as an orange alien
    And solving it correctly should give double points

  @intermediate @score_calculation
  Scenario: Double points for missed facts
    Given I am playing Math Invaders
    And I have previously missed the problem "8 × 9"
    When I solve this problem correctly
    Then my score should increase by 144 points

  @intermediate
  Scenario: Saving high scores
    Given I am playing Math Invaders
    When I complete a game with a score of 100
    And I enter my initials "ABC"
    Then my score should appear in the high scores list
    And the high scores should be sorted highest first
    And only the top 10 scores should be shown

  @intermediate
  Scenario: Bullet animation
    Given I am playing Math Invaders
    When I fire an answer at an alien
    Then I should see an animated bullet with the answer
    And it should travel from the cannon to the alien

  @intermediate
  Scenario: Persisting missed facts
    Given I am playing Math Invaders
    When I miss the problem "5 × 6"
    And I reload the game
    Then the problem "5 × 6" should still be tracked as missed

  @advanced @answers_positioning
  Scenario: Multiple choice answers positioning
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    Then I should see 3 answer circles centered below the math problem
    And the middle answer should be directly beneath the problem
    And the other answers should be evenly spaced to either side

  @advanced @bullet_mechanics
  Scenario: Bullet travel and collision mechanics
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click the answer circle containing "12"
    Then that answer should be fired at the alien
    And the bullet should travel from the cannon to the alien
    And the alien should be destroyed only after the bullet hits it
    And I should receive points after the collision

  @advanced @bullet_mechanics
  Scenario: Multiple bullets in flight
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click the answer circle containing "10"
    And I click the answer circle containing "11"
    Then both bullets should travel independently
    And the alien should remain until hit with the correct answer

  @advanced @adaptive_difficulty
  Scenario: Initial difficulty level starts at Level 0
    Given I am playing Math Invaders
    When I start a new game
    Then I should only see multiplication problems with "× 1"
    And the aliens should descend at the base speed

  @advanced @adaptive_difficulty
  Scenario: Advancing to next difficulty level
    Given I am playing Math Invaders
    And I am at Level 0
    When I correctly solve problems for 60 seconds
    And I don't miss any problems
    Then I should advance to Level 1
    And I should only see multiplication problems with "× 2"

  @advanced @adaptive_difficulty
  Scenario: Difficulty progression through levels
    Given I am playing Math Invaders
    When I complete Level 0 successfully
    Then I should see "× 2" problems in Level 1
    When I complete Level 1 successfully
    Then I should see "× 0" problems in Level 2
    When I complete Level 2 successfully
    Then I should see "× 10" problems in Level 3

  @advanced @adaptive_difficulty
  Scenario: Missing problems prevents level advancement
    Given I am playing Math Invaders
    And I am at Level 0
    When I miss a problem within the 60 second window
    Then I should remain at Level 0
    And the 60 second timer should reset

  @advanced @adaptive_difficulty
  Scenario: Final level with "The Demons"
    Given I am playing Math Invaders
    And I am at Level 13
    Then I should see problems like "6 × 7", "7 × 8", and "8 × 4"
    When I solve all demon problems correctly for 60 seconds
    Then all multiplication facts should appear randomly
    And the alien descent speed should increase by 20%

  @advanced @adaptive_difficulty
  Scenario: Speed increase after mastering all levels
    Given I am playing Math Invaders
    And I have mastered all levels including "The Demons"
    When I play for 60 more seconds without missing
    Then the aliens should descend 20% faster than before
    When I play for another 60 seconds without missing
    Then the aliens should descend another 20% faster

  @advanced @adaptive_difficulty
  Scenario: Problem frequency for missed facts
    Given I am playing Math Invaders
    When I miss the problem "7 × 8"
    Then I should see "7 × 8" appear 3 times more frequently than other problems
    And it should appear as an orange alien

  @intermediate @level_display
  Scenario: Level number display
    Given I am playing Math Invaders
    Then I should see "Level 0" in the upper right corner
    When I complete Level 0 successfully
    Then I should see "Level 1" in the upper right corner
    When I complete Level 1 successfully
    Then I should see "Level 2" in the upper right corner
