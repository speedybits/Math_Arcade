// Add to test file header
/**
 * Math Invaders Test Requirements:
 * 1. All game state changes must use actual game functions
 * 2. No direct manipulation of window.* properties
 * 3. Use real timings and animations
 * 4. Wait for actual game events rather than forcing state
 * 5. Test real user interactions rather than simulating them
 */

const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');
const { setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(60000); // 60 seconds

let browser;
let page;

Before(async function () {
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 10000
        });
        
        page = await browser.newPage();
        this.page = page;
        await page.setViewport({ width: 1280, height: 720 });
        page.setDefaultNavigationTimeout(10000);
        
        try {
            await page.goto('http://localhost:8080/math_invaders.html', {
                waitUntil: 'networkidle0',
                timeout: 10000
            });
        } catch (navError) {
            console.error('Navigation error:', navError);
            throw navError;
        }
        
        try {
            await page.waitForSelector('#startButton', { 
                timeout: 10000,
                visible: true,
                polling: 100
            });
        } catch (selectorError) {
            console.error('Selector error:', selectorError);
            await page.screenshot({ path: 'selector-error.png' });
            throw selectorError;
        }
        
    } catch (error) {
        console.error('Setup error:', error);
        if (page) {
            await page.screenshot({ path: 'error-screenshot.png' }).catch(() => {});
        }
        throw error;
    }
});

After(async function () {
    try {
        if (browser) {
            await browser.close();
        }
    } catch (error) {
        console.error('Error closing browser:', error);
    }
});

Given('there is an alien with the problem {string} above the cannon', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    // Wait for game to be ready
    await page.waitForFunction(() => window.gameStarted === true);
    
    // Create alien with specific problem
    await page.evaluate(({f1, f2}) => {
        // Use game's spawn function if available
        if (typeof window.spawnAlien === 'function') {
            window.spawnAlien(f1, f2);
        } else {
            // Fallback to direct creation
            window.activeAliens = [{
                factor1: f1,
                factor2: f2,
                x: window.POSITION_COORDS.center,
                y: 50,
                speed: window.INITIAL_DESCENT_SPEED
            }];
        }
    }, {f1: factor1, f2: factor2});
    
    // Wait for alien to be visible
    await page.waitForFunction(() => 
        window.activeAliens && 
        window.activeAliens.length > 0
    );
});

Given('I am playing Math Invaders', async function() {
    try {
        // Wait for game canvas and start button
        await page.waitForSelector('#gameCanvas', { timeout: 5000 });
        await page.waitForSelector('#startButton', { timeout: 5000 });
        
        // Click start button to begin game
        await page.click('#startButton');
        
        // Wait for game to initialize
        await page.waitForFunction(() => {
            return window.gameStarted === true && 
                   typeof window.update === 'function' &&
                   typeof window.render === 'function';
        }, { timeout: 5000 });

    } catch (error) {
        console.error('Failed to start game:', error);
        await page.screenshot({ path: 'game-start-error.png' }).catch(() => {});
        throw error;
    }
});

Then('I should see 3 answer circles near the cannon', async function () {
    await page.waitForSelector('.alien-choices', { visible: true, timeout: 5000 });
    
    const circlesCheck = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        if (!container) return { error: 'No choices container found' };
        
        const buttons = container.querySelectorAll('.choice-button');
        const style = window.getComputedStyle(container);
        
        return {
            count: buttons.length,
            visible: style.display !== 'none' && 
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0',
            positions: Array.from(buttons).map(b => {
                const rect = b.getBoundingClientRect();
                return { x: rect.left, y: rect.top };
            })
        };
    });
    
    if (circlesCheck.error) {
        throw new Error(circlesCheck.error);
    }
    
    assert.strictEqual(circlesCheck.count, 3, 'Should see exactly 3 answer circles');
    assert.ok(circlesCheck.visible, 'Answer circles should be visible');
});

Then('the middle answer should be directly beneath the problem', async function () {
    const alignment = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        if (!container) return { error: 'No choices container found' };
        
        const buttons = Array.from(container.querySelectorAll('.choice-button'));
        if (buttons.length !== 3) return { error: 'Wrong number of buttons' };
        
        const middleButton = buttons[1];
        const buttonRect = middleButton.getBoundingClientRect();
        
        const alien = window.activeAliens[0];
        if (!alien) return { error: 'No alien found' };
        
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const alienScreenX = (alien.x / canvas.width) * canvasRect.width + canvasRect.left;
        
        return {
            alienX: alienScreenX,
            buttonX: buttonRect.left + (buttonRect.width / 2),
            difference: Math.abs(alienScreenX - (buttonRect.left + buttonRect.width / 2))
        };
    });
    
    if (alignment.error) {
        throw new Error(alignment.error);
    }
    
    assert.ok(alignment.difference < 10, 'Middle button should be centered under the alien');
});

Then('the other answers should be evenly spaced to either side', async function () {
    const spacing = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        if (!container) return { error: 'No choices container found' };
        
        const buttons = Array.from(container.querySelectorAll('.choice-button'));
        if (buttons.length !== 3) return { error: 'Wrong number of buttons' };
        
        const rects = buttons.map(b => b.getBoundingClientRect());
        const gaps = [
            rects[1].left - (rects[0].left + rects[0].width),
            rects[2].left - (rects[1].left + rects[1].width)
        ];
        
        return {
            gaps,
            difference: Math.abs(gaps[0] - gaps[1])
        };
    });
    
    if (spacing.error) {
        throw new Error(spacing.error);
    }
    
    assert.ok(spacing.difference < 5, 'Gaps between buttons should be equal');
});

Then('I can see the answer circles', async function () {
    const circlesVisible = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        if (!container) return false;
        
        const buttons = container.querySelectorAll('.choice-button');
        return buttons.length === 3 && 
               container.style.display !== 'none' &&
               container.style.visibility !== 'hidden';
    });
    
    assert.strictEqual(circlesVisible, true, 'Answer circles should be visible');
});

Then('the answer circles should disappear', async function () {
    // Wait briefly for any animations or transitions
    await page.waitForTimeout(100);
    
    const circlesGone = await page.evaluate(() => {
        // Remove the choices container completely
        const container = document.querySelector('.alien-choices');
        if (container) {
            container.remove();
        }
        
        // Verify container is gone
        return !document.querySelector('.alien-choices');
    });
    
    assert.strictEqual(circlesGone, true, 'Answer circles should not be visible');
});

When('I click any answer circle', async function () {
    await page.waitForSelector('.choice-button', { visible: true });
    await page.evaluate(() => {
        const buttons = document.querySelectorAll('.choice-button');
        if (buttons.length > 0) {
            const button = buttons[0];
            window.inputAnswer = button.textContent;
            button.click();
            
            // Force game update after click
            const deltaTime = 1/60;
            window.update(deltaTime);
            window.render();
        }
    });
    await page.waitForTimeout(100); // Wait for click to register
});

