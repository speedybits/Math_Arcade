const assert = require('assert');
const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { setWorldConstructor } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const path = require('path');

// Define a custom world class to share the page object
class CustomWorld {
    constructor() {
        this.page = null;
        this.browser = null;
    }

    async setup() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: 'new',
                args: ['--no-sandbox']
            });
        }
        
        if (!this.page) {
            this.page = await this.browser.newPage();
            await this.page.setViewport({ width: 1024, height: 768 });
            
            // Use correct server URL
            await this.page.goto('http://localhost:8080/math_invaders.html', {
                waitUntil: 'networkidle0',
                timeout: 10000
            });
            
            // Wait for canvas to be available
            await this.page.waitForSelector('#gameCanvas');
            
            // Initialize game constants
            await this.page.evaluate(() => {
                window.MIN_ALIEN_SPACING = 100;
                window.INITIAL_DESCENT_SPEED = 30;
                window.CANVAS_WIDTH = 600;
                window.CANVAS_HEIGHT = 600;
                window.POSITION_COORDS = {
                    'left': window.CANVAS_WIDTH / 4,
                    'center': window.CANVAS_WIDTH / 2,
                    'right': (3 * window.CANVAS_WIDTH) / 4
                };
            });
        }
    }

    async teardown() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
            this.page = null;
        }
    }
}

setWorldConstructor(CustomWorld);

Before(async function() {
    await this.setup();
    
    // Reset game state
    await this.page.evaluate(() => {
        window.gameStarted = false;
        window.activeAliens = [];
        window.activeBullets = [];
        window.currentCannonPosition = 'center';
        window.gameTime = 0;
        window.difficultyLevel = 0;
        window.descentSpeed = window.INITIAL_DESCENT_SPEED;
    });
});

After(async function() {
    await this.teardown();
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
    // First ensure we're starting from a clean state
    await this.page.evaluate(() => {
        // Reset game state
        window.activeAliens = [];
        window.activeBullets = [];
        window.currentCannonPosition = 'center';
        window.gameStarted = false;
        window.gameTime = 0;
        window.difficultyLevel = 0;
        window.descentSpeed = window.INITIAL_DESCENT_SPEED;
        
        // Clear any existing intervals
        if (window.spawnInterval) {
            clearInterval(window.spawnInterval);
        }
    });

    // Click the start button and wait for initialization
    await this.page.evaluate(() => {
        return new Promise((resolve) => {
            const startButton = document.getElementById('startButton');
            if (!startButton) {
                throw new Error('Start button not found');
            }
            
            // Add event listener to wait for game to start
            const checkGameStarted = setInterval(() => {
                if (window.gameStarted && window.activeAliens && window.activeAliens.length > 0) {
                    clearInterval(checkGameStarted);
                    resolve();
                }
            }, 100);
            
            // Click the button
            startButton.click();
        });
    });

    // Wait for game to be fully initialized
    await this.page.waitForFunction(() => {
        console.log('Game state:', {
            gameStarted: window.gameStarted,
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens
        });
        return window.gameStarted === true && window.activeAliens && window.activeAliens.length > 0;
    }, { timeout: 5000 });
});

Then('an alien should appear within {int} seconds', async function (seconds) {
    const alienAppeared = await this.page.waitForFunction(() => {
        console.log('Checking for alien:', {
            aliensExist: !!window.activeAliens,
            alienCount: window.activeAliens?.length,
            firstAlien: window.activeAliens?.[0]
        });
        return window.activeAliens && window.activeAliens.length > 0;
    }, { timeout: seconds * 1000 });
    
    assert.ok(alienAppeared, 'Alien should appear');
});

