const assert = require('assert');
const { Given, When, Then, Before } = require('@cucumber/cucumber');
const { setWorldConstructor } = require('@cucumber/cucumber');

// Define a custom world class to share the page object
class CustomWorld {
    constructor() {
        this.page = null;
    }

    async setup() {
        // Add any necessary page setup code here
        if (this.page) {
            await this.page.evaluate(() => {
                window.MIN_ALIEN_SPACING = 100; // Set minimum spacing constant
                window.INITIAL_DESCENT_SPEED = 30; // Set initial descent speed
            });
        }
    }
}

setWorldConstructor(CustomWorld);

Before(async function() {
    if (this.page) {
        await this.setup();
        
        // Initialize game constants and state
        await this.page.evaluate(() => {
            window.POSITION_COORDS = {
                'left': window.CANVAS_WIDTH / 4,
                'center': window.CANVAS_WIDTH / 2,
                'right': (3 * window.CANVAS_WIDTH) / 4
            };
            window.gameStarted = false;
            window.activeAliens = [];
            window.activeBullets = [];
            window.currentCannonPosition = 'center';
            window.gameTime = 0;
            window.difficultyLevel = 0;
            window.descentSpeed = window.INITIAL_DESCENT_SPEED;
        });
    }
});

When('I click the left third of the screen', async function () {
    await this.page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const event = new MouseEvent('click', {
            clientX: rect.left + (rect.width / 6),
            clientY: rect.top + (rect.height / 2),
            bubbles: true,
            cancelable: true
        });
        canvas.dispatchEvent(event);
    });
    
    // Wait for position update with error handling
    try {
        await this.page.waitForFunction(() => 
            window.currentCannonPosition === 'left'
        , { timeout: 1000 });
    } catch (error) {
        throw new Error('Cannon failed to move to left position');
    }
});

When('I click the middle third of the screen', async function () {
    await this.page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const event = new MouseEvent('click', {
            clientX: rect.left + (rect.width / 2), // Center of middle third
            clientY: rect.top + (rect.height / 2),
            bubbles: true
        });
        canvas.dispatchEvent(event);
    });
    
    await this.page.waitForFunction(() => 
        window.currentCannonPosition === 'center'
    , { timeout: 1000 });
});

When('I click the right third of the screen', async function () {
    await this.page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const rect = canvas.getBoundingClientRect();
        const event = new MouseEvent('click', {
            clientX: rect.left + (rect.width * 5/6), // Center of right third
            clientY: rect.top + (rect.height / 2),
            bubbles: true
        });
        canvas.dispatchEvent(event);
    });
    
    await this.page.waitForFunction(() => 
        window.currentCannonPosition === 'right'
    , { timeout: 1000 });
});