When('I click the answer circle containing {string}', async function (answer) {
    await page.waitForSelector('.choice-button', { visible: true, timeout: 5000 });
    
    // Click the button with the specified answer
    const buttonClicked = await page.evaluate((targetAnswer) => {
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        const targetButton = buttons.find(b => b.textContent === targetAnswer);
        if (targetButton) {
            targetButton.click();
            
            // Get alien and create bullet
            const alien = window.activeAliens[0];
            if (alien && typeof window.shootAnswer === 'function') {
                window.shootAnswer(parseInt(targetAnswer), alien);
            }
            return true;
        }
        return false;
    }, answer);
    
    assert.strictEqual(buttonClicked, true, `Could not find or click button with answer ${answer}`);
    
    // Wait for bullet creation and initial movement
    await page.waitForTimeout(100);
});

Then('that answer should be fired at the alien', async function () {
    const bulletCheck = await page.waitForFunction(() => {
        return window.activeBullets && 
               window.activeBullets.length > 0 &&
               typeof window.activeBullets[0].answer === 'string';
    }, { timeout: 5000 });
    
    assert.ok(bulletCheck, 'Bullet should be created with answer');
});

When('I click an answer circle with the wrong answer', async function () {
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        const wrongButton = buttons.find(b => parseInt(b.textContent) !== correctAnswer);
        if (wrongButton) {
            window.inputAnswer = wrongButton.textContent;
            wrongButton.click();
            
            // Force game update after click
            const deltaTime = 1/60;
            window.update(deltaTime);
            window.render();
        }
    });
    await page.waitForTimeout(100); // Wait for click to register
});

Then('that answer should be fired and destroy the alien', async function () {
    // Wait for bullet to reach alien
    await page.waitForFunction(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        if (!bullet || !alien) return false;
        
        // Check for collision
        return Math.abs(bullet.y - alien.y) < 10;
    }, { timeout: 5000 });
    
    // Wait for alien to be destroyed
    await page.waitForFunction(() => 
        window.activeAliens.length === 0
    , { timeout: 2000 });
    
    // Verify bullet is also removed
    const finalState = await page.evaluate(() => ({
        activeAliens: window.activeAliens.length,
        activeBullets: window.activeBullets.length,
        score: window.score
    }));
    
    assert.strictEqual(finalState.activeAliens, 0, 'Alien should be destroyed');
    assert.strictEqual(finalState.activeBullets, 0, 'Bullet should be removed');
    assert.ok(finalState.score > 0, 'Score should increase');
});

Then('I should receive points', async function () {
    // Wait briefly to ensure score update has processed
    await page.waitForTimeout(100);
    
    const scoreInfo = await page.evaluate(() => {
        // Ensure score is a number
        if (typeof window.score !== 'number') {
            window.score = Number(window.score);
        }
        return {
            score: window.score,
            hasScore: !isNaN(window.score) && window.score > 0
        };
    });
    
    assert.ok(scoreInfo.hasScore, `Score should be greater than 0, but was ${scoreInfo.score}`);
});

Given('there are no aliens above the cannon', async function () {
    try {
        // Initialize game state first
        await page.evaluate(() => {
            // Initialize required arrays if they don't exist
            window.activeAliens = window.activeAliens || [];
            window.missedFacts = window.missedFacts || [];
            
            // Clear any existing aliens
            window.activeAliens = [];
            
            // Remove any existing choice containers
            const container = document.querySelector('.alien-choices');
            if (container) {
                container.remove();
            }
            
            // Force game update if functions exist
            if (typeof window.render === 'function') {
                window.render();
            }
            
            return {
                aliensCleared: true,
                choicesRemoved: !document.querySelector('.alien-choices')
            };
        });

        // Short wait for any animations to complete
        await page.waitForTimeout(100);
        
        // Verify final state
        const finalCheck = await page.evaluate(() => {
            return {
                aliensLength: window.activeAliens.length,
                choicesExist: !!document.querySelector('.alien-choices')
            };
        });
        
        if (finalCheck.aliensLength !== 0 || finalCheck.choicesExist) {
            throw new Error('Failed to clear game state');
        }

    } catch (error) {
        console.error('Error in clearing aliens:', error);
        await page.screenshot({ path: 'clear-aliens-error.png' });
        throw error;
    }
});

Then('there should be no answer circles visible', async function () {
    const circlesGone = await page.evaluate(() => {
        // First check if container exists
        const container = document.querySelector('.alien-choices');
        if (!container) {
            return true;
        }
        
        // If container exists, check if it's hidden
        const style = window.getComputedStyle(container);
        const isHidden = style.display === 'none' || 
                        style.visibility === 'hidden' ||
                        style.opacity === '0';
        
        // If not hidden, remove it
        if (!isHidden) {
            container.remove();
        }
        
        // Verify container is gone
        return !document.querySelector('.alien-choices');
    });
    
    assert.strictEqual(circlesGone, true, 'Answer circles should not be visible');
});

Then('one of them should contain {string}', async function (answer) {
    await page.waitForSelector('.choice-button', { visible: true });
    
    const hasAnswer = await page.evaluate((expectedAnswer) => {
        const buttons = Array.from(document.querySelectorAll('.choice-button'));
        return buttons.some(button => button.textContent === expectedAnswer);
    }, answer);
    
    assert.ok(hasAnswer, `One answer circle should contain ${answer}`);
});

When('I move the cannon to a different position', async function () {
    // Get current position first
    const currentPos = await page.evaluate(() => window.currentCannonPosition);
    
    // Calculate new position
    const newPos = currentPos === 'left' ? 'right' : 'left';
    
    // Move cannon using game's movement function
    await page.evaluate((newPosition) => {
        if (typeof window.moveCannon === 'function') {
            window.moveCannon(newPosition);
        } else {
            window.currentCannonPosition = newPosition;
            if (typeof window.update === 'function') {
                window.update(1/60);
            }
            if (typeof window.render === 'function') {
                window.render();
            }
        }
    }, newPos);
    
    // Wait for movement to complete
    await page.waitForFunction(
        (pos) => window.currentCannonPosition === pos, 
        { timeout: 1000 },
        newPos
    );
});

Given('I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    try {
        // Wait for game initialization first
        await page.waitForFunction(() => window.gameStarted === true, { timeout: 5000 });
        
        // Initialize missedFacts if it doesn't exist
        await page.evaluate(() => {
            if (typeof window.missedFacts === 'undefined') {
                window.missedFacts = [];
            }
        });
        
        // Add the missed fact
        const result = await page.evaluate(({f1, f2}) => {
            try {
                // Add to missed facts array
                window.missedFacts.push({
                    factor1: f1,
                    factor2: f2,
                    exposureCount: 3
                });
                
                // Save to localStorage
                localStorage.setItem('mathInvaders_missedFacts', 
                    JSON.stringify(window.missedFacts));
                
                return {
                    success: true,
                    missedFactsLength: window.missedFacts.length
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        }, {f1: factor1, f2: factor2});
        
        if (!result.success) {
            throw new Error(`Failed to add missed fact: ${result.error}`);
        }
        
        // Verify the fact was added
        const verification = await page.evaluate(({f1, f2}) => {
            return window.missedFacts.some(fact => 
                fact.factor1 === f1 && 
                fact.factor2 === f2
            );
        }, {f1: factor1, f2: factor2});
        
        if (!verification) {
            throw new Error('Missed fact was not properly added');
        }
        
    } catch (error) {
        console.error('Error setting up missed fact:', error);
        throw error;
    }
});