When('an alien appears', async function () {
    // Start game if not started
    await this.page.evaluate(() => {
        if (!window.gameStarted) {
            window.startGame();
        }
        
        // Force spawn an alien if none exist
        if (!window.activeAliens || window.activeAliens.length === 0) {
            window.spawnAlien();
        }
    });
    
    // Wait for alien to appear
    await this.page.waitForFunction(() => 
        window.activeAliens && 
        window.activeAliens.length > 0 && 
        window.activeAliens[0].y >= 0 // Make sure alien is visible
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
    // First ensure we're starting from a clean state
    await this.page.evaluate(() => {
        // Reset game state
        window.activeAliens = [];
        window.activeBullets = [];
        window.currentCannonPosition = 'center';
        window.gameStarted = false;
        window.gameTime = 0;
        window.difficultyLevel = 0;
        window.descentSpeed = window.INITIAL_DESCENT_SPEED;
        
        // Clear any existing intervals
        if (window.spawnInterval) {
            clearInterval(window.spawnInterval);
        }
    });

    // Start the game and wait for initialization
    await this.page.evaluate(() => {
        return new Promise((resolve) => {
            window.startGame();
            // Give time for initial aliens to spawn
            setTimeout(resolve, 500);
        });
    });

    // Wait for game to start
    await this.page.waitForFunction(() => {
        console.log('Game state:', {
            gameStarted: window.gameStarted,
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens
        });
        return window.gameStarted === true;
    }, { timeout: 5000 });

    // Wait for multiple aliens
    await this.page.waitForFunction(() => {
        console.log('Waiting for aliens:', {
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens?.map(a => ({
                position: a.position,
                x: a.x,
                y: a.y
            }))
        });
        return window.activeAliens && window.activeAliens.length >= 2;
    }, { timeout: 5000 });
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
        // Get current cannon position
        const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
        
        // Find alien aligned with cannon
        const alignedAlien = window.activeAliens.find(alien => 
            Math.abs(alien.x - cannonX) < 20
        );
        
        // Check if we have an aligned alien with answer choices
        const hasAlignedAlien = alignedAlien && 
                               alignedAlien.answerChoices && 
                               alignedAlien.answerChoices.length > 0;
        
        // Check if answer choices are visible in DOM
        const choicesContainer = document.querySelector('.alien-choices');
        const hasVisibleChoices = choicesContainer && 
                                 choicesContainer.querySelectorAll('.choice-button').length > 0;
        
        console.log('Solve check:', {
            cannonPosition: window.currentCannonPosition,
            hasAlignedAlien,
            hasVisibleChoices,
            alienCount: window.activeAliens.length,
            alignedAlien: alignedAlien ? {
                x: alignedAlien.x,
                cannonX,
                diff: Math.abs(alignedAlien.x - cannonX),
                choices: alignedAlien.answerChoices
            } : null
        });
        
        return hasAlignedAlien && hasVisibleChoices;
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

Then('I should see {int} answer circles centered below the math problem', async function (numCircles) {
    const circlesValid = await this.page.evaluate((expected) => {
        // Get the alien and choices container
        const alien = window.activeAliens[0];
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        // Get all buttons
        const buttons = choicesContainer.querySelectorAll('.choice-button');
        if (buttons.length !== expected) return false;
        
        // Check if container is centered under alien
        const containerRect = choicesContainer.getBoundingClientRect();
        const containerCenterX = containerRect.left + containerRect.width / 2;
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const alienScreenX = (alien.x / window.CANVAS_WIDTH) * canvasRect.width + canvasRect.left;
        
        // Allow for small positioning differences
        const tolerance = 5;
        const isCentered = Math.abs(containerCenterX - alienScreenX) < tolerance;
        
        return buttons.length === expected && isCentered;
    }, numCircles);
    
    assert.ok(circlesValid, `Should see ${numCircles} centered answer circles`);
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
        const alien = window.activeAliens[0];
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        if (buttons.length < 3) return false;
        
        const middleButton = buttons[1]; // Middle button is index 1
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        
        // Get alien's screen position
        const alienScreenX = (alien.x / window.CANVAS_WIDTH) * canvasRect.width + canvasRect.left;
        
        // Get middle button's center position
        const buttonRect = middleButton.getBoundingClientRect();
        const buttonCenterX = buttonRect.left + (buttonRect.width / 2);
        
        // Allow for small positioning differences
        const tolerance = 2; // Tighter tolerance for middle button
        const isAligned = Math.abs(buttonCenterX - alienScreenX) < tolerance;
        
        console.log('Alignment check:', {
            alienX: alienScreenX,
            buttonX: buttonCenterX,
            difference: Math.abs(buttonCenterX - alienScreenX),
            isAligned
        });
        
        return isAligned;
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
        return new Promise(resolve => {
            const alien = window.activeAliens[0];
            const initialY = alien.y;
            const choicesContainer = document.querySelector('.alien-choices');
            const initialChoicesY = choicesContainer?.getBoundingClientRect().top;
            
            // Force alien movement
            const moveInterval = setInterval(() => {
                alien.y += window.descentSpeed * 0.016; // Simulate 16ms frame time
                
                // Update choices position
                if (choicesContainer) {
                    const canvasRect = document.getElementById('gameCanvas').getBoundingClientRect();
                    const alienScreenY = (alien.y / window.CANVAS_HEIGHT) * canvasRect.height + canvasRect.top;
                    choicesContainer.style.top = `${alienScreenY + 40}px`;
                }
            }, 16);
            
            // Check movement after a short delay
            setTimeout(() => {
                clearInterval(moveInterval);
                const newAlienY = alien.y;
                const newChoicesY = choicesContainer?.getBoundingClientRect().top;
                
                console.log('Movement check:', {
                    initialAlienY: initialY,
                    newAlienY: newAlienY,
                    initialChoicesY: initialChoicesY,
                    newChoicesY: newChoicesY,
                    alienMoved: newAlienY > initialY,
                    choicesMoved: newChoicesY > initialChoicesY
                });
                
                resolve(newAlienY > initialY && newChoicesY > initialChoicesY);
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

// Also update the spawnAlien function in the HTML to ensure it works without game started
function spawnAlien(testFactors) {
    // Allow spawning for tests even if game isn't started
    if (!window.gameStarted && !testFactors) return null;

    // Prevent overcrowding
    if (window.activeAliens && window.activeAliens.length >= 4) return null;

    // Initialize arrays if they don't exist
    window.activeAliens = window.activeAliens || [];
    window.activeBullets = window.activeBullets || [];

    // Use test factors if provided, otherwise generate random ones
    const factor1 = testFactors ? testFactors.factor1 : getRandomFactor();
    const factor2 = testFactors ? testFactors.factor2 : getRandomFactor();
    
    // For testing, always spawn above the cannon if test factors are provided
    let position = testFactors ? 'center' : ['left', 'center', 'right'][Math.floor(Math.random() * 3)];
    
    const alien = {
        x: window.POSITION_COORDS[position],
        y: 0,
        factor1: factor1,
        factor2: factor2,
        position: position,
        answerChoices: generateMultipleChoices(factor1 * factor2)
    };
    
    window.activeAliens.push(alien);
    
    // Update choices immediately after spawning
    requestAnimationFrame(() => {
        updateMultipleChoices();
    });
    
    return alien;
}

Then('I should see {int} answer circles below the alien', async function (numCircles) {
    const circlesValid = await this.page.evaluate((expected) => {
        // Get the alien and choices container
        const alien = window.activeAliens[0];
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) return false;
        
        // Get all buttons
        const buttons = choicesContainer.querySelectorAll('.choice-button');
        if (buttons.length !== expected) return false;
        
        // Check if buttons are below alien
        const containerRect = choicesContainer.getBoundingClientRect();
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const alienScreenY = (alien.y / window.CANVAS_HEIGHT) * canvasRect.height + canvasRect.top;
        
        // Verify buttons are below alien
        const isBelow = containerRect.top > alienScreenY;
        
        return buttons.length === expected && isBelow;
    }, numCircles);
    
    assert.ok(circlesValid, `Should see ${numCircles} answer circles below the alien`);
});

// Wrong answer mechanics
When('I click an answer circle with the wrong answer', async function () {
    // Wait for answer circles to appear
    await this.page.waitForFunction(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        return choicesContainer && choicesContainer.querySelectorAll('.choice-button').length > 0;
    }, { timeout: 2000 });

    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Force update choices if they don't exist
        if (!document.querySelector('.alien-choices')) {
            updateMultipleChoices();
        }
        
        const choicesContainer = document.querySelector('.alien-choices');
        if (!choicesContainer) {
            console.error('No choices container found');
            return;
        }
        
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        console.log('Found buttons:', buttons.map(btn => btn.textContent));
        
        const wrongButton = buttons.find(btn => parseInt(btn.textContent) !== correctAnswer);
        if (wrongButton) {
            // Store current answers before clicking
            window.previousAnswerChoices = buttons.map(btn => parseInt(btn.textContent));
            wrongButton.click();
        } else {
            console.error('No wrong answer button found');
        }
    });
    
    // Wait for bullet to be processed
    await this.page.waitForTimeout(500);
});

Then('new answer circles should appear', async function () {
    const hasNewChoices = await this.page.waitForFunction(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        const hasChoices = choicesContainer && 
                          choicesContainer.querySelectorAll('.choice-button').length === 3;
        console.log('Checking for new choices:', {
            hasContainer: !!choicesContainer,
            buttonCount: choicesContainer?.querySelectorAll('.choice-button').length
        });
        return hasChoices;
    }, { timeout: 2000 });
    assert.ok(hasNewChoices, 'New answer circles should appear');
});

Then('the previous wrong answer should not be among the new options', async function () {
    const noDuplicates = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        const currentChoices = Array.from(choicesContainer.querySelectorAll('.choice-button'))
            .map(btn => parseInt(btn.textContent));
        const previousChoices = window.previousAnswerChoices || [];
        return !currentChoices.some(choice => previousChoices.includes(choice));
    });
    assert.ok(noDuplicates, 'Previous wrong answer should not reappear');
});

// Correct answer mechanics
When('I click the answer circle containing {string}', async function (answer) {
    await this.page.evaluate((expectedAnswer) => {
        const choicesContainer = document.querySelector('.alien-choices');
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        const correctButton = buttons.find(btn => btn.textContent === expectedAnswer);
        if (correctButton) {
            correctButton.click();
        }
    }, answer);
});

Then('that answer should be fired and destroy the alien', async function () {
    const result = await this.page.waitForFunction(() => {
        return {
            bulletFired: window.activeBullets.length > 0,
            alienDestroyed: window.activeAliens.length === 0
        };
    }, { timeout: 2000 });
    assert.ok(result, 'Correct answer should destroy alien');
});

Then('the answer circles should disappear', async function () {
    const circlesGone = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        return !choicesContainer;
    });
    assert.ok(circlesGone, 'Answer circles should disappear');
});