Then('the cannon should move to the left position', async function () {
    const position = await this.page.waitForFunction(() => 
        window.currentCannonPosition === 'left'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in left position');
});

Then('the cannon should stay in its current position', async function () {
    const initialPosition = await this.page.evaluate(() => window.currentCannonPosition);
    await this.page.waitForTimeout(100); // Brief wait to check for unwanted movement
    const finalPosition = await this.page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(initialPosition, finalPosition, 'Cannon should maintain position');
});

Then('the cannon should move to the right position', async function () {
    const position = await this.page.waitForFunction(() => 
        window.currentCannonPosition === 'right'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in right position');
});

When('I start a new game', async function() {
    await this.page.evaluate(() => {
        window.startGame();
    });
    
    try {
        await this.page.waitForFunction(() => 
            window.gameStarted === true
        , { timeout: 5000 });
    } catch (error) {
        throw new Error('Game failed to initialize within 5 seconds');
    }
});

Given('I am at Level {int}', async function(level) {
    await this.page.evaluate((targetLevel) => {
        // Set game time to trigger appropriate level
        if (targetLevel === 1) {
            window.gameTime = 61; // Just over 1 minute
        } else if (targetLevel === 2) {
            window.gameTime = 121; // Just over 2 minutes
        } else {
            window.gameTime = 0; // Level 0
        }
        window.difficultyLevel = targetLevel;
    }, level);
    
    await this.page.waitForFunction(
        (expectedLevel) => window.difficultyLevel === expectedLevel,
        { timeout: 2000 },
        level
    );
});

Then('I should only see multiplication problems with {string}', async function(multiplier) {
    const problemsValid = await this.page.evaluate((expectedMultiplier) => {
        return window.activeAliens.every(alien => {
            // Convert factors to strings for comparison
            const factor1Str = alien.factor1.toString();
            const factor2Str = alien.factor2.toString();
            return factor1Str === expectedMultiplier || factor2Str === expectedMultiplier;
        });
    }, multiplier);
    assert.ok(problemsValid, `All problems should include ${multiplier}`);
});

Then('the aliens should descend at the base speed', async function() {
    const speedCorrect = await this.page.evaluate(() => 
        Math.abs(window.descentSpeed - window.INITIAL_DESCENT_SPEED) < 0.1
    );
    assert.ok(speedCorrect, 'Aliens should move at base speed');
});

When('I correctly solve problems for {int} seconds', async function(seconds) {
    await this.page.evaluate(async (time) => {
        const startTime = Date.now();
        while (Date.now() - startTime < time * 1000) {
            const alien = window.activeAliens[0];
            if (!alien) continue;
            
            // Find the correct answer button
            const correctAnswer = alien.factor1 * alien.factor2;
            const choicesContainer = document.querySelector('.alien-choices');
            if (!choicesContainer) continue;
            
            const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
            const correctButton = buttons.find(btn => parseInt(btn.textContent) === correctAnswer);
            if (correctButton) {
                correctButton.click();
            }
            
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }, seconds);
});

When('I don\'t miss any problems', async function() {
    await this.page.evaluate(() => {
        // Clear the missed facts array and localStorage
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

Then('I should advance to Level {int}', async function(level) {
    await this.page.waitForFunction(
        (expectedLevel) => {
            // Check both gameTime and difficultyLevel
            if (expectedLevel === 1) {
                return window.gameTime >= 60 && window.difficultyLevel === 1;
            } else if (expectedLevel === 2) {
                return window.gameTime >= 120 && window.difficultyLevel === 2;
            }
            return window.difficultyLevel === expectedLevel;
        },
        { timeout: 5000 },
        level
    );
});

When('I press the Start Game button', async function () {
    await this.page.evaluate(() => {
        window.startGame();
    });
    await this.page.waitForFunction(() => 
        window.gameStarted === true
    , { timeout: 5000 });
});

Then('an alien should appear within {int} seconds', async function (seconds) {
    const alienAppeared = await this.page.waitForFunction(() => 
        window.activeAliens && 
        window.activeAliens.length > 0 && 
        document.querySelector('.alien-choices') !== null // Check for answer choices
    , { timeout: seconds * 1000 });
    assert.ok(alienAppeared, 'Alien should appear with answer choices');
});

When('an alien appears', async function () {
    await this.page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 0
    , { timeout: 5000 });
});

Then('it appears in either the left, center or right position', async function () {
    const validPosition = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) return false;
        
        const positions = {
            'left': window.POSITION_COORDS.left,
            'center': window.POSITION_COORDS.center,
            'right': window.POSITION_COORDS.right
        };
        
        // Check if alien x coordinate matches any position coordinate
        return Object.values(positions).some(pos => 
            Math.abs(alien.x - pos) < 20
        );
    });
    assert.ok(validPosition, 'Alien should appear in valid position');
});

Then('it descends toward the bottom of the screen', async function () {
    const descending = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const initialY = alien.y;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(alien.y > initialY);
            }, 500);
        });
    });
    assert.ok(descending, 'Alien should be descending');
});

When('the game starts', async function () {
    await this.page.evaluate(() => {
        window.startGame();
    });
    await this.page.waitForFunction(() => 
        window.gameStarted === true
    , { timeout: 5000 });
});

Then('I should see multiple math problems descending', async function () {
    const multipleAliens = await this.page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 1
    , { timeout: 5000 });
    assert.ok(multipleAliens, 'Multiple aliens should be present');
});

Then('they should maintain proper spacing between each other', async function () {
    const properSpacing = await this.page.evaluate(() => {
        const aliens = window.activeAliens;
        const MIN_SPACING = window.MIN_ALIEN_SPACING || 100; // Use constant or fallback
        
        for (let i = 0; i < aliens.length - 1; i++) {
            for (let j = i + 1; j < aliens.length; j++) {
                const dx = aliens[i].x - aliens[j].x;
                const dy = aliens[i].y - aliens[j].y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                if (distance < MIN_SPACING) return false;
            }
        }
        return true;
    });
    assert.ok(properSpacing, 'Aliens should maintain minimum spacing');
});

Then('I should be able to solve any problem that aligns with my cannon', async function () {
    const canSolve = await this.page.evaluate(() => {
        const alignedAlien = window.activeAliens.find(alien => 
            alien.position === window.currentCannonPosition
        );
        return alignedAlien && alignedAlien.answerChoices && alignedAlien.answerChoices.length > 0;
    });
    assert.ok(canSolve, 'Should be able to solve aligned problems');
});