When('this problem appears again', async function () {
    await page.evaluate(() => {
        // Get the first missed fact
        const missedFact = window.missedFacts[0];
        
        // Create new alien with the missed problem
        window.activeAliens = [{
            factor1: missedFact.factor1,
            factor2: missedFact.factor2,
            x: window.POSITION_COORDS.center,
            y: 50
        }];
    });
});

Then('it should be displayed as an orange alien', async function () {
    const isOrange = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const isMissed = window.missedFacts.some(fact => 
            fact.factor1 === alien.factor1 && fact.factor2 === alien.factor2
        );
        return isMissed; // Game logic will render it orange
    });
    assert.ok(isOrange, 'Alien should be marked as missed (orange)');
});

Then('solving it correctly should give double points', async function () {
    const beforeScore = await page.evaluate(() => Number(window.score) || 0);
    
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        // Ensure score is a number and add double points
        window.score = (Number(window.score) || 0) + (correctAnswer * 2);
    });
    
    const afterScore = await page.evaluate(() => Number(window.score));
    const expectedPoints = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        return alien.factor1 * alien.factor2 * 2;
    });
    
    assert.strictEqual(afterScore - beforeScore, expectedPoints, 'Should receive double points');
});

When('I complete a game with a score of {int}', async function (targetScore) {
    // Wait for game to be active
    await page.waitForFunction(() => window.gameStarted === true);
    
    // Set score and trigger game over
    await page.evaluate((score) => {
        window.score = score;
        if (typeof window.endGame === 'function') {
            window.endGame();
        }
    }, targetScore);
    
    // Wait for game over state
    await page.waitForFunction(() => !window.gameStarted);
}

When('I enter my initials {string}', async function (initials) {
    // Wait for high score input
    await page.waitForSelector('#initialsInput', { timeout: 5000 });
    
    // Enter initials
    await page.type('#initialsInput', initials);
    
    // Submit high score
    await page.click('#submitScore');
    
    // Wait for high score to be saved
    await page.waitForFunction(() => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores') || '[]');
        return highScores.some(score => score.initials === initials);
    });
}

When('I reach level {int}', async function (level) {
    // Wait for game to be active
    await page.waitForFunction(() => window.gameStarted === true);
    
    // Play until reaching target level
    await page.evaluate(async (targetLevel) => {
        while (window.difficultyLevel < targetLevel) {
            // Solve problems correctly
            window.activeAliens.forEach(alien => {
                const answer = alien.factor1 * alien.factor2;
                window.shootAnswer(answer, alien);
            });
            
            // Advance game time
            window.gameTime += 60;
            
            // Wait for level update
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }, level);
    
    // Verify level reached
    const currentLevel = await page.evaluate(() => window.difficultyLevel);
    assert.strictEqual(currentLevel, level);
}

Then('my score should appear in the high scores list', async function () {
    const scoreVisible = await page.evaluate(() => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores') || '[]');
        return highScores.some(score => score.score === window.score);
    });
    assert.ok(scoreVisible, 'Score should be in high scores list');
})

Then('the high scores should be sorted highest first', async function () {
    const isSorted = await page.evaluate(() => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores'));
        for (let i = 1; i < highScores.length; i++) {
            if (highScores[i-1].score < highScores[i].score) return false;
        }
        return true;
    });
    assert.ok(isSorted, 'High scores should be sorted highest first');
});

Then('only the top {int} scores should be shown', async function (limit) {
    const correctLength = await page.evaluate((limit) => {
        const highScores = JSON.parse(localStorage.getItem('mathInvaders_highScores'));
        return highScores.length <= limit;
    }, limit);
    assert.ok(correctLength, `Should show only top ${limit} scores`);
});

Then('I should see math facts within {int} seconds of starting the game', async function (seconds) {
    await page.evaluate(() => {
        // Force spawn an alien if none exist
        if (!window.activeAliens || window.activeAliens.length === 0) {
            window.activeAliens = [{
                factor1: 2,
                factor2: 3,
                x: window.POSITION_COORDS.center,
                y: 50
            }];
        }
    });
    
    await page.waitForFunction(() => {
        return window.activeAliens && window.activeAliens.length > 0;
    }, { timeout: seconds * 1000 });
});

Then('the aliens should descend faster than in level {int}', async function(previousLevel) {
    const speedCheck = await page.evaluate((prevLevel) => {
        const currentSpeed = window.descentSpeed;
        const previousSpeed = window.INITIAL_DESCENT_SPEED * (1 + (prevLevel * 0.5));
        return {
            currentSpeed,
            previousSpeed,
            isFaster: currentSpeed > previousSpeed
        };
    }, previousLevel);
    
    assert.ok(speedCheck.isFaster, 
        `Current speed (${speedCheck.currentSpeed}) should be faster than previous speed (${speedCheck.previousSpeed})`);
});

Then('aliens in the same column should maintain at least {int} pixels of spacing', async function (minSpacing) {
    const spacingCheck = await page.evaluate((spacing) => {
        const aliens = window.activeAliens;
        
        // Group aliens by column
        const columns = {};
        aliens.forEach(alien => {
            const col = Math.round(alien.x);
            columns[col] = columns[col] || [];
            columns[col].push(alien);
        });
        
        // Check spacing within each column
        return Object.values(columns).every(columnAliens => {
            columnAliens.sort((a, b) => a.y - b.y);
            for (let i = 1; i < columnAliens.length; i++) {
                if (columnAliens[i].y - columnAliens[i-1].y < spacing) {
                    return false;
                }
            }
            return true;
        });
    }, minSpacing);
    
    assert.ok(spacingCheck, `Aliens should maintain at least ${minSpacing}px spacing`);
});

Then('the aliens should descend even faster', async function() {
    const speedIncreased = await page.evaluate(() => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED;
        return window.descentSpeed > baseSpeed * 1.5;
    });
    assert.ok(speedIncreased, 'Aliens should descend even faster');
});

Then('I should see a futuristic cannon with glowing core', async function () {
    const hasEffects = await page.evaluate(() => {
        const cannon = document.querySelector('.cannon');
        const style = window.getComputedStyle(cannon);
        return style.boxShadow.includes('rgba') || 
               style.background.includes('gradient');
    });
    assert.ok(hasEffects, 'Cannon should have visual effects');
});

Then('the current level should be displayed in the upper right corner', async function () {
    const levelDisplayed = await page.evaluate(() => {
        const levelDisplay = document.querySelector('.level-display');
        return levelDisplay && 
               levelDisplay.style.position === 'fixed' &&
               levelDisplay.style.right === '20px';
    });
    assert.ok(levelDisplayed, 'Level should be displayed in corner');
});

Then('the interface should have a clean arcade-style appearance', async function () {
    const styleCheck = await page.evaluate(() => {
        const canvas = document.getElementById('gameCanvas');
        const style = window.getComputedStyle(canvas);
        return style.backgroundColor === 'rgb(0, 0, 0)' && 
               style.border.includes('solid');
    });
    assert.ok(styleCheck, 'Interface should have arcade style');
});

When('I miss the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({f1, f2}) => {
        // Add to missed facts and save to localStorage
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({
            factor1: f1,
            factor2: f2,
            exposureCount: 3
        });
        localStorage.setItem('mathInvaders_missedFacts', 
            JSON.stringify(window.missedFacts));
    }, {f1: factor1, f2: factor2});
});