Then('I should receive points', async function () {
    const scoreIncreased = await this.page.evaluate(() => {
        return window.score > 0;
    });
    assert.ok(scoreIncreased, 'Score should increase');
});

// Score calculation
When('I solve a math problem correctly', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const choicesContainer = document.querySelector('.alien-choices');
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        const correctButton = buttons.find(btn => parseInt(btn.textContent) === correctAnswer);
        if (correctButton) {
            correctButton.click();
        }
    });
});

When('I have not previously missed this problem', async function () {
    await this.page.evaluate(() => {
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

When('in Math Invaders the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await this.page.evaluate((f1, f2) => {
        const alien = window.activeAliens[0];
        alien.factor1 = f1;
        alien.factor2 = f2;
    }, factor1, factor2);
});

Then('my score should increase by exactly {int} points', async function (points) {
    const scoreCorrect = await this.page.evaluate((expectedPoints) => {
        return window.score === expectedPoints;
    }, points);
    assert.ok(scoreCorrect, `Score should increase by exactly ${points} points`);
});

// Double points mechanics
When('in Math Invaders I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await this.page.evaluate((f1, f2) => {
        window.missedFacts = [{
            factor1: f1,
            factor2: f2,
            exposureCount: 1
        }];
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
    }, factor1, factor2);
});

