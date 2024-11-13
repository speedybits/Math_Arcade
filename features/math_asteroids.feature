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

  @learning_optimization
  Scenario: Learning optimization for missed problems
    Given I am playing Math Asteroids
    And I have previously missed the problem "6 × 7"
    When this problem appears again
    Then it should be displayed as an orange asteroid
    And solving it correctly should give double points

  @basic_score_calculation
  Scenario: Basic score calculation
    Given I am playing Math Asteroids
    And I solved a problem correctly
    When the problem was "4 × 5"
    Then my score should increase by at least 20 points

  @double_points_for_missed_facts
  Scenario: Double points for missed facts
    Given I am playing Math Asteroids
    And I have previously missed the problem "8 × 9"
    When I solve this problem correctly
    Then my score should increase by 144 points

  @ship_movement_physics
  Scenario: Ship movement physics
    Given I am playing Math Asteroids
    When I press the up arrow
    Then the ship should accelerate forward
    And maintain momentum when thrust is released

  @safe_spawn_zones
  Scenario: Safe spawn zones
    Given I am playing Math Asteroids
    When a new asteroid is spawned
    Then it should appear outside the safe zone radius
    And the safe zone radius should be 150 pixels

  @asteroid_splitting
  Scenario: Asteroid splitting
    Given I am playing Math Asteroids
    And I hit a large asteroid correctly
    Then it should split into two smaller asteroids
    And the smaller asteroids should maintain momentum

  @answer_length_validation
  Scenario: Answer length validation
    Given I am playing Math Asteroids
    When I enter a 10-digit number as an answer
    Then the answer input should be limited to 3 digits

  @split_asteroid_problem_inheritance
  Scenario: Split asteroid problem inheritance
    Given I am playing Math Asteroids
    And I hit a large asteroid with problem "6 × 7"
    Then the split asteroids should have related problems
    And their answers should sum to 42

  @high_score_validation
  Scenario: High score validation
    Given I am playing Math Asteroids
    When I try to submit a negative score
    Then the score should be rejected
    And when I try to submit a score above 999999
    Then the score should be rejected

  @screen_boundary_wrapping
  Scenario: Screen boundary wrapping
    Given I am playing Math Asteroids
    When an asteroid moves beyond the right edge
    Then it should appear on the left edge
    And when an asteroid moves beyond the bottom edge
    Then it should appear on the top edge