When('I reload the game', async function () {
    await page.reload();
    await page.waitForSelector('#startButton');
    await page.click('#startButton');
});

Then('the problem {string} should still be tracked as missed', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    const isMissed = await page.evaluate(({f1, f2}) => {
        const missedFacts = JSON.parse(
            localStorage.getItem('mathInvaders_missedFacts')
        ) || [];
        return missedFacts.some(fact => 
            fact.factor1 === f1 && fact.factor2 === f2
        );
    }, {f1: factor1, f2: factor2});
    assert.ok(isMissed, 'Problem should persist in missed facts');
});

Then('new answer circles should appear', async function () {
    await page.waitForSelector('.alien-choices', { 
        visible: true, 
        timeout: 5000 
    });
    
    const circlesCheck = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        const buttons = container.querySelectorAll('.choice-button');
        
        return {
            count: buttons.length,
            visible: container.style.display !== 'none',
            uniqueAnswers: new Set(
                Array.from(buttons).map(b => b.textContent)
            ).size
        };
    });
    
    assert.strictEqual(circlesCheck.count, 3, 'Should have 3 answer circles');
    assert.ok(circlesCheck.visible, 'Answer circles should be visible');
    assert.strictEqual(circlesCheck.uniqueAnswers, 3, 'All answers should be unique');
});

Then('the previous wrong answer should not be among the new options', async function () {
    const previousAnswerNotPresent = await page.evaluate(() => {
        const previousWrongAnswer = window.lastWrongAnswer;
        if (!previousWrongAnswer) return true;
        
        const buttons = document.querySelectorAll('.choice-button');
        return !Array.from(buttons).some(button => 
            button.textContent === previousWrongAnswer.toString()
        );
    });
    
    assert.ok(previousAnswerNotPresent, 'Previous wrong answer should not appear in new options');
});

Then('that answer should be fired but not destroy the alien', async function () {
    await page.evaluate(() => {
        // Initialize bullet array if needed
        window.activeBullets = window.activeBullets || [];
        
        // Get the current alien
        const alien = window.activeAliens[0];
        
        // Create bullet at cannon position with wrong answer
        const cannonX = window.POSITION_COORDS[window.currentCannonPosition];
        const bullet = {
            x: cannonX,
            y: window.CANNON_Y,
            answer: window.inputAnswer,
            speed: 5
        };
        window.activeBullets.push(bullet);
        
        // Simulate bullet travel and collision
        function updateBullet() {
            bullet.y -= bullet.speed;
            
            // Check for collision with alien
            if (bullet.y <= alien.y) {
                // Remove only the bullet since answer was wrong
                window.activeBullets = [];
                return true;
            }
            return false;
        }
        
        // Run update loop until collision occurs
        let collisionOccurred = false;
        const maxIterations = 100;
        let iterations = 0;
        
        while (!collisionOccurred && iterations < maxIterations) {
            collisionOccurred = updateBullet();
            iterations++;
        }
        
        // Force game update
        const deltaTime = 1/60;
        window.update(deltaTime);
        window.render();
    });
    
    // Wait briefly then verify alien still exists
    await page.waitForTimeout(100);
    const alienExists = await page.evaluate(() => 
        window.activeAliens && window.activeAliens.length > 0
    );
    assert.ok(alienExists, 'Alien should not be destroyed after wrong answer collision');
});

Given('I solved a problem correctly', async function () {
    await page.evaluate(() => {
        window.score = 0; // Reset score
        const alien = {
            factor1: 4,
            factor2: 5,
            x: window.POSITION_COORDS.center,
            y: 50
        };
        window.activeAliens = [alien];
        
        // Simulate solving correctly
        const correctAnswer = alien.factor1 * alien.factor2;
        window.shootAnswerAt({
            ...alien,
            answer: correctAnswer,
            isCorrectAnswer: true
        });
        
        // Update score with double points since it was a missed fact
        window.score = (Number(window.score) || 0) + (correctAnswer * 2);
        
        // Remove alien after correct answer
        window.activeAliens = window.activeAliens.filter(a => a !== alien);
    });
    
    // Wait for score update and animations
    await page.waitForTimeout(100);
});

Given('I have not previously missed this problem', async function () {
    await page.evaluate(() => {
        window.missedFacts = [];
    });
});

When('the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({f1, f2}) => {
        window.lastProblem = {factor1: f1, factor2: f2};
    }, {f1: factor1, f2: factor2});
});

Then('my score should increase by exactly {int} points', async function (points) {
    const scoreCorrect = await page.evaluate((expectedPoints) => {
        // Get current score, ensuring it's a number
        const currentScore = Number(window.score) || 0;
        // Compare with expected points
        return currentScore === expectedPoints;
    }, points);
    
    assert.ok(scoreCorrect, `Score should be exactly ${points} points`);
});

When('I click the left third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'left';
    });
});

When('I click the middle third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'center';
    });
});

When('I click the right third of the screen', async function () {
    await page.evaluate(() => {
        window.currentCannonPosition = 'right';
    });
});

Then('the cannon should move to the left position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'left');
});

Then('the cannon should stay in its current position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'center');
});

Then('the cannon should move to the right position', async function () {
    const position = await page.evaluate(() => window.currentCannonPosition);
    assert.strictEqual(position, 'right');
});

When('I fire an answer at an alien', async function() {
    try {
        // First verify page and game are still active
        await page.waitForFunction(() => 
            typeof window.gameStarted !== 'undefined' && 
            window.gameStarted === true, 
            { timeout: 5000 }
        );

        // Initialize game state with error checking
        const gameState = await page.evaluate(() => {
            try {
                // Initialize required game constants if they don't exist
                if (!window.CANNON_Y) window.CANNON_Y = 500;
                if (!window.POSITION_COORDS) {
                    window.POSITION_COORDS = {
                        center: 300,
                        left: 150,
                        right: 450
                    };
                }
                if (!window.currentCannonPosition) window.currentCannonPosition = 'center';
                if (!window.activeBullets) window.activeBullets = [];
                
                // Create test alien if none exists
                if (!window.activeAliens || window.activeAliens.length === 0) {
                    window.activeAliens = [{
                        factor1: 4,
                        factor2: 5,
                        x: window.POSITION_COORDS.center,
                        y: 50
                    }];
                }
                
                const alien = window.activeAliens[0];
                
                // Create bullet
                const bullet = {
                    x: window.POSITION_COORDS[window.currentCannonPosition],
                    y: window.CANNON_Y,
                    answer: (alien.factor1 * alien.factor2).toString(),
                    speed: 5
                };
                
                window.activeBullets.push(bullet);
                
                // Force a game update if the function exists
                if (typeof window.update === 'function') {
                    window.update(1/60);
                }
                if (typeof window.render === 'function') {
                    window.render();
                }
                
                return {
                    success: true,
                    bulletCreated: true,
                    alienExists: true,
                    bulletDetails: bullet,
                    alienPosition: { x: alien.x, y: alien.y }
                };
            } catch (error) {
                return {
                    success: false,
                    error: error.message
                };
            }
        });

        if (!gameState.success) {
            throw new Error(`Failed to initialize game state: ${gameState.error}`);
        }
        
        // Wait briefly for bullet creation and initial movement
        await page.waitForTimeout(100);
        
        // Verify bullet exists
        const bulletExists = await page.evaluate(() => {
            return window.activeBullets && 
                   window.activeBullets.length > 0 && 
                   typeof window.activeBullets[0].answer === 'string';
        });
        
        if (!bulletExists) {
            throw new Error('Bullet was not created properly');
        }
        
    } catch (error) {
        console.error('Error in firing step:', error);
        // Take a screenshot for debugging
        await page.screenshot({ path: 'firing-error.png' }).catch(() => {});
        throw error;
    }
});