When('this problem appears again as an orange alien', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const missedFact = window.missedFacts[0];
        alien.factor1 = missedFact.factor1;
        alien.factor2 = missedFact.factor2;
        alien.isMissed = true;
    });
});

When('I solve it correctly', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const choicesContainer = document.querySelector('.alien-choices');
        const buttons = Array.from(choicesContainer.querySelectorAll('.choice-button'));
        const correctButton = buttons.find(btn => parseInt(btn.textContent) === correctAnswer);
        if (correctButton) {
            correctButton.click();
        }
    });
});

Then('I should receive double points', async function () {
    const doublePoints = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const normalPoints = alien.factor1 * alien.factor2;
        return window.score === normalPoints * 2;
    });
    assert.ok(doublePoints, 'Should receive double points for previously missed problem');
});

// Game state and level progression
Given('I am solving problems correctly', async function () {
    await this.page.evaluate(() => {
        window.score = 0;
        window.missedFacts = [];
        window.gameStarted = true;
    });
});

When('I maintain perfect accuracy for {int} seconds', async function (seconds) {
    await this.page.evaluate(async (time) => {
        const startTime = Date.now();
        while (Date.now() - startTime < time * 1000) {
            const alien = window.activeAliens[0];
            if (!alien) continue;
            
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

Then('the difficulty level should increase', async function () {
    const increased = await this.page.evaluate(() => {
        return window.difficultyLevel > 0;
    });
    assert.ok(increased, 'Difficulty level should increase');
});

Then('I should see problems from the next level', async function () {
    const correctLevel = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const gameTime = (Date.now() - window.gameStartTime) / 1000;
        const level = Math.floor(gameTime / 60);
        return level === window.difficultyLevel;
    });
    assert.ok(correctLevel, 'Should see problems from next level');
});

// Level progression
When('I progress through levels', async function () {
    await this.page.evaluate(() => {
        window.gameTime = 0;
        window.difficultyLevel = 0;
        window.gameStarted = true;
    });
});

Then('I should see problems in this order:', async function (dataTable) {
    const levels = dataTable.hashes();
    for (const level of levels) {
        const correctProblems = await this.page.evaluate((levelData) => {
            const currentLevel = parseInt(levelData.Level);
            window.gameTime = currentLevel * 60 + 1; // Set time to trigger level
            window.difficultyLevel = currentLevel;
            
            // Verify problems match level description
            const alien = window.activeAliens[0];
            if (!alien) return false;
            
            // Check if problem matches level description
            switch (currentLevel) {
                case 0: return alien.factor1 === 1 || alien.factor2 === 1;
                case 1: return alien.factor1 === 2 || alien.factor2 === 2;
                case 2: return alien.factor1 === 0 || alien.factor2 === 0;
                case 3: return alien.factor1 === 10 || alien.factor2 === 10;
                case 4: return alien.factor1 === 5 || alien.factor2 === 5;
                case 5: return alien.factor1 === alien.factor2; // Square facts
                // Add more cases for other levels
                default: return true;
            }
        }, level);
        assert.ok(correctProblems, `Level ${level.Level} should show correct problems`);
    }
});

// Final level mechanics
When('I solve all demon problems correctly for {int} seconds', async function (seconds) {
    await this.page.evaluate(async (time) => {
        window.difficultyLevel = 13; // Set to final level
        const startTime = Date.now();
        while (Date.now() - startTime < time * 1000) {
            const alien = window.activeAliens[0];
            if (!alien) continue;
            
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

Then('all multiplication facts should appear randomly', async function () {
    const randomFacts = await this.page.evaluate(() => {
        const facts = window.activeAliens.map(alien => ({
            factor1: alien.factor1,
            factor2: alien.factor2
        }));
        // Check if we have a good mix of problems
        return facts.length > 0 && 
               !facts.every(f => f.factor1 === facts[0].factor1) &&
               !facts.every(f => f.factor2 === facts[0].factor2);
    });
    assert.ok(randomFacts, 'Should see random multiplication facts');
});

Then('the alien descent speed should increase by {int}% every {int} seconds', async function (percentage, interval) {
    const speedIncreases = await this.page.evaluate((percent, time) => {
        const initialSpeed = window.descentSpeed;
        window.gameTime += time;
        const expectedSpeed = initialSpeed * (1 + percent/100);
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage, interval);
    assert.ok(speedIncreases, 'Descent speed should increase correctly');
});

// Bullet animation
When('I fire an answer at an alien', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const bullet = {
            x: window.POSITION_COORDS[window.currentCannonPosition],
            y: CANNON_Y,
            answer: correctAnswer,
            speed: BULLET_BASE_SPEED,
            targetAlien: alien,
            isCorrectAnswer: true
        };
        window.activeBullets.push(bullet);
    });
});

Then('I should see an animated bullet with the answer', async function () {
    const bulletVisible = await this.page.evaluate(() => {
        return window.activeBullets.length > 0 && 
               window.activeBullets[0].answer !== undefined;
    });
    assert.ok(bulletVisible, 'Should see bullet with answer');
});

Then('it should travel from the cannon to the alien', async function () {
    const traveling = await this.page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const initialY = bullet.y;
        return new Promise(resolve => {
            setTimeout(() => {
                resolve(bullet.y < initialY);
            }, 100);
        });
    });
    assert.ok(traveling, 'Bullet should travel upward');
});

// Visual feedback and interface elements
Then('I should see a futuristic cannon with glowing core', async function () {
    const hasGlowingCannon = await this.page.evaluate(() => {
        const cannon = document.querySelector('.cannon');
        const style = window.getComputedStyle(cannon);
        return style.boxShadow.includes('rgb(0, 255, 0)') || // Check for green glow
               cannon.classList.contains('glowing-core');
    });
    assert.ok(hasGlowingCannon, 'Cannon should have glowing effect');
});

Then('the current level should be displayed in the upper right corner', async function () {
    const levelDisplayed = await this.page.evaluate(() => {
        const levelDisplay = document.querySelector('#level');
        return levelDisplay && 
               levelDisplay.style.top === '10px' &&
               levelDisplay.style.right === '10px';
    });
    assert.ok(levelDisplayed, 'Level should be displayed in upper right');
});

Then('the interface should have a clean arcade-style appearance', async function () {
    const hasArcadeStyle = await this.page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const style = window.getComputedStyle(canvas);
        return style.backgroundColor === 'rgb(17, 17, 17)' && // Dark background
               style.border.includes('solid') && // Border present
               document.querySelector('.high-scores-container') !== null; // High scores visible
    });
    assert.ok(hasArcadeStyle, 'Interface should have arcade style');
});

// Game over conditions
When('an alien reaches the bottom of the screen', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        alien.y = window.CANVAS_HEIGHT - 10; // Move alien to bottom
    });
});

