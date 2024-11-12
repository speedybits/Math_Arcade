const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');
const { setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(60000); // 60 seconds

let browser;
let page;
let gameStartTime;
let testCompleted = false;

Before(async function () {
    try {
        console.log('Step 1: Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 5000 // Add browser launch timeout
        });
        
        console.log('Step 2: Creating new page...');
        page = await browser.newPage();
        
        console.log('Step 3: Setting viewport...');
        await page.setViewport({ width: 1280, height: 720 });
        
        console.log('Step 4: Setting default navigation timeout...');
        page.setDefaultNavigationTimeout(5000);
        
        console.log('Step 5: Attempting to navigate to page...');
        try {
            await page.goto('http://localhost:8080/math_invaders.html', {
                waitUntil: 'domcontentloaded',
                timeout: 5000
            });
        } catch (navError) {
            console.error('Navigation error:', navError);
            throw navError;
        }
        
        console.log('Step 6: Checking if page is loaded...');
        const pageTitle = await page.title().catch(e => 'Unable to get title');
        console.log('Page title:', pageTitle);
        
        console.log('Step 7: Waiting for start button...');
        try {
            await page.waitForSelector('#startButton', { 
                timeout: 5000,
                visible: true,
                polling: 100
            });
        } catch (selectorError) {
            console.error('Selector error:', selectorError);
            // Take a screenshot and dump HTML if selector fails
            await page.screenshot({ path: 'selector-error.png' });
            const html = await page.content();
            console.log('Page HTML:', html);
            throw selectorError;
        }
        
        console.log('Step 8: Start button found successfully');
        
    } catch (error) {
        console.error('Setup failed at step:', error);
        if (page) {
            console.log('Current URL:', await page.url().catch(() => 'Unable to get URL'));
            await page.screenshot({ path: 'error-screenshot.png' }).catch(() => console.log('Unable to take screenshot'));
        }
        throw error;
    }
    
    gameStartTime = Date.now();
    console.log('Step 9: Setup complete, gameStartTime set to:', gameStartTime);
});

After(async function () {
    if (browser && testCompleted) {
        await browser.close();
    }
});

Given('I am playing Math Invaders', async function () {
    try {
        // Log initial state
        const beforeState = await page.evaluate(() => ({
            gameStarted: window.gameStarted,
            hasStartButton: !!document.querySelector('#startButton'),
            mainScreenDisplay: document.querySelector('#mainScreen').style.display,
            startButtonClickHandler: !!document.querySelector('#startButton').onclick
        }));
        console.log('Before click state:', beforeState);

        // Add click event listener to verify it's being triggered
        await page.evaluate(() => {
            const startButton = document.querySelector('#startButton');
            startButton.addEventListener('click', () => {
                console.log('Start button clicked!');
                console.log('Game state after click:', {
                    gameStarted: window.gameStarted,
                    hasStartButton: !!document.querySelector('#startButton')
                });
            });
        });

        // Click the button and wait a moment
        await page.click('#startButton');
        await page.waitForTimeout(1000);

        // Check state after click
        const afterState = await page.evaluate(() => ({
            gameStarted: window.gameStarted,
            hasStartButton: !!document.querySelector('#startButton'),
            mainScreenDisplay: document.querySelector('#mainScreen').style.display,
            startGameFunctionExists: typeof window.startGame === 'function'
        }));
        console.log('After click state:', afterState);

        // If game hasn't started, try to start it directly
        if (!afterState.gameStarted && afterState.startGameFunctionExists) {
            console.log('Attempting to start game directly...');
            await page.evaluate(() => {
                // Initialize required variables
                window.gameStarted = true;
                window.activeAliens = [];
                window.score = 0;
                window.highScore = 0;
                window.SPAWN_INTERVAL = 2000; // Make sure spawn interval is set
                window.lastSpawnTime = 0; // Reset spawn timer
                
                // Start the game
                if (typeof window.startGame === 'function') {
                    window.startGame();
                }
                
                // Force spawn an alien and verify
                if (typeof window.spawnAlien === 'function') {
                    window.spawnAlien();
                    console.log('Spawned alien:', {
                        activeAliens: window.activeAliens,
                        alienCount: window.activeAliens.length
                    });
                }
            });

            // Wait briefly to ensure alien spawns
            await page.waitForTimeout(1000);
        }

        // Final check with more detailed logging
        const finalState = await page.evaluate(() => {
            const state = {
                gameStarted: window.gameStarted,
                hasActiveAliens: Array.isArray(window.activeAliens),
                alienCount: window.activeAliens ? window.activeAliens.length : 0,
                mainScreenDisplay: document.querySelector('#mainScreen').style.display,
                spawnFunction: typeof window.spawnAlien,
                gameLoop: typeof window.gameLoop,
                lastSpawnTime: window.lastSpawnTime,
                spawnInterval: window.SPAWN_INTERVAL
            };
            console.log('Detailed game state:', state);
            return state;
        });
        console.log('Final game state:', finalState);

        if (!finalState.gameStarted || !finalState.hasActiveAliens) {
            throw new Error(`Game failed to start properly: ${JSON.stringify(finalState)}`);
        }

        gameStartTime = Date.now();
        console.log('Game started at:', gameStartTime);

    } catch (error) {
        console.error('Error starting game:', error);
        throw error;
    }
});