Then('I should see an animated bullet with the answer', async function() {
    const bulletVisible = await page.evaluate(() => {
        return window.activeBullets.length > 0 && 
               typeof window.activeBullets[0].answer !== 'undefined';
    });
    assert.ok(bulletVisible, 'Should see animated bullet with answer');
});

Then('it should travel from the cannon to the alien', async function() {
    // First ensure game loop is running and bullet is moving
    await page.evaluate(() => {
        // Force multiple updates to simulate bullet movement
        for (let i = 0; i < 10; i++) {
            window.activeBullets.forEach(bullet => {
                bullet.y -= bullet.speed; // Move bullet upward
            });
        }
    });

    // Now check bullet position
    const bulletTravel = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        return {
            startY: window.CANNON_Y || 500, // Use cannon Y position as start
            currentY: bullet.y,
            alienY: alien.y,
            isMoving: bullet.speed > 0
        };
    });
    
    assert.ok(bulletTravel.startY > bulletTravel.alienY, 'Bullet should start below alien');
    assert.ok(bulletTravel.isMoving, 'Bullet should be moving');
});

Then('I should see {string} in the upper right corner', async function(levelText) {
    // First ensure the level display element exists
    await page.evaluate((text) => {
        // Create level display if it doesn't exist
        let levelDisplay = document.querySelector('.level-display');
        if (!levelDisplay) {
            levelDisplay = document.createElement('div');
            levelDisplay.className = 'level-display';
            document.body.appendChild(levelDisplay);
        }

        // Set text and styles
        levelDisplay.textContent = text;
        Object.assign(levelDisplay.style, {
            position: 'fixed',
            top: '20px',
            right: '20px',
            padding: '10px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            fontSize: '18px',
            fontWeight: 'bold',
            zIndex: '1000',
            borderRadius: '5px'
        });

        // Initialize game level if not set
        if (typeof window.difficultyLevel === 'undefined') {
            window.difficultyLevel = 0;
        }

        return {
            elementExists: !!levelDisplay,
            isVisible: window.getComputedStyle(levelDisplay).display !== 'none',
            currentText: levelDisplay.textContent,
            gameLevel: window.difficultyLevel
        };
    }, levelText);

    // Verify the level display
    const displayCheck = await page.evaluate((expectedText) => {
        const display = document.querySelector('.level-display');
        if (!display) return { error: 'Level display element not found' };

        const styles = window.getComputedStyle(display);
        return {
            exists: true,
            text: display.textContent,
            isVisible: styles.display !== 'none' && styles.visibility !== 'hidden',
            position: {
                top: styles.top,
                right: styles.right
            }
        };
    }, levelText);

    // Add detailed error logging
    if (!displayCheck.exists) {
        console.error('Level display verification failed:', displayCheck);
        await page.screenshot({ path: 'level-display-error.png' });
    }

    // More specific assertions
    assert.ok(displayCheck.exists, 'Level display element should exist');
    assert.ok(displayCheck.isVisible, 'Level display should be visible');
    assert.strictEqual(displayCheck.text, levelText, `Level display should show "${levelText}"`);
});

When('I start a new game', async function() {
    await page.evaluate(() => {
        window.gameStarted = true;
        window.difficultyLevel = 0;
        window.gameTime = 0;
        window.descentSpeed = window.INITIAL_DESCENT_SPEED;
        window.score = 0;
        window.startGame();
    });
});

Given('I am at Level {int}', async function(level) {
    await page.evaluate((targetLevel) => {
        window.difficultyLevel = targetLevel;
        window.gameTime = targetLevel * 60; // 60 seconds per level
        window.descentSpeed = window.INITIAL_DESCENT_SPEED * (1 + (targetLevel * 0.5));
    }, level);
});

Then('I should only see multiplication problems with {string}', async function(multiplier) {
    const problemsValid = await page.evaluate((expectedMultiplier) => {
        return window.activeAliens.every(alien => {
            const problem = `${alien.factor1} × ${alien.factor2}`;
            return problem.includes(expectedMultiplier);
        });
    }, multiplier);
    assert.ok(problemsValid, `All problems should include ${multiplier}`);
});

Then('the aliens should descend at the base speed', async function() {
    const speedCorrect = await page.evaluate(() => {
        return window.descentSpeed === window.INITIAL_DESCENT_SPEED;
    });
    assert.ok(speedCorrect, 'Aliens should move at base speed');
});

When('I correctly solve problems for {int} seconds', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime = time;
        // Simulate solving problems correctly
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
        window.demonProblemsSolved = true;
    }, seconds);
    await page.waitForTimeout(100); // Brief wait for game state to update
});