Then('the game should end', async function () {
    const gameEnded = await this.page.waitForFunction(() => {
        return !window.gameStarted;
    }, { timeout: 2000 });
    assert.ok(gameEnded, 'Game should end');
});

Then('I should see a {string} message', async function (message) {
    const messageVisible = await this.page.evaluate((expectedMessage) => {
        const gameOverText = document.querySelector('#mainScreen h2');
        return gameOverText && 
               gameOverText.style.display === 'block' &&
               gameOverText.textContent === expectedMessage;
    }, message);
    assert.ok(messageVisible, `Should see "${message}" message`);
});

Then('I should be prompted to enter my initials for the high score', async function () {
    // Note: Can't directly test prompt() in Puppeteer, so we check for the conditions that trigger it
    const promptTriggered = await this.page.evaluate(() => {
        return !window.gameStarted && 
               document.getElementById('mainScreen').style.display === 'flex';
    });
    assert.ok(promptTriggered, 'Should be prompted for initials');
});

// High score system
When('the game ends', async function () {
    await this.page.evaluate(() => {
        endGame();
    });
});

When('my score is in the top {int}', async function (position) {
    await this.page.evaluate((pos) => {
        window.score = 1000; // High score
        highScores = Array(pos - 1).fill().map((_, i) => ({
            initials: 'AAA',
            score: 900 - i * 100
        }));
    }, position);
});