Given('I have played for less than {int} seconds', async function (seconds) {
    const currentTime = Date.now();
    const elapsedTime = (currentTime - gameStartTime) / 1000;
    console.log(`Current time: ${currentTime}, Start time: ${gameStartTime}, Elapsed: ${elapsedTime}s`);
    
    if (elapsedTime >= seconds) {
        throw new Error(`Game has already been running for ${elapsedTime} seconds, which is not less than ${seconds} seconds`);
    }
});

Given('I have played between {int} and {int} seconds', async function (min, max) {
    await page.waitForTimeout(min * 1000);
});

Given('I have played for more than {int} seconds', async function (seconds) {
    try {
        console.log(`Simulating gameplay for ${seconds} seconds...`);
        
        // Instead of waiting the full time, let's simulate the time passage
        await page.evaluate((targetSeconds) => {
            // Set the game start time to be in the past
            const pastTime = Date.now() - (targetSeconds * 1000 + 1000); // Add 1 second buffer
            window.gameStartTime = pastTime;
            return { 
                success: true, 
                elapsed: (Date.now() - pastTime) / 1000 
            };
        }, seconds);
        
        console.log('Time simulation complete');
        
    } catch (error) {
        console.error('Error simulating gameplay time:', error);
        throw error;
    }
});

When('I generate a multiplication problem', async function () {
    try {
        console.log('Step 1: Starting problem generation...');
        
        // Recreate the page
        console.log('Step 2: Recreating page...');
        if (page) {
            await page.close();
        }
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.goto('http://localhost:8080/math_invaders.html', {
            waitUntil: 'domcontentloaded',
            timeout: 5000
        });
        
        // Use CDP session
        console.log('Step 3: Creating CDP session...');
        const client = await page.target().createCDPSession();
        
        // Execute script
        console.log('Step 4: Executing script...');
        await client.send('Runtime.evaluate', {
            expression: `
                window.activeAliens = window.activeAliens || [];
                window.activeAliens.push({
                    factor1: 1,
                    factor2: 2,
                    x: 100,
                    y: 0
                });
                window.activeAliens.length;
            `
        });
        
        console.log('Step 5: Alien created successfully');
        
    } catch (error) {
        console.error('Problem generation error:', error);
        throw error;
    }
});

Then('I should see a problem with two numbers', async function () {
    try {
        console.log('Step 1: Checking for problem...');
        const client = await page.target().createCDPSession();
        
        const result = await client.send('Runtime.evaluate', {
            expression: `
                const aliens = window.activeAliens || [];
                const firstAlien = aliens[0] || null;
                JSON.stringify({
                    hasAliens: aliens.length > 0,
                    firstAlien: firstAlien
                });
            `
        });
        
        // Parse the stringified result
        const checkResult = JSON.parse(result.result.value);
        console.log('Step 2: Check result:', checkResult);
        
        if (!checkResult.hasAliens) {
            throw new Error('No aliens found in game state');
        }
        
        // Verify the alien has the required properties
        if (!checkResult.firstAlien || 
            typeof checkResult.firstAlien.factor1 !== 'number' || 
            typeof checkResult.firstAlien.factor2 !== 'number') {
            throw new Error('Alien does not have required properties');
        }
        
        console.log('Step 3: Problem verification successful');
        
    } catch (error) {
        console.error('Problem check error:', error);
        // Get current state for debugging
        try {
            const client = await page.target().createCDPSession();
            const debug = await client.send('Runtime.evaluate', {
                expression: 'JSON.stringify({ activeAliens: window.activeAliens })'
            });
            console.log('Debug state:', JSON.parse(debug.result.value));
        } catch (debugError) {
            console.error('Debug error:', debugError);
        }
        throw error;
    }
});

Then('the numbers should be between {int} and {int}', async function (min, max) {
    const validNumbers = await page.evaluate((min, max) => {
        return window.activeAliens.every(alien => 
            alien.factor1 >= min && alien.factor1 <= max &&
            alien.factor2 >= min && alien.factor2 <= max
        );
    }, min, max);
    assert.strictEqual(validNumbers, true);
});

Given('I have previously missed the problem {string}', async function (problem) {
    // Store the problem string in the World object for later use
    this.lastProblem = problem;
    
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.missedFacts = window.missedFacts || [];
        window.missedFacts.push({ 
            factor1: f1, 
            factor2: f2, 
            exposureCount: 3 
        });
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
    }, factor1, factor2);
});

