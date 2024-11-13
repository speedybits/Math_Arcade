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

  Scenario: Alien descent speed
    Given I am playing Math Invaders
    When I press the down arrow
    Then the aliens should descend 4 times faster

  @input_length_validation
  Scenario: Input length validation
    Given I am playing Math Invaders
    When I enter an answer longer than 5 digits
    Then the input should be truncated to 5 digits
    And I should see a warning message