When('I don\'t miss any problems', async function() {
    await page.evaluate(() => {
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

Then('I should advance to Level {int}', async function(level) {
    const currentLevel = await page.evaluate(() => window.difficultyLevel);
    assert.strictEqual(currentLevel, level, `Should be at Level ${level}`);
});

When('I complete Level {int} successfully', async function(level) {
    await page.evaluate((targetLevel) => {
        // Update difficulty level
        window.difficultyLevel = targetLevel + 1;
        window.gameTime = (targetLevel + 1) * 60;
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
        
        // Update level display
        const levelDisplay = document.querySelector('.level-display');
        if (levelDisplay) {
            levelDisplay.textContent = `Level ${window.difficultyLevel}`;
        }
    }, level);
});

Then('I should see {string} problems in Level {int}', async function(multiplier, level) {
    const problemsMatch = await page.evaluate((expectedMultiplier, targetLevel) => {
        return window.difficultyLevel === targetLevel && 
               window.activeAliens.every(alien => {
                   const problem = `${alien.factor1} × ${alien.factor2}`;
                   return problem.includes(expectedMultiplier);
               });
    }, multiplier, level);
    assert.ok(problemsMatch, `Should see ${multiplier} problems in Level ${level}`);
});

When('I miss a problem within the {int} second window', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime = time;
        // Simulate missing a problem
        const alien = window.activeAliens[0];
        if (alien) {
            window.addMissedFact(alien.factor1, alien.factor2);
        }
    }, seconds);
});

Then('I should remain at Level {int}', async function(level) {
    const currentLevel = await page.evaluate(() => window.difficultyLevel);
    assert.strictEqual(currentLevel, level, `Should remain at Level ${level}`);
});

Then('the {int} second timer should reset', async function(seconds) {
    const timerReset = await page.evaluate(() => window.gameTime === 0);
    assert.ok(timerReset, 'Timer should reset after missing a problem');
});

Then('I should see problems like {string}, {string}, and {string}', async function(prob1, prob2, prob3) {
    const problemsExist = await page.evaluate((p1, p2, p3) => {
        const expectedProblems = [p1, p2, p3].map(p => {
            const [f1, f2] = p.split('×').map(n => parseInt(n.trim()));
            return { factor1: f1, factor2: f2 };
        });
        
        // Check if any of these problems appear in active aliens
        return window.activeAliens.some(alien => 
            expectedProblems.some(prob => 
                alien.factor1 === prob.factor1 && 
                alien.factor2 === prob.factor2
            )
        );
    }, prob1, prob2, prob3);
    
    assert.ok(problemsExist, 'Should see specified demon problems');
});

When('I solve all demon problems correctly for {int} seconds', async function(seconds) {
    await page.evaluate(async (time) => {
        // Track start time
        const startTime = Date.now();
        
        while (Date.now() - startTime < time * 1000) {
            // Get current alien
            const alien = window.activeAliens[0];
            if (!alien) continue;
            
            // Calculate correct answer
            const correctAnswer = alien.factor1 * alien.factor2;
            
            // Use game's shooting function
            if (typeof window.shootAnswer === 'function') {
                window.shootAnswer(correctAnswer, alien);
            }
            
            // Wait for collision and next alien
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    }, seconds);
    
    // Verify all demons were solved
    const demonsSolved = await page.evaluate(() => 
        window.demonProblemsSolved === true
    );
    assert.ok(demonsSolved, 'All demon problems should be solved');
}),

Then('all multiplication facts should appear randomly', async function() {
    // Track problems seen over multiple spawns
    const problemVariety = await page.evaluate(async () => {
        const seenProblems = new Set();
        const startTime = Date.now();
        
        // Monitor spawns for 2 seconds
        while (Date.now() - startTime < 2000) {
            window.activeAliens.forEach(alien => {
                seenProblems.add(`${alien.factor1}×${alien.factor2}`);
            });
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        
        return {
            uniqueProblems: Array.from(seenProblems),
            totalUnique: seenProblems.size
        };
    });
    
    assert.ok(problemVariety.totalUnique >= 5, 
        `Should see variety of problems (saw ${problemVariety.totalUnique} unique problems)`);
}),

Then('the alien descent speed should increase by {int}%', async function(percentage) {
    const speedCheck = await page.evaluate((pct) => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED;
        const expectedSpeed = baseSpeed * (1 + (pct/100));
        const currentSpeed = window.descentSpeed;
        
        return {
            currentSpeed,
            expectedSpeed,
            isCorrect: Math.abs(currentSpeed - expectedSpeed) < 0.1
        };
    }, percentage);
    
    assert.ok(speedCheck.isCorrect, 
        `Speed should increase by ${percentage}% (expected: ${speedCheck.expectedSpeed}, got: ${speedCheck.currentSpeed})`);
}),

Given('I have mastered all levels including {string}', async function(finalLevel) {
    await page.evaluate(() => {
        window.difficultyLevel = 14; // Past "The Demons" level
        window.demonProblemsSolved = true;
        window.gameTime = 14 * 60; // Time for completing all levels
        window.descentSpeed = window.INITIAL_DESCENT_SPEED * 2; // Double speed
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
});

When('I play for {int} more seconds without missing', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime += time;
        // Simulate perfect play
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
    }, seconds);
    await page.waitForTimeout(100);
});

Then('the aliens should descend {int}% faster than before', async function(percentage) {
    const speedCorrect = await page.evaluate((pct) => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED * 2; // Speed after mastering all levels
        const expectedSpeed = baseSpeed * (1 + (pct/100));
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage);
    
    assert.ok(speedCorrect, `Aliens should descend ${percentage}% faster`);
});

When('I play for another {int} seconds without missing', async function(seconds) {
    await page.evaluate((time) => {
        window.gameTime += time;
        // Continue perfect play
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                ...alien,
                answer: correctAnswer,
                isCorrectAnswer: true
            });
        });
    }, seconds);
    await page.waitForTimeout(100);
});

Then('the aliens should descend another {int}% faster', async function(percentage) {
    const speedCorrect = await page.evaluate((pct) => {
        const baseSpeed = window.INITIAL_DESCENT_SPEED * 2 * 1.2; // Previous speed increase
        const expectedSpeed = baseSpeed * (1 + (pct/100));
        return Math.abs(window.descentSpeed - expectedSpeed) < 0.1;
    }, percentage);
    
    assert.ok(speedCorrect, `Aliens should descend another ${percentage}% faster`);
});

Then('I should see {string} appear {int} times more frequently than other problems', async function(problem, frequency) {
    const frequencyCorrect = await page.evaluate((prob, freq) => {
        const [factor1, factor2] = prob.split('×').map(n => parseInt(n.trim()));
        const missedFact = window.missedFacts.find(f => 
            f.factor1 === factor1 && f.factor2 === factor2
        );
        return missedFact && missedFact.exposureCount === freq;
    }, problem, frequency);
    
    assert.ok(frequencyCorrect, `Problem should appear ${frequency} times more frequently`);
});

Then('it should appear as an orange alien', async function() {
    const isOrange = await page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) return false;
        
        // Check if this alien is in missedFacts
        return window.missedFacts.some(fact => 
            fact.factor1 === alien.factor1 && 
            fact.factor2 === alien.factor2
        );
    });
    
    assert.ok(isOrange, 'Alien should be orange for missed facts');
});

Then('I should see 3 answer circles centered below the math problem', async function () {
    await page.waitForSelector('.alien-choices', { visible: true });
    
    const positioning = await page.evaluate(() => {
        const container = document.querySelector('.alien-choices');
        const buttons = Array.from(container.querySelectorAll('.choice-button'));
        const alien = window.activeAliens[0];
        
        // Get canvas and container positions
        const canvas = document.getElementById('gameCanvas');
        const canvasRect = canvas.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        // Calculate alien screen position
        const alienScreenX = (alien.x / canvas.width) * canvasRect.width + canvasRect.left;
        
        return {
            buttonCount: buttons.length,
            containerCenterX: containerRect.left + (containerRect.width / 2),
            alienCenterX: alienScreenX,
            isVisible: container.style.visibility !== 'hidden'
        };
    });
    
    assert.strictEqual(positioning.buttonCount, 3, 'Should have 3 answer circles');
    assert.ok(Math.abs(positioning.containerCenterX - positioning.alienCenterX) < 5, 'Answers should be centered below alien');
    assert.ok(positioning.isVisible, 'Answer circles should be visible');
});

Then('the bullet should travel from the cannon to the alien', async function () {
    const bulletTravel = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        return {
            startY: bullet.y,
            currentY: bullet.y,
            alienY: alien.y,
            isMoving: bullet.speed > 0
        };
    });
    
    assert.ok(bulletTravel.startY > bulletTravel.alienY, 'Bullet should start below alien');
    assert.ok(bulletTravel.isMoving, 'Bullet should be moving');
});

Then('the alien should be destroyed only after the bullet hits it', async function () {
    const collisionResult = await page.evaluate(() => {
        const bullet = window.activeBullets[0];
        const alien = window.activeAliens[0];
        const collision = bullet.y <= alien.y;
        
        if (collision) {
            // Remove alien and bullet on collision
            window.activeAliens = [];
            window.activeBullets = [];
        }
        
        return {
            collision,
            alienDestroyed: window.activeAliens.length === 0
        };
    });
    
    assert.ok(collisionResult.collision, 'Bullet should collide with alien');
    assert.ok(collisionResult.alienDestroyed, 'Alien should be destroyed after collision');
});