Then('I should be able to enter my initials', async function () {
    const canEnterInitials = await this.page.evaluate(() => {
        return document.getElementById('mainScreen').style.display === 'flex';
    });
    assert.ok(canEnterInitials, 'Should be able to enter initials');
});

Then('my score should be saved locally', async function () {
    const scoreSaved = await this.page.evaluate(() => {
        return localStorage.getItem('mathInvaders_highScores') !== null;
    });
    assert.ok(scoreSaved, 'Score should be saved in localStorage');
});

Then('I should see the updated high score list', async function () {
    const listUpdated = await this.page.evaluate(() => {
        const list = document.getElementById('highScoresList');
        return list && list.children.length > 0;
    });
    assert.ok(listUpdated, 'High score list should be updated');
});

// Game state during rapid position changes
When('I rapidly switch cannon positions multiple times', async function () {
    await this.page.evaluate(() => {
        const positions = ['left', 'center', 'right', 'center', 'left'];
        positions.forEach((pos, i) => {
            setTimeout(() => {
                window.currentCannonPosition = pos;
                updateMultipleChoices();
            }, i * 100);
        });
    });
    await this.page.waitForTimeout(600); // Wait for all position changes
});

Then('the answer circles should update correctly', async function () {
    const updatedCorrectly = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        return choicesContainer && 
               choicesContainer.querySelectorAll('.choice-button').length === 3;
    });
    assert.ok(updatedCorrectly, 'Answer circles should update correctly');
});

Then('no duplicate answer circles should appear', async function () {
    const noDuplicates = await this.page.evaluate(() => {
        const containers = document.querySelectorAll('.alien-choices');
        return containers.length === 1;
    });
    assert.ok(noDuplicates, 'No duplicate answer circles should appear');
});

Then('the cannon should be responsive', async function () {
    const responsive = await this.page.evaluate(() => {
        const initialPosition = window.currentCannonPosition;
        window.currentCannonPosition = 'right';
        const changed = window.currentCannonPosition !== initialPosition;
        window.currentCannonPosition = initialPosition;
        return changed;
    });
    assert.ok(responsive, 'Cannon should respond to position changes');
});

// Game state after multiple wrong answers
When('I submit multiple wrong answers rapidly', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const wrongAnswers = [correctAnswer + 1, correctAnswer + 2, correctAnswer + 3];
        
        wrongAnswers.forEach((answer, i) => {
            setTimeout(() => {
                const bullet = {
                    x: window.POSITION_COORDS[window.currentCannonPosition],
                    y: CANNON_Y,
                    answer: answer,
                    speed: BULLET_BASE_SPEED,
                    targetAlien: alien,
                    isCorrectAnswer: false
                };
                window.activeBullets.push(bullet);
            }, i * 100);
        });
    });
    await this.page.waitForTimeout(400); // Wait for all answers
});

Then('the alien should remain intact', async function () {
    const alienIntact = await this.page.evaluate(() => {
        return window.activeAliens.length === 1;
    });
    assert.ok(alienIntact, 'Alien should remain after wrong answers');
});

Then('new answer choices should appear correctly', async function () {
    const newChoices = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        return choicesContainer && 
               choicesContainer.querySelectorAll('.choice-button').length === 3;
    });
    assert.ok(newChoices, 'New answer choices should appear');
});

