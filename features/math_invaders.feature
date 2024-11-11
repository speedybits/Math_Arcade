@math-invaders
Feature: Math Invaders Game
  As a player
  I want to play Math Invaders
  So that I can practice math while having fun

  Scenario: Generate an addition problem in Math Invaders
    Given I am playing Math Invaders
    And the game difficulty is set to 1
    When I generate an addition problem
    Then I should see a problem with two numbers
    And the numbers should be between 1 and 10

  Scenario: Score calculation in Math Invaders
    Given I am playing Math Invaders
    And the game difficulty is set to 1
    And I solved a problem correctly
    When it took me 3 seconds to answer
    Then my score should be positive
    And it should be higher than if I took 6 seconds
