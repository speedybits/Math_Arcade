@math-invaders
Feature: Math Invaders Game
  As a player
  I want to play Math Invaders
  So that I can practice multiplication facts while having fun

  Scenario: Generate a multiplication problem at Level 0
    Given I am playing Math Invaders
    And I have played for less than 60 seconds
    When I generate a multiplication problem
    Then I should see a problem with two numbers
    And the numbers should be between 0 and 3

  Scenario: Generate a multiplication problem at Level 1
    Given I am playing Math Invaders
    And I have played between 60 and 120 seconds
    When I generate a multiplication problem
    Then I should see a problem with two numbers
    And the numbers should be between 0 and 6

  Scenario: Generate a multiplication problem at Level 2
    Given I am playing Math Invaders
    And I have played for more than 120 seconds
    When I generate a multiplication problem
    Then I should see a problem with two numbers
    And the numbers should be between 0 and 9

  @learning_optimization
  Scenario: Learning optimization for missed problems
    Given I am playing Math Invaders
    And I have previously missed the problem "6 × 7"
    When this problem appears again
    Then it should be displayed as an orange alien
    And solving it correctly should give double points

  Scenario: Basic score calculation
    Given I am playing Math Invaders
    And I solved a problem correctly
    When the problem was "4 × 5"
    Then my score should increase by at least 20 points

  Scenario: Double points for missed facts
    Given I am playing Math Invaders
    And I have previously missed the problem "8 × 9"
    When I solve this problem correctly
    Then my score should increase by 144 points

  Scenario: Cannon movement with three positions
    Given I am playing Math Invaders
    When I click the left third of the screen
    Then the cannon should move to the left position
    When I click the middle third of the screen
    Then the cannon should stay in its current position
    When I click the right third of the screen
    Then the cannon should move to the right position

  Scenario: Answer circles appear when aligned
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    Then I should see 3 answer circles near the cannon
    And one of them should contain "12"
    When I click any answer circle
    Then that answer should be fired at the alien

  Scenario: Wrong answer mechanics
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click an answer circle with the wrong answer
    Then that answer should be fired but not destroy the alien
    And new answer circles should appear
    And the previous wrong answer should not be among the new options

  Scenario: Correct answer mechanics
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    When I click the answer circle containing "12"
    Then that answer should be fired and destroy the alien
    And the answer circles should disappear
    And I should receive points

  Scenario: No circles without alien alignment
    Given I am playing Math Invaders
    And there are no aliens above the cannon
    Then there should be no answer circles visible

  Scenario: Circles disappear on movement
    Given I am playing Math Invaders
    And there is an alien with the problem "3 × 4" above the cannon
    And I can see the answer circles
    When I move the cannon to a different position
    Then the answer circles should disappear