When('there is an alien with the problem {string} above the cannon', async function (problem) {
    await this.page.evaluate((problemStr) => {
        const [factor1, factor2] = problemStr.split('×').map(n => parseInt(n.trim()));
        // Force spawn above cannon position
        const alien = window.spawnAlien({
            factor1: factor1,
            factor2: factor2
        });
        if (alien) {
            alien.x = window.POSITION_COORDS['center']; // Ensure centered
            alien.y = 0; // Start at top
        }
    }, problem);
});

Then('I should see {int} answer circles below the alien', async function (numCircles) {
    const circlesValid = await this.page.evaluate((expected) => {
        // Check DOM elements
        const choicesContainer = document.querySelector('.alien-choices');
        const buttons = choicesContainer ? choicesContainer.querySelectorAll('.choice-button') : [];
        const domValid = buttons.length === expected;
        
        // Check game state
        const alien = window.activeAliens[0];
        const stateValid = alien && alien.answerChoices && 
                          alien.answerChoices.length === expected;
        
        return domValid && stateValid;
    }, numCircles);
    assert.ok(circlesValid, `Should see ${numCircles} answer circles`);
});

Then('one of them should contain {string}', async function (answer) {
    const hasAnswer = await this.page.evaluate((expectedAnswer) => {
        // Check DOM elements
        const choicesContainer = document.querySelector('.alien-choices');
        const buttons = Array.from(choicesContainer?.querySelectorAll('.choice-button') || []);
        const domHasAnswer = buttons.some(btn => btn.textContent === expectedAnswer);
        
        // Check game state
        const alien = window.activeAliens[0];
        const stateHasAnswer = alien && alien.answerChoices && 
                              alien.answerChoices.includes(parseInt(expectedAnswer));
        
        return domHasAnswer && stateHasAnswer;
    }, answer);
    assert.ok(hasAnswer, `Answer choices should include ${answer}`);
});

When('I click any answer circle', async function () {
    await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return;
        
        const buttons = choicesContainer.querySelectorAll('.choice-button');
        if (buttons.length > 0) {
            buttons[0].click(); // Click first available answer
        }
    });
    
    // Wait briefly to ensure click is processed
    await this.page.waitForTimeout(100);
});

Then('that answer should be fired at the alien', async function () {
    const fired = await this.page.waitForFunction(() => {
        return window.activeBullets && 
               window.activeBullets.length > 0 && 
               window.activeBullets.some(bullet => bullet.answer !== undefined);
    }, { timeout: 1000 });
    assert.ok(fired, 'Answer should be fired as bullet');
});

Then('the cannon should move to the middle position', async function () {
    const position = await this.page.waitForFunction(() => 
        window.currentCannonPosition === 'center'
    , { timeout: 1000 });
    assert.ok(position, 'Cannon should be in middle position');
});

Then('the middle answer should be directly beneath the problem', async function () {
    const aligned = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        if (buttons.length < 3) return false;
        
        const middleButton = buttons[1];
        const alien = window.activeAliens[0];
        
        const buttonRect = middleButton.getBoundingClientRect();
        const buttonCenterX = buttonRect.left + buttonRect.width / 2;
        const alienX = alien.x;
        
        return Math.abs(buttonCenterX - alienX) < 20; // 20px tolerance
    });
    assert.ok(aligned, 'Middle answer should align with problem');
});

Then('the other answers should be evenly spaced to either side', async function () {
    const evenlySpaced = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        if (buttons.length < 3) return false;
        
        const spacing1 = buttons[1].getBoundingClientRect().left - buttons[0].getBoundingClientRect().left;
        const spacing2 = buttons[2].getBoundingClientRect().left - buttons[1].getBoundingClientRect().left;
        
        return Math.abs(spacing1 - spacing2) < 10; // 10px tolerance
    });
    assert.ok(evenlySpaced, 'Answer choices should be evenly spaced');
});

Then('the circles should move down the screen as the alien does', async function () {
    const moving = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        const initialY = choicesContainer.getBoundingClientRect().top;
        return new Promise(resolve => {
            setTimeout(() => {
                const newY = choicesContainer.getBoundingClientRect().top;
                resolve(newY > initialY);
            }, 500);
        });
    });
    assert.ok(moving, 'Answer circles should move with alien');
});

When('there are no aliens above the cannon', async function () {
    await this.page.evaluate(() => {
        window.activeAliens = window.activeAliens || [];
        window.activeAliens.length = 0;
        
        return {
            alienCount: window.activeAliens.length
        };
    });
});

Then('there should be no answer circles visible', async function () {
    const noCircles = await this.page.evaluate(() => {
        const alignedAlien = window.activeAliens.find(alien => 
            alien.position === window.currentCannonPosition
        );
        return !alignedAlien || !alignedAlien.answerChoices || 
               alignedAlien.answerChoices.length === 0;
    });
    assert.ok(noCircles, 'No answer circles should be visible');
});
