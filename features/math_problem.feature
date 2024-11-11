Feature: Math Problem Generation and Validation
  As a player
  I want to solve math problems
  So that I can improve my math skills

  Scenario: Generate an addition problem
    Given the game difficulty is set to 1
    When I generate an addition problem
    Then I should see a problem with two numbers
    And the numbers should be between 1 and 10

  Scenario: Correct answer validation
    Given the current problem is "5 + 3"
    When I submit the answer "8"
    Then the answer should be marked as correct

  Scenario: Wrong answer validation
    Given the current problem is "5 + 3"
    When I submit the answer "9"
    Then the answer should be marked as incorrect

  Scenario: Score calculation
    Given the game difficulty is set to 1
    And I solved a problem correctly
    When it took me 3 seconds to answer
    Then my score should be positive
    And it should be higher than if I took 6 seconds