@math-asteroids
Feature: Math Asteroids Game
  As a player
  I want to play Math Asteroids
  So that I can practice multiplication facts while navigating space

  Scenario: Generate a multiplication problem
    Given I am playing Math Asteroids
    When I generate a multiplication problem
    Then I should see a problem with two numbers
    And the numbers should be between 0 and 9

  Scenario: Learning optimization for missed problems
    Given I am playing Math Asteroids
    And I have previously missed the problem "6 × 7"
    When this problem appears again
    Then it should be displayed as an orange asteroid
    And solving it correctly should give double points

  Scenario: Basic score calculation
    Given I am playing Math Asteroids
    And I solved a problem correctly
    When the problem was "4 × 5"
    Then my score should increase by at least 20 points

  Scenario: Double points for missed facts
    Given I am playing Math Asteroids
    And I have previously missed the problem "8 × 9"
    When I solve this problem correctly
    Then my score should increase by 144 points

  Scenario: Ship movement physics
    Given I am playing Math Asteroids
    When I press the up arrow
    Then the ship should accelerate forward
    And maintain momentum when thrust is released

  Scenario: Safe spawn zones
    Given I am playing Math Asteroids
    When a new asteroid is spawned
    Then it should appear outside the safe zone radius
    And the safe zone radius should be 150 pixels

  Scenario: Asteroid splitting
    Given I am playing Math Asteroids
    And I hit a large asteroid correctly
    Then it should split into two smaller asteroids
    And the smaller asteroids should maintain momentum
