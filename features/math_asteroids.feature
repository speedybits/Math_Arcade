@math-asteroids
Feature: Math Asteroids Game
  As a player
  I want to play Math Asteroids
  So that I can practice math in space

  Scenario: Generate a multiplication problem in Math Asteroids
    Given I am playing Math Asteroids
    And the game difficulty is set to 1
    When I generate a multiplication problem
    Then I should see a problem with two numbers
    And the numbers should be between 1 and 5

  Scenario: Score calculation in Math Asteroids
    Given I am playing Math Asteroids
    And the game difficulty is set to 1
    And I destroyed an asteroid correctly
    When it took me 4 seconds to answer
    Then my score should be positive
    And it should be higher than if I took 8 seconds