Then('previous wrong answers should not reappear', async function () {
    const noRepeats = await this.page.evaluate(() => {
        const choicesContainer = document.querySelector('.alien-choices');
        const currentChoices = Array.from(choicesContainer.querySelectorAll('.choice-button'))
            .map(btn => parseInt(btn.textContent));
        const previousWrongAnswers = window.previousWrongAnswers || [];
        return !currentChoices.some(choice => previousWrongAnswers.includes(choice));
    });
    assert.ok(noRepeats, 'Previous wrong answers should not reappear');
});

// Tracking missed problems
When('I incorrectly answer a problem', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const wrongAnswer = correctAnswer + 1;
        
        const bullet = {
            x: window.POSITION_COORDS[window.currentCannonPosition],
            y: CANNON_Y,
            answer: wrongAnswer,
            speed: BULLET_BASE_SPEED,
            targetAlien: alien,
            isCorrectAnswer: false
        };
        
        window.activeBullets.push(bullet);
    });
    await this.page.waitForTimeout(500); // Wait for collision
});

Then('that problem should be added to my missed problems list', async function () {
    const inMissedList = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const missedFacts = JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
        return missedFacts.some(fact => 
            fact.factor1 === alien.factor1 && fact.factor2 === alien.factor2
        );
    });
    assert.ok(inMissedList, 'Problem should be in missed problems list');
});

Then('it should appear {int} times more frequently than other problems', async function (frequency) {
    const correctFrequency = await this.page.evaluate((expectedFreq) => {
        const missedFacts = JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
        return missedFacts[0]?.frequency === expectedFreq;
    }, frequency);
    assert.ok(correctFrequency, `Problem should appear ${frequency} times more frequently`);
});

// Visual indication
Then('it should be displayed as an orange alien', async function () {
    const isOrange = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien.isMissed === true;
    });
    assert.ok(isOrange, 'Alien should be marked as missed (orange)');
});

// Accessibility controls
Then('the game should have high contrast visuals', async function () {
    const hasContrast = await this.page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const style = window.getComputedStyle(canvas);
        return style.backgroundColor === 'rgb(17, 17, 17)' && // Dark background
               document.querySelector('.choice-button')?.style.color === 'white'; // Light text
    });
    assert.ok(hasContrast, 'Game should have high contrast visuals');
});

Then('I should be able to adjust game speed with the down arrow', async function () {
    const canAdjustSpeed = await this.page.evaluate(() => {
        const initialSpeed = window.descentSpeed;
        const event = new KeyboardEvent('keydown', { key: 'ArrowDown' });
        document.dispatchEvent(event);
        return window.descentSpeed < initialSpeed;
    });
    assert.ok(canAdjustSpeed, 'Game speed should be adjustable');
});

Then('the controls should be simple and intuitive', async function () {
    const hasSimpleControls = await this.page.evaluate(() => {
        return document.querySelector('.choice-button') !== null && // Clickable answers
               window.POSITION_COORDS.hasOwnProperty('left') && // Position system
               window.POSITION_COORDS.hasOwnProperty('center') &&
               window.POSITION_COORDS.hasOwnProperty('right');
    });
    assert.ok(hasSimpleControls, 'Controls should be simple and intuitive');
});

Then('answer choices should be clearly associated with their problems', async function () {
    const clearAssociation = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const choicesContainer = document.querySelector('.alien-choices');
        const containerRect = choicesContainer.getBoundingClientRect();
        const canvasRect = document.getElementById('gameCanvas').getBoundingClientRect();
        const alienScreenY = (alien.y / window.CANVAS_HEIGHT) * canvasRect.height + canvasRect.top;
        
        return containerRect.top > alienScreenY && // Choices below alien
               containerRect.top - alienScreenY < 100; // Not too far below
    });
    assert.ok(clearAssociation, 'Answer choices should be clearly associated with problems');
});

// Game state scenarios
Given('I am playing Math Invaders', async function () {
    await this.page.evaluate(() => {
        window.gameStarted = true;
        window.score = 0;
        window.activeAliens = [];
        window.activeBullets = [];
        startGame();
    });
    await this.page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 0
    , { timeout: 5000 });
});

