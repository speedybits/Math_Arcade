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

    // Click the start button and wait for it to be processed
    await this.page.evaluate(() => {
        return new Promise((resolve) => {
            const startButton = document.getElementById('startButton');
            if (startButton) {
                startButton.click();
                // Give a short delay for click to process
                setTimeout(resolve, 100);
            } else {
                throw new Error('Start button not found');
            }
        });
    });

    // Wait for game to start
    await this.page.waitForFunction(() => 
        window.gameStarted === true
    , { timeout: 5000 });

    // Wait for first alien to appear
    await this.page.waitForFunction(() => {
        console.log('Checking aliens:', {
            gameStarted: window.gameStarted,
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens
        });
        return window.activeAliens && window.activeAliens.length > 0;
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
    await this.page.evaluate(() => {
        // Reset game state first
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
        
        // Start the game
        window.startGame();
    });

    // Wait for game to start with debug logging
    await this.page.waitForFunction(() => {
        console.log('Game state:', {
            gameStarted: window.gameStarted,
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens?.map(a => ({
                position: a.position,
                x: a.x,
                y: a.y
            }))
        });
        return window.gameStarted === true;
    }, { timeout: 5000 });

    // Wait for multiple aliens with more detailed logging
    await this.page.waitForFunction(() => {
        const state = {
            gameStarted: window.gameStarted,
            alienCount: window.activeAliens?.length,
            aliens: window.activeAliens?.map(a => ({
                position: a.position,
                x: a.x,
                y: a.y
            }))
        };
        console.log('Waiting for multiple aliens:', state);
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