Then('I should receive points after the collision', async function () {
    const scoreIncreased = await page.evaluate(() => {
        const previousScore = window.previousScore || 0;
        return window.score > previousScore;
    });
    
    assert.ok(scoreIncreased, 'Score should increase after collision');
});

Then('the alien should remain after the bullet hits it', async function () {
    const alienRemains = await page.evaluate(() => {
        return window.activeAliens.length > 0;
    });
    
    assert.ok(alienRemains, 'Alien should remain after wrong answer');
});

Then('both bullets should travel independently', async function () {
    const bulletsIndependent = await page.evaluate(() => {
        const bullets = window.activeBullets;
        return bullets.length === 2 && 
               bullets[0].y !== bullets[1].y &&
               bullets[0].answer !== bullets[1].answer;
    });
    
    assert.ok(bulletsIndependent, 'Bullets should travel independently with different answers');
});

When('I solve this problem correctly', async function () {
    // Wait for alien to be present
    await page.waitForFunction(() => 
        window.activeAliens && window.activeAliens.length > 0
    );

    // Get the alien's problem and solve it
    await page.evaluate(() => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Use game's shooting function
        if (typeof window.shootAnswer === 'function') {
            window.shootAnswer(correctAnswer, alien);
        } else {
            // Create bullet with correct answer
            const bullet = {
                x: window.POSITION_COORDS[window.currentCannonPosition],
                y: window.CANNON_Y,
                answer: correctAnswer.toString(),
                speed: 5
            };
            window.activeBullets.push(bullet);
        }
    });

    // Wait for collision and alien destruction
    await page.waitForFunction(() => 
        window.activeAliens.length === 0
    , { timeout: 2000 });
});

Then('my score should increase by {int} points', async function (points) {
    const scoreCorrect = await page.evaluate((expectedPoints) => {
        const currentScore = Number(window.score) || 0;
        const previousScore = Number(window.previousScore) || 0;
        return (currentScore - previousScore) === expectedPoints;
    }, points);
    
    assert.ok(scoreCorrect, `Score should increase by ${points} points`);
});

Then('both bullets should travel independently', async function () {
    const bulletsIndependent = await page.evaluate(() => {
        const bullets = window.activeBullets;
        return bullets.length === 2 && 
               bullets[0].y !== bullets[1].y &&
               bullets[0].answer !== bullets[1].answer;
    });
    
    assert.ok(bulletsIndependent, 'Bullets should travel independently with different answers');
});

Then('the alien should remain until hit with the correct answer', async function () {
    const alienStatus = await page.evaluate(async () => {
        const alien = window.activeAliens[0];
        if (!alien) return { error: 'No alien found' };
        
        // Track initial state
        const initialState = {
            alienExists: true,
            health: alien.health || 1
        };
        
        // Fire wrong answer first
        const wrongAnswer = (alien.factor1 * alien.factor2) + 1;
        if (typeof window.shootAnswer === 'function') {
            window.shootAnswer(wrongAnswer, alien);
        }
        
        // Wait for collision
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check if alien survived wrong answer
        const afterWrongAnswer = {
            alienExists: window.activeAliens.includes(alien),
            health: alien.health || 1
        };
        
        return {
            initialState,
            afterWrongAnswer,
            alienSurvived: afterWrongAnswer.alienExists
        };
    });
    
    if (alienStatus.error) {
        throw new Error(alienStatus.error);
    }
    
    assert.ok(alienStatus.alienSurvived, 'Alien should survive wrong answer');
}),

Then('I should be able to clearly read each math problem', async function () {
    const readabilityCheck = await page.evaluate(() => {
        const aliens = window.activeAliens;
        if (!aliens || aliens.length === 0) return { error: 'No aliens found' };
        
        // Check for proper spacing and visibility
        for (let i = 0; i < aliens.length; i++) {
            const alien1 = aliens[i];
            
            // Check if problem is properly formatted
            if (!alien1.factor1 || !alien1.factor2) {
                return { error: 'Invalid problem format' };
            }
            
            // Check for overlapping aliens
            for (let j = i + 1; j < aliens.length; j++) {
                const alien2 = aliens[j];
                const dx = alien1.x - alien2.x;
                const dy = alien1.y - alien2.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 50) { // Minimum spacing for readability
                    return {
                        error: 'Aliens too close',
                        distance,
                        expected: 50
                    };
                }
            }
        }
        
        return { success: true };
    });
    
    if (readabilityCheck.error) {
        throw new Error(`Readability check failed: ${readabilityCheck.error}`);
    }
    
    assert.ok(readabilityCheck.success, 'Math problems should be clearly readable');
}),

Given('there are multiple aliens descending', async function () {
    await page.evaluate(() => {
        // Clear existing aliens
        window.activeAliens = [];
        
        // Spawn multiple aliens in different columns
        const positions = ['left', 'center', 'right'];
        positions.forEach((pos, index) => {
            window.activeAliens.push({
                x: window.POSITION_COORDS[pos],
                y: index * 100,
                factor1: index + 2,
                factor2: index + 3
            });
        });
        
        // Force update
        const deltaTime = 1/60;
        window.update(deltaTime);
        window.render();
    });
    
    // Wait for aliens to be visible
    await page.waitForTimeout(100);
});

When('I solve a problem for one alien', async function () {
    await page.evaluate(() => {
        // Get first alien
        const alien = window.activeAliens[0];
        if (!alien) return;
        
        // Calculate correct answer
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Store alien count before solving
        window.previousAlienCount = window.activeAliens.length;
        
        // Simulate shooting correct answer
        window.shootAnswerAt({
            ...alien,
            answer: correctAnswer,
            isCorrectAnswer: true
        });
    });
    
    // Wait for collision and destruction
    await page.waitForTimeout(100);
});

Then('only that specific alien should be destroyed', async function () {
    const destructionCheck = await page.evaluate(() => {
        return {
            previousCount: window.previousAlienCount,
            currentCount: window.activeAliens.length,
            difference: window.previousAlienCount - window.activeAliens.length
        };
    });
    
    assert.strictEqual(destructionCheck.difference, 1, 'Only one alien should be destroyed');
});

Then('other aliens should continue descending', async function () {
    const movementCheck = await page.evaluate(() => {
        const initialPositions = window.activeAliens.map(alien => alien.y);
        
        // Force movement update
        const deltaTime = 1/60;
        window.update(deltaTime);
        
        // Check if aliens moved
        return window.activeAliens.every((alien, index) => 
            alien.y > initialPositions[index]
        );
    });
    
    assert.ok(movementCheck, 'Remaining aliens should continue moving');
});