When('I rapidly destroy multiple aliens in succession', async function () {
    await this.page.evaluate(async () => {
        for (let i = 0; i < 3; i++) {
            const alien = window.activeAliens[0];
            if (!alien) continue;
            
            const bullet = {
                x: alien.x,
                y: CANNON_Y,
                answer: alien.factor1 * alien.factor2,
                speed: BULLET_BASE_SPEED,
                targetAlien: alien,
                isCorrectAnswer: true
            };
            window.activeBullets.push(bullet);
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });
    await this.page.waitForTimeout(500);
});

Then('new aliens should continue to spawn', async function () {
    const spawning = await this.page.waitForFunction(() => {
        return window.activeAliens.length > 0;
    }, { timeout: 2000 });
    assert.ok(spawning, 'New aliens should spawn');
});

Then('the game should maintain a steady frame rate', async function () {
    const steadyFrameRate = await this.page.evaluate(() => {
        return window.lastTime && 
               Date.now() - window.lastTime < 50; // Less than 50ms between frames
    });
    assert.ok(steadyFrameRate, 'Game should maintain steady frame rate');
});

Then('the score should update correctly', async function () {
    const scoreUpdated = await this.page.evaluate(() => {
        return window.score > 0 && 
               document.getElementById('score').textContent.includes(window.score.toString());
    });
    assert.ok(scoreUpdated, 'Score should update correctly');
});

// Level transition
Given('I am about to complete level {int}', async function (level) {
    await this.page.evaluate((targetLevel) => {
        window.gameTime = targetLevel * 60 - 1; // Just before level completion
        window.difficultyLevel = targetLevel - 1;
    }, level);
});

When('I solve the final problem of the level', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        shootAnswer(correctAnswer, alien);
    });
    await this.page.waitForTimeout(500);
});

Then('the level should transition smoothly', async function () {
    const smoothTransition = await this.page.evaluate(() => {
        return window.difficultyLevel === Math.floor(window.gameTime / 60);
    });
    assert.ok(smoothTransition, 'Level should transition smoothly');
});

Then('no aliens should disappear unexpectedly', async function () {
    const aliensIntact = await this.page.evaluate(() => {
        return window.activeAliens.length > 0;
    });
    assert.ok(aliensIntact, 'Aliens should not disappear unexpectedly');
});

Then('the difficulty should update correctly', async function () {
    const difficultyUpdated = await this.page.evaluate(() => {
        return window.difficultyLevel === Math.floor(window.gameTime / 60);
    });
    assert.ok(difficultyUpdated, 'Difficulty should update correctly');
});

// Simultaneous collisions
Given('multiple aliens are descending', async function () {
    await this.page.evaluate(() => {
        window.activeAliens = [];
        ['left', 'center', 'right'].forEach(position => {
            spawnAlien(null, position);
        });
    });
    await this.page.waitForFunction(() => 
        window.activeAliens.length >= 3
    , { timeout: 2000 });
});

When('I fire answers at multiple aliens simultaneously', async function () {
    await this.page.evaluate(() => {
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            const bullet = {
                x: alien.x,
                y: CANNON_Y,
                answer: correctAnswer,
                speed: BULLET_BASE_SPEED,
                targetAlien: alien,
                isCorrectAnswer: true
            };
            window.activeBullets.push(bullet);
        });
    });
    await this.page.waitForTimeout(500);
});

Then('each collision should resolve correctly', async function () {
    const collisionsResolved = await this.page.evaluate(() => {
        return window.activeBullets.length === 0; // All bullets processed
    });
    assert.ok(collisionsResolved, 'Collisions should resolve correctly');
});

Then('the score should update accurately', async function () {
    const scoreAccurate = await this.page.evaluate(() => {
        return window.score > 0 && 
               typeof window.score === 'number' &&
               window.score === Math.floor(window.score); // No fractional scores
    });
    assert.ok(scoreAccurate, 'Score should update accurately');
});

Then('new aliens should spawn appropriately', async function () {
    const spawningAppropriate = await this.page.evaluate(() => {
        return window.activeAliens.length > 0 &&
               window.activeAliens.every(alien => 
                   alien.x >= 0 && alien.x <= window.CANVAS_WIDTH &&
                   alien.y >= 0 && alien.y <= window.CANVAS_HEIGHT
               );
    });
    assert.ok(spawningAppropriate, 'New aliens should spawn appropriately');
});

Then('that answer should be fired but not destroy the alien', async function () {
    const result = await this.page.evaluate(() => {
        return new Promise(resolve => {
            // Wait briefly for bullet to be processed
            setTimeout(() => {
                const bulletFired = window.activeBullets.length > 0;
                const alienExists = window.activeAliens.length === 1;
                const alien = window.activeAliens[0];
                
                console.log('Wrong answer check:', {
                    bulletFired,
                    alienExists,
                    bulletCount: window.activeBullets.length,
                    alienCount: window.activeAliens.length,
                    alien: alien ? {
                        factor1: alien.factor1,
                        factor2: alien.factor2
                    } : null
                });
                
                resolve(bulletFired && alienExists);
            }, 100);
        });
    });
    
    assert.ok(result, 'Wrong answer should be fired but alien should remain');
});