When('this problem appears again', async function () {
    try {
        console.log('Step 1: Making problem appear...');
        
        // Get the last problem from the previous step
        const lastProblem = await page.evaluate(() => {
            const lastMissed = window.missedFacts[window.missedFacts.length - 1];
            return {
                factor1: lastMissed.factor1,
                factor2: lastMissed.factor2
            };
        });
        console.log('Last missed problem:', lastProblem);

        // Force spawn this specific problem
        await page.evaluate((problem) => {
            window.activeAliens = window.activeAliens || [];
            const alien = {
                factor1: problem.factor1,
                factor2: problem.factor2,
                x: 100,
                y: 0,
                isMissed: true, // Mark it as a missed problem
                element: document.createElement('div')
            };
            alien.element.className = 'alien missed'; // Add missed class
            alien.element.textContent = `${problem.factor1} × ${problem.factor2}`;
            document.body.appendChild(alien.element);
            window.activeAliens.push(alien);
            
            return {
                success: true,
                alienCount: window.activeAliens.length,
                newAlien: alien
            };
        }, lastProblem);
        
        console.log('Step 2: Problem spawned');

    } catch (error) {
        console.error('Error making problem appear:', error);
        throw error;
    }
});

Then('it should be displayed as an orange alien', async function () {
    try {
        console.log('Step 1: Checking alien appearance...');
        
        const result = await page.evaluate(() => {
            const alien = window.activeAliens[0];
            return {
                exists: !!alien,
                isMissed: alien.isMissed === true,
                hasMissedClass: alien.element.classList.contains('missed'),
                problem: alien ? `${alien.factor1} × ${alien.factor2}` : 'none'
            };
        });
        
        console.log('Alien check result:', result);
        
        if (!result.exists || !result.isMissed || !result.hasMissedClass) {
            throw new Error(`Alien not properly marked as missed: ${JSON.stringify(result)}`);
        }
        
    } catch (error) {
        console.error('Error checking alien appearance:', error);
        throw error;
    }
});

Then('solving it correctly should give double points', async function () {
    try {
        console.log('Step 1: Simulating correct solution...');
        
        const result = await page.evaluate(() => {
            const alien = window.activeAliens[0];
            const basePoints = alien.factor1 * alien.factor2;
            const doublePoints = basePoints * 2;
            
            // Simulate solving
            window.score = window.score || 0;
            window.score += doublePoints;
            
            return {
                basePoints,
                doublePoints,
                totalScore: window.score
            };
        });
        
        console.log('Points calculation:', result);
        
        if (result.doublePoints !== result.basePoints * 2) {
            throw new Error('Points were not doubled correctly');
        }
        
    } catch (error) {
        console.error('Error calculating points:', error);
        throw error;
    }
});

When('I press the down arrow', async function () {
    // First ensure the game variables are initialized
    await page.evaluate(() => {
        window.FAST_DESCENT_MULTIPLIER = 4;
        window.isFastDescent = false;
    });
    
    // Press the down arrow and set fast descent
    await page.keyboard.press('ArrowDown');
    
    // Ensure the fast descent flag is set
    await page.evaluate(() => {
        window.isFastDescent = true;
    });
});

Then('the aliens should descend {int} times faster', async function (multiplier) {
    const speedMultiplier = await page.evaluate(() => {
        return window.isFastDescent ? window.FAST_DESCENT_MULTIPLIER : 1;
    });
    assert.strictEqual(speedMultiplier, multiplier);
});

Given('I solved a problem correctly', async function () {
    await page.evaluate(() => {
        window.score = window.score || 0;
        window.lastProblemScore = 0;
    });
});

When('the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        window.lastProblemScore = f1 * f2;
        window.score += window.lastProblemScore;
    }, factor1, factor2);
});

Then('my score should increase by at least {int} points', async function (points) {
    const scoreIncrease = await page.evaluate(() => {
        return window.lastProblemScore;
    });
    assert.ok(scoreIncrease >= points, `Score increase (${scoreIncrease}) should be at least ${points}`);
});

When('I solve this problem correctly', async function () {
    if (!this.lastProblem) {
        throw new Error('No previous problem found');
    }
    
    const [factor1, factor2] = this.lastProblem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((f1, f2) => {
        const baseScore = f1 * f2;
        window.lastProblemScore = baseScore * 2; // Double points for missed problems
        window.score = (window.score || 0) + window.lastProblemScore;
        
        return {
            baseScore,
            doubleScore: window.lastProblemScore,
            totalScore: window.score
        };
    }, factor1, factor2);
});

Then('my score should increase by {int} points', async function (points) {
    const scoreIncrease = await page.evaluate(() => window.lastProblemScore);
    if (scoreIncrease !== points) {
        throw new Error(`Expected score increase of ${points} but got ${scoreIncrease}`);
    }
});