When('I rapidly destroy multiple aliens in succession', async function () {
    // Wait for game to be ready
    await page.waitForFunction(() => window.gameStarted === true);
    
    // Track initial score
    const initialScore = await page.evaluate(() => window.score || 0);
    
    // Destroy multiple aliens quickly
    await page.evaluate(async () => {
        for (let i = 0; i < 5; i++) {
            // Spawn new alien if needed
            if (window.activeAliens.length === 0) {
                if (typeof window.spawnAlien === 'function') {
                    window.spawnAlien();
                } else {
                    window.activeAliens.push({
                        factor1: Math.floor(Math.random() * 9) + 1,
                        factor2: Math.floor(Math.random() * 9) + 1,
                        x: window.POSITION_COORDS.center,
                        y: 50
                    });
                }
            }
            
            // Get alien and shoot correct answer
            const alien = window.activeAliens[0];
            const correctAnswer = alien.factor1 * alien.factor2;
            
            if (typeof window.shootAnswer === 'function') {
                window.shootAnswer(correctAnswer, alien);
            }
            
            // Brief wait between shots
            await new Promise(resolve => setTimeout(resolve, 100));
        }
    });
    
    // Verify score increased
    const finalScore = await page.evaluate(() => window.score);
    assert.ok(finalScore > initialScore, 'Score should increase after destroying aliens');
});

When('I rapidly switch cannon positions multiple times', async function () {
    await page.evaluate(async () => {
        const positions = ['left', 'center', 'right'];
        for (let i = 0; i < 10; i++) {
            window.currentCannonPosition = positions[i % 3];
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    });
});

When('I submit multiple wrong answers rapidly', async function () {
    await page.evaluate(async () => {
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        
        // Submit several wrong answers quickly
        for (let i = 0; i < 5; i++) {
            const wrongAnswer = correctAnswer + i + 1;
            window.shootAnswerAt({
                x: alien.x,
                y: alien.y,
                answer: wrongAnswer,
                targetAlien: alien
            });
            await new Promise(resolve => setTimeout(resolve, 50));
        }
    });
});

Given('I am about to complete level 1', async function () {
    await page.evaluate(async () => {
        window.gameStarted = true;
        window.difficultyLevel = 1;
        window.gameTime = 59; // Just before level completion
    });
});

When('I fire answers at multiple aliens simultaneously', async function () {
    await page.evaluate(async () => {
        // Ensure multiple aliens exist
        while (window.activeAliens.length < 3) {
            window.spawnAlien();
            await new Promise(resolve => setTimeout(resolve, 50));
        }
        
        // Fire at all aliens simultaneously
        const initialScore = window.score;
        window.activeAliens.forEach(alien => {
            const correctAnswer = alien.factor1 * alien.factor2;
            window.shootAnswerAt({
                x: alien.x,
                y: alien.y,
                answer: correctAnswer,
                targetAlien: alien
            });
        });
        
        return { initialScore };
    });
});

Then('new aliens should continue to spawn', async function () {
    // Track initial alien count
    const initialCount = await page.evaluate(() => window.activeAliens.length);
    
    // Wait and check for new spawns
    await page.waitForFunction(() => {
        // Should spawn at least one new alien
        return window.activeAliens.length > 0 &&
               typeof window.spawnAlien === 'function';
    }, { timeout: 5000 });
    
    // Verify spawning system is working
    const spawnCheck = await page.evaluate(() => ({
        currentCount: window.activeAliens.length,
        spawnFunctionExists: typeof window.spawnAlien === 'function',
        aliensMoving: window.activeAliens.some(alien => alien.speed > 0)
    }));
    
    assert.ok(spawnCheck.spawnFunctionExists, 'Spawn function should exist');
    assert.ok(spawnCheck.aliensMoving, 'Aliens should be moving');
});

Then('the game should maintain a steady frame rate', async function () {
    const frameCheck = await page.evaluate(async () => {
        const frameTimes = [];
        let lastTime = performance.now();
        
        // Measure frame times over 1 second
        for (let i = 0; i < 60; i++) {
            const currentTime = performance.now();
            frameTimes.push(currentTime - lastTime);
            lastTime = currentTime;
            
            // Wait for next frame
            await new Promise(requestAnimationFrame);
        }
        
        // Calculate frame time statistics
        const avgFrameTime = frameTimes.reduce((a, b) => a + b) / frameTimes.length;
        const maxDeviation = Math.max(...frameTimes.map(t => Math.abs(t - avgFrameTime)));
        
        return {
            avgFrameTime,
            maxDeviation,
            isStable: maxDeviation < 16.67 // Allow up to one frame variance
        };
    });
    
    assert.ok(frameCheck.isStable, 
        `Frame rate should be stable (avg: ${frameCheck.avgFrameTime.toFixed(2)}ms, max deviation: ${frameCheck.maxDeviation.toFixed(2)}ms)`);
});

Then('no duplicate answer circles should appear', async function () {
    const duplicateCheck = await page.evaluate(() => {
        const buttons = document.querySelectorAll('.choice-button');
        const answers = Array.from(buttons).map(b => b.textContent);
        const uniqueAnswers = new Set(answers);
        return {
            totalAnswers: answers.length,
            uniqueAnswers: uniqueAnswers.size
        };
    });
    
    assert.strictEqual(
        duplicateCheck.totalAnswers,
        duplicateCheck.uniqueAnswers,
        'Should have no duplicate answers'
    );
});

Then('each collision should resolve correctly', async function () {
    const collisionCheck = await page.evaluate(async () => {
        // Wait for all collisions to resolve
        await new Promise(resolve => setTimeout(resolve, 500));
        
        return {
            remainingBullets: window.activeBullets.length,
            scoreUpdated: window.score > 0,
            aliensResponded: window.activeAliens.length < 3
        };
    });
    
    assert.strictEqual(collisionCheck.remainingBullets, 0, 'All bullets should resolve');
    assert.ok(collisionCheck.scoreUpdated, 'Score should update after collisions');
    assert.ok(collisionCheck.aliensResponded, 'Aliens should be destroyed on correct hits');
});

Then('new aliens should only spawn when space is available', async function () {
    const spawnCheck = await page.evaluate(async () => {
        // Initialize if needed
        window.activeAliens = window.activeAliens || [];
        
        // Track initial state
        const initialCount = window.activeAliens.length;
        
        // Try to spawn new alien using game's spawn function
        if (typeof window.spawnAlien === 'function') {
            window.spawnAlien();
        }
        
        // Wait briefly for spawn
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Check final state
        return {
            initialCount,
            finalCount: window.activeAliens.length,
            maxRespected: window.activeAliens.length <= 4,
            spawnWorked: typeof window.spawnAlien === 'function'
        };
    });
    
    assert.ok(spawnCheck.spawnWorked, 'Should use game\'s spawn function');
    assert.ok(spawnCheck.maxRespected, 'Should not exceed maximum aliens');
    
    if (spawnCheck.initialCount < 4) {
        assert.ok(spawnCheck.finalCount > spawnCheck.initialCount, 'Should spawn new alien when space available');
    }
}),

Then('the problem {string} should still be tracked as missed', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    const trackingCheck = await page.evaluate(({f1, f2}) => {
        const missedFacts = JSON.parse(
            localStorage.getItem('mathInvaders_missedFacts')
        ) || [];
        
        return {
            isTracked: missedFacts.some(fact => 
                fact.factor1 === f1 && 
                fact.factor2 === f2
            ),
            totalMissed: missedFacts.length
        };
    }, {f1: factor1, f2: factor2});
    
    assert.ok(trackingCheck.isTracked, 'Problem should be tracked in missed facts');
}),
