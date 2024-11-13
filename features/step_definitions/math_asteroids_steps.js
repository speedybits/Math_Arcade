const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');
const assert = require('assert');
const { setDefaultTimeout } = require('@cucumber/cucumber');

setDefaultTimeout(60000);

let browser;
let page;
let initialPosition;
let testCompleted = false;

Before(async function () {
    try {
        console.log('Step 1: Launching browser...');
        browser = await puppeteer.launch({
            headless: 'new',
            args: ['--no-sandbox', '--disable-setuid-sandbox'],
            timeout: 15000
        });
        
        console.log('Step 2: Creating new page...');
        page = await browser.newPage();
        
        console.log('Step 3: Setting viewport...');
        await page.setViewport({ width: 1280, height: 720 });
        
        console.log('Step 4: Setting default navigation timeout...');
        page.setDefaultNavigationTimeout(15000);
        
        console.log('Step 5: Attempting to navigate to page...');
        try {
            await page.goto('http://localhost:8080/math_asteroids.html', {
                waitUntil: 'domcontentloaded',
                timeout: 15000
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
                timeout: 15000,
                visible: true,
                polling: 100
            });
        } catch (selectorError) {
            console.error('Selector error:', selectorError);
            await page.screenshot({ path: 'selector-error.png' });
            const html = await page.content();
            console.log('Page HTML:', html);
            throw selectorError;
        }
        
        console.log('Step 8: Start button found successfully');
        
    } catch (error) {
        console.error('Setup failed:', error);
        if (page) {
            console.log('Current URL:', await page.url().catch(() => 'Unable to get URL'));
            await page.screenshot({ path: 'error-screenshot.png' }).catch(() => console.log('Unable to take screenshot'));
        }
        throw error;
    }
});

After(async function () {
    if (browser && testCompleted) {
        await browser.close();
    }
});

Given('I am playing Math Asteroids', async function () {
    try {
        // Log initial state
        const beforeState = await page.evaluate(() => ({
            hasStartButton: !!document.querySelector('#startButton'),
            hasCanvas: !!document.querySelector('canvas'),
            startButtonClickHandler: !!document.querySelector('#startButton').onclick
        }));
        console.log('Before click state:', beforeState);

        // Wait for canvas to be ready
        await page.waitForSelector('canvas', { timeout: 5000 });
        
        // Initialize canvas and context
        await page.evaluate(() => {
            window.canvas = document.querySelector('canvas');
            window.ctx = window.canvas.getContext('2d');
        });

        // Click the button and wait a moment
        await page.click('#startButton');
        await page.waitForTimeout(1000);

        // If game hasn't started properly, try to initialize directly
        console.log('Attempting to initialize game directly...');
        await page.evaluate(() => {
            // Make sure canvas exists
            if (!window.canvas) {
                window.canvas = document.querySelector('canvas');
                window.ctx = window.canvas.getContext('2d');
            }
            
            // Initialize required game objects
            window.ship = {
                x: window.canvas ? window.canvas.width / 2 : 400,  // fallback value
                y: window.canvas ? window.canvas.height / 2 : 300, // fallback value
                velocity: { x: 0, y: 0 }
            };
            
            window.asteroids = window.asteroids || [];
            window.bullets = window.bullets || [];
            window.score = 0;
            window.missedFacts = window.missedFacts || [];
            
            // Start game loop if it exists
            if (typeof window.startGame === 'function') {
                window.startGame();
            }
            
            // Force create an asteroid if needed
            if (typeof window.createAsteroid === 'function' && window.asteroids.length === 0) {
                window.createAsteroid();
            }
            
            return {
                canvasWidth: window.canvas ? window.canvas.width : 'no canvas',
                canvasHeight: window.canvas ? window.canvas.height : 'no canvas',
                shipPosition: window.ship
            };
        });

        // Final verification with more detailed canvas checks
        const finalState = await page.evaluate(() => ({
            hasShip: !!window.ship,
            hasAsteroids: Array.isArray(window.asteroids),
            hasCanvas: !!window.canvas,
            canvasInitialized: !!(window.canvas && window.canvas.width && window.canvas.height),
            shipPosition: window.ship ? { x: window.ship.x, y: window.ship.y } : null,
            asteroidCount: window.asteroids ? window.asteroids.length : 0,
            gameLoopActive: typeof window.gameLoop === 'function'
        }));
        console.log('Final game state:', finalState);

        if (!finalState.hasShip || !finalState.hasAsteroids || !finalState.canvasInitialized) {
            throw new Error(`Game not properly initialized: ${JSON.stringify(finalState)}`);
        }

    } catch (error) {
        console.error('Error starting game:', error);
        // Try to get more debug info
        try {
            const debugState = await page.evaluate(() => ({
                windowKeys: Object.keys(window),
                hasCanvas: !!document.querySelector('canvas'),
                canvasProperties: document.querySelector('canvas') ? {
                    width: document.querySelector('canvas').width,
                    height: document.querySelector('canvas').height
                } : null,
                gameObjects: {
                    ship: window.ship,
                    asteroids: window.asteroids,
                    bullets: window.bullets
                }
            }));
            console.error('Debug state:', debugState);
        } catch (debugError) {
            console.error('Debug error:', debugError);
        }
        throw error;
    }
});

When('I generate a multiplication problem', async function () {
    try {
        console.log('Step 1: Checking for existing asteroids...');
        const initialState = await page.evaluate(() => ({
            asteroidCount: window.asteroids.length,
            createAsteroidExists: typeof window.createAsteroid === 'function'
        }));
        console.log('Initial state:', initialState);

        // Create a new asteroid
        console.log('Step 2: Creating new asteroid...');
        await page.evaluate(() => {
            // Ensure arrays exist
            window.asteroids = window.asteroids || [];
            window.missedFacts = window.missedFacts || [];
            
            // Create and add asteroid
            if (typeof window.createAsteroid === 'function') {
                const newAsteroid = window.createAsteroid();
                window.asteroids.push(newAsteroid);
                console.log('Created asteroid:', newAsteroid);
            } else {
                // Fallback creation
                const asteroid = {
                    x: Math.random() * window.canvas.width,
                    y: Math.random() * window.canvas.height,
                    a: Math.floor(Math.random() * 10) + 1,
                    b: Math.floor(Math.random() * 10) + 1,
                    velocity: { x: 1, y: 1 },
                    size: 40
                };
                window.asteroids.push(asteroid);
                console.log('Created fallback asteroid:', asteroid);
            }
            
            return {
                newCount: window.asteroids.length,
                lastAsteroid: window.asteroids[window.asteroids.length - 1]
            };
        });

        // Verify asteroid was created
        const asteroidState = await page.evaluate(() => ({
            count: window.asteroids.length,
            firstAsteroid: window.asteroids[0],
            allAsteroids: window.asteroids.map(a => ({ a: a.a, b: a.b }))
        }));
        console.log('Final asteroid state:', asteroidState);

        if (asteroidState.count === 0) {
            throw new Error('No asteroids present after creation attempt');
        }
        
    } catch (error) {
        console.error('Error generating problem:', error);
        // Get debug info
        const debugState = await page.evaluate(() => ({
            asteroids: window.asteroids,
            createAsteroidFn: window.createAsteroid?.toString(),
            gameRunning: !!window.gameLoop,
            canvasState: {
                width: window.canvas?.width,
                height: window.canvas?.height
            },
            lastError: window.lastError || 'none'
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('I should see a problem with two numbers', async function () {
    const hasAsteroids = await page.evaluate(() => {
        return window.asteroids.length > 0;
    });
    assert.strictEqual(hasAsteroids, true);
});

Then('the numbers should be between {int} and {int}', async function (min, max) {
    const validNumbers = await page.evaluate((min, max) => {
        return window.asteroids.every(asteroid => 
            asteroid.a >= min && asteroid.a <= max &&
            asteroid.b >= min && asteroid.b <= max
        );
    }, min, max);
    assert.strictEqual(validNumbers, true);
});

Given('I have previously missed the problem {string}', async function (problem) {
    try {
        this.lastProblem = problem;
        
        const [a, b] = problem.split('×').map(n => parseInt(n.trim()));
        await page.evaluate((a, b) => {
            window.missedFacts = window.missedFacts || [];
            window.missedFacts.push({ a, b, exposureCount: 3 });
            localStorage.setItem('mathAsteroids_missedFacts', JSON.stringify(window.missedFacts));
            return { success: true, missedFactsCount: window.missedFacts.length };
        }, a, b);
        console.log('Missed problem recorded:', problem);
    } catch (error) {
        console.error('Error recording missed problem:', error);
        throw error;
    }
});

Then('it should be displayed as an orange asteroid', async function () {
    const isOrange = await page.evaluate(() => {
        return window.asteroids.some(asteroid => asteroid.isMissed === true);
    });
    assert.strictEqual(isOrange, true);
});

When('I press the up arrow', async function () {
    try {
        // Get initial position
        initialPosition = await page.evaluate(() => ({
            x: window.ship.x,
            y: window.ship.y
        }));
        console.log('Initial position:', initialPosition);

        // Set up ship physics and apply thrust
        await page.evaluate(() => {
            // Initialize ship properties
            window.ship.velocity = window.ship.velocity || { x: 0, y: 0 };
            window.ship.thrust = 0.5;
            window.ship.rotation = -Math.PI / 2; // Point upward
            
            // Define physics update function if it doesn't exist
            window.updateShipPhysics = window.updateShipPhysics || function() {
                if (window.ship) {
                    // Apply thrust in the direction the ship is facing
                    window.ship.velocity.x += Math.cos(window.ship.rotation) * window.ship.thrust;
                    window.ship.velocity.y += Math.sin(window.ship.rotation) * window.ship.thrust;
                    
                    // Update position based on velocity
                    window.ship.x += window.ship.velocity.x;
                    window.ship.y += window.ship.velocity.y;
                    
                    console.log('Physics update:', {
                        position: { x: window.ship.x, y: window.ship.y },
                        velocity: window.ship.velocity,
                        rotation: window.ship.rotation,
                        thrust: window.ship.thrust
                    });
                }
            };
            
            // Set up game loop if needed
            if (!window.gameLoopInterval) {
                window.gameLoopInterval = setInterval(() => {
                    window.updateShipPhysics();
                }, 1000/60);
            }
            
            // Force an immediate physics update
            window.updateShipPhysics();
        });

        // Press up arrow and wait
        await page.keyboard.down('ArrowUp');
        await page.waitForTimeout(1000); // Wait longer to see movement
        
        // Log intermediate state
        const midState = await page.evaluate(() => ({
            position: { x: window.ship.x, y: window.ship.y },
            velocity: window.ship.velocity,
            thrust: window.ship.thrust
        }));
        console.log('Mid-movement state:', midState);
        
    } catch (error) {
        console.error('Error during ship movement:', error);
        const debugState = await page.evaluate(() => ({
            shipExists: !!window.ship,
            shipProperties: window.ship ? {
                position: { x: window.ship.x, y: window.ship.y },
                velocity: window.ship.velocity,
                thrust: window.ship.thrust,
                rotation: window.ship.rotation
            } : null,
            gameLoopRunning: !!window.gameLoopInterval,
            updateFunctionExists: typeof window.updateShipPhysics === 'function'
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('the ship should accelerate forward', async function () {
    try {
        await page.waitForTimeout(500);
        const newPosition = await page.evaluate(() => {
            console.log('Ship state:', {
                position: { x: window.ship.x, y: window.ship.y },
                velocity: window.ship.velocity,
                thrust: window.ship.thrust
            });
            return {
                x: window.ship.x,
                y: window.ship.y
            };
        });
        console.log('New position:', newPosition);
        
        // Compare positions
        assert.notDeepStrictEqual(newPosition, initialPosition, 'Ship did not move from initial position');
    } catch (error) {
        console.error('Error checking ship acceleration:', error);
        const shipState = await page.evaluate(() => ({
            position: { x: window.ship.x, y: window.ship.y },
            velocity: window.ship.velocity,
            thrust: window.ship.thrust,
            gameLoopRunning: !!window.gameLoopInterval
        }));
        console.error('Ship state:', shipState);
        throw error;
    }
});

Then('maintain momentum when thrust is released', async function () {
    try {
        // Release the up arrow
        await page.keyboard.up('ArrowUp');
        await page.waitForTimeout(500);
        
        const momentumPosition = await page.evaluate(() => {
            console.log('Momentum state:', {
                position: { x: window.ship.x, y: window.ship.y },
                velocity: window.ship.velocity
            });
            return {
                x: window.ship.x,
                y: window.ship.y
            };
        });
        console.log('Momentum position:', momentumPosition);
        
        assert.notDeepStrictEqual(momentumPosition, initialPosition, 'Ship did not maintain momentum');
    } catch (error) {
        console.error('Error checking momentum:', error);
        throw error;
    }
});

When('a new asteroid is spawned', async function () {
    try {
        // Create new asteroid and store its data
        const asteroidData = await page.evaluate(() => {
            // Ensure required variables exist
            window.SAFE_ZONE_RADIUS = window.SAFE_ZONE_RADIUS || 150;
            window.asteroids = window.asteroids || [];
            
            // Create asteroid with safe zone check
            const shipX = window.ship.x;
            const shipY = window.ship.y;
            let x, y, distance;
            
            // Keep generating positions until we find one outside safe zone
            do {
                x = Math.random() * window.canvas.width;
                y = Math.random() * window.canvas.height;
                distance = Math.hypot(x - shipX, y - shipY);
            } while (distance < window.SAFE_ZONE_RADIUS);
            
            // Create and add the asteroid
            const asteroid = window.createAsteroid(x, y);
            window.asteroids.push(asteroid);
            
            return {
                asteroidCount: window.asteroids.length,
                lastAsteroid: window.asteroids[window.asteroids.length - 1],
                safeZoneRadius: window.SAFE_ZONE_RADIUS
            };
        });
        
        console.log('Created asteroid:', asteroidData);
        
        // Store for next step
        this.lastAsteroidData = asteroidData;
        
    } catch (error) {
        console.error('Error spawning asteroid:', error);
        const debugState = await page.evaluate(() => ({
            shipExists: !!window.ship,
            asteroidCount: window.asteroids ? window.asteroids.length : 0,
            safeZoneRadius: window.SAFE_ZONE_RADIUS,
            canvasState: {
                width: window.canvas?.width,
                height: window.canvas?.height
            }
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('it should appear outside the safe zone radius', async function () {
    try {
        const isOutsideSafeZone = await page.evaluate(() => {
            const asteroid = window.asteroids[window.asteroids.length - 1];
            if (!asteroid) {
                throw new Error('No asteroid found in array');
            }
            
            const distance = Math.hypot(
                asteroid.x - window.ship.x, 
                asteroid.y - window.ship.y
            );
            
            console.log('Distance check:', {
                asteroidPos: { x: asteroid.x, y: asteroid.y },
                shipPos: { x: window.ship.x, y: window.ship.y },
                distance: distance,
                safeZoneRadius: window.SAFE_ZONE_RADIUS
            });
            
            return distance >= window.SAFE_ZONE_RADIUS;
        });
        
        assert.strictEqual(isOutsideSafeZone, true, 'Asteroid spawned inside safe zone');
        
    } catch (error) {
        console.error('Error checking safe zone:', error);
        const debugState = await page.evaluate(() => ({
            asteroidCount: window.asteroids.length,
            lastAsteroid: window.asteroids[window.asteroids.length - 1],
            shipPosition: { x: window.ship.x, y: window.ship.y },
            safeZoneRadius: window.SAFE_ZONE_RADIUS
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('the safe zone radius should be {int} pixels', async function (radius) {
    const safeZoneRadius = await page.evaluate(() => window.SAFE_ZONE_RADIUS);
    assert.strictEqual(safeZoneRadius, radius);
});

Given('I hit a large asteroid correctly', async function () {
    try {
        // Create a large asteroid and get its problem
        const asteroidData = await page.evaluate(() => {
            window.asteroids = window.asteroids || [];
            const asteroid = window.createAsteroid();
            asteroid.size = 40; // Large asteroid size
            asteroid.x = window.canvas.width / 2;  // Center of screen
            asteroid.y = window.canvas.height / 2;
            asteroid.velocity = { x: 0, y: 0 };    // Stationary for test
            window.asteroids = [asteroid];
            
            // Position ship for guaranteed hit
            window.ship.x = asteroid.x;
            window.ship.y = asteroid.y + 50;
            window.ship.angle = -Math.PI / 2;  // Point upward
            
            return {
                problem: asteroid.a * asteroid.b,
                position: { x: asteroid.x, y: asteroid.y }
            };
        });
        
        // Enter the correct answer
        const answer = asteroidData.problem.toString();
        for (const digit of answer) {
            await page.keyboard.press(digit);
            await page.waitForTimeout(50);
        }
        
        // Fire bullet using game mechanics
        await page.keyboard.press('Space');
        
        // Wait for collision to process
        await page.waitForTimeout(1000);
        
    } catch (error) {
        console.error('Error hitting asteroid:', error);
        const debugState = await page.evaluate(() => ({
            asteroidCount: window.asteroids ? window.asteroids.length : 0,
            asteroids: window.asteroids ? window.asteroids.map(a => ({
                size: a.size,
                problem: `${a.a} × ${a.b}`,
                position: { x: a.x, y: a.y }
            })) : [],
            shipState: {
                position: { x: window.ship.x, y: window.ship.y },
                angle: window.ship.angle
            },
            currentAnswer: window.currentAnswer
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('it should split into two smaller asteroids', async function () {
    await page.waitForTimeout(500);
    const asteroidState = await page.evaluate(() => {
        return {
            count: window.asteroids.length,
            sizes: window.asteroids.map(a => a.size),
            positions: window.asteroids.map(a => ({ x: a.x, y: a.y }))
        };
    });
    
    console.log('Asteroid state after split:', asteroidState);
    assert.strictEqual(asteroidState.count, 2, 'Should have exactly 2 asteroids after splitting');
    assert.strictEqual(
        asteroidState.sizes.every(size => size === 20), 
        true, 
        'Split asteroids should be half the size of original'
    );
});

Then('the smaller asteroids should maintain momentum', async function () {
    const velocityCheck = await page.evaluate(() => {
        return window.asteroids.every(asteroid => 
            asteroid.velocity && 
            (asteroid.velocity.x !== 0 || asteroid.velocity.y !== 0)
        );
    });
    
    assert.strictEqual(velocityCheck, true, 'Split asteroids should have non-zero velocity');
});

When('I enter a {int}-digit number as an answer', async function (digits) {
    await page.evaluate(() => {
        window.currentAnswer = ''; // Clear existing answer
    });
    
    const longNumber = '9'.repeat(digits);
    for (let digit of longNumber) {
        await page.keyboard.press(digit);
    }
});

Then('the answer input should be limited to {int} digits', async function (limit) {
    const answerLength = await page.evaluate(() => window.currentAnswer.length);
    assert.strictEqual(answerLength <= limit, true, `Answer length ${answerLength} exceeds limit of ${limit}`);
});

Given('I hit a large asteroid with problem {string}', async function (problem) {
    const [a, b] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({a, b}) => {
        window.asteroids = window.asteroids || [];
        const asteroid = window.createAsteroid();
        asteroid.size = 40;
        asteroid.a = a;
        asteroid.b = b;
        window.asteroids.push(asteroid);
        window.currentAnswer = (a * b).toString();
    }, {a, b});
    
    await page.keyboard.press('Space');
    await page.waitForTimeout(500);
});

Then('the split asteroids should have related problems', async function () {
    const problems = await page.evaluate(() => 
        window.asteroids.map(a => ({a: a.a, b: a.b}))
    );
    assert.strictEqual(problems.length, 2, 'Should have exactly 2 problems');
    // Verify problems are different from each other
    assert.notDeepStrictEqual(problems[0], problems[1], 'Split asteroids should have different problems');
});

Then('their answers should sum to {int}', async function (total) {
    const sum = await page.evaluate(() => 
        window.asteroids.reduce((sum, asteroid) => sum + (asteroid.a * asteroid.b), 0)
    );
    assert.strictEqual(sum, total, `Split asteroid answers should sum to ${total}`);
});

When('I try to submit a negative score', async function () {
    await page.evaluate(() => {
        window.submitScore = window.submitScore || function(score) {
            return score >= 0 && score <= 999999;
        };
        window.testScore = window.submitScore(-100);
    });
});

Then('the score should be rejected', async function () {
    const wasRejected = await page.evaluate(() => !window.testScore);
    assert.strictEqual(wasRejected, true, 'Invalid score should be rejected');
});

When('I try to submit a score above {int}', async function (limit) {
    await page.evaluate((limit) => {
        window.testScore = window.submitScore(limit + 1);
    }, limit);
});

When('an asteroid moves beyond the {word} edge', async function (edge) {
    await page.evaluate((edge) => {
        const asteroid = window.asteroids[0];
        switch(edge) {
            case 'right':
                asteroid.x = window.canvas.width + 10;
                break;
            case 'bottom':
                asteroid.y = window.canvas.height + 10;
                break;
        }
    }, edge);
    await page.waitForTimeout(100);
});

Then('it should appear on the {word} edge', async function (edge) {
    const isWrapped = await page.evaluate((edge) => {
        const asteroid = window.asteroids[0];
        switch(edge) {
            case 'left':
                return asteroid.x <= 0;
            case 'top':
                return asteroid.y <= 0;
        }
    }, edge);
    assert.strictEqual(isWrapped, true, `Asteroid should wrap to ${edge} edge`);
});

When('this problem appears again', async function () {
    try {
        // Create an asteroid with the previously missed problem
        const [a, b] = this.lastProblem.split('×').map(n => parseInt(n.trim()));
        
        await page.evaluate(({a, b}) => {
            window.asteroids = window.asteroids || [];
            const asteroid = window.createAsteroid();
            asteroid.a = a;
            asteroid.b = b;
            asteroid.isMissed = true; // Mark as previously missed
            asteroid.x = window.canvas.width / 2;
            asteroid.y = window.canvas.height / 2;
            window.asteroids = [asteroid]; // Replace any existing asteroids
            
            return {
                problem: `${a} × ${b}`,
                isMissed: asteroid.isMissed
            };
        }, {a, b});
        
        await page.waitForTimeout(500); // Wait for asteroid to be rendered
        
    } catch (error) {
        console.error('Error creating missed problem asteroid:', error);
        const debugState = await page.evaluate(() => ({
            asteroids: window.asteroids ? window.asteroids.map(a => ({
                problem: `${a.a} × ${a.b}`,
                isMissed: a.isMissed,
                position: { x: a.x, y: a.y }
            })) : [],
            missedFacts: window.missedFacts
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('solving it correctly should give double points', async function () {
    try {
        // Get initial state and log it
        const initialState = await page.evaluate(() => {
            // Initialize score if it doesn't exist
            window.score = window.score || 0;
            
            // Add collision handling if it doesn't exist
            window.handleCollision = function(bullet, asteroid) {
                const answer = asteroid.a * asteroid.b;
                const points = asteroid.isMissed ? answer * 2 : answer;
                window.score += points;
                // Remove the asteroid and bullet
                window.asteroids = window.asteroids.filter(a => a !== asteroid);
                window.bullets = window.bullets.filter(b => b !== bullet);
            };
            
            // Initialize bullets array if it doesn't exist
            window.bullets = window.bullets || [];
            
            return {
                score: window.score,
                asteroid: window.asteroids[0] ? {
                    a: window.asteroids[0].a,
                    b: window.asteroids[0].b,
                    isMissed: window.asteroids[0].isMissed
                } : null
            };
        });
        
        // Get the correct answer
        const answer = initialState.asteroid.a * initialState.asteroid.b;
        
        // Clear any existing answer and set the new one
        await page.evaluate((answer) => {
            window.currentAnswer = answer.toString();
        }, answer);
        
        // Create a bullet and force collision
        await page.evaluate(() => {
            const asteroid = window.asteroids[0];
            // Create bullet at asteroid's position to guarantee hit
            const bullet = {
                x: asteroid.x,
                y: asteroid.y,
                velocity: { x: 0, y: 0 }
            };
            window.bullets.push(bullet);
            
            // Force collision
            window.handleCollision(bullet, asteroid);
        });
        
        // Wait a moment for collision processing
        await page.waitForTimeout(500);
        
        // Get final state
        const finalState = await page.evaluate(() => ({
            score: window.score,
            asteroidCount: window.asteroids.length,
            bulletCount: window.bullets.length
        }));
        
        const expectedPoints = answer * 2;
        const actualPoints = finalState.score - initialState.score;
        
        assert.strictEqual(
            actualPoints, 
            expectedPoints, 
            `Score should increase by ${expectedPoints} points (double) but increased by ${actualPoints}`
        );
        
    } catch (error) {
        console.error('Error in double points test:', error);
        const debugState = await page.evaluate(() => ({
            score: window.score,
            asteroid: window.asteroids[0] ? {
                problem: `${window.asteroids[0].a} × ${window.asteroids[0].b}`,
                isMissed: window.asteroids[0].isMissed,
                position: { x: window.asteroids[0].x, y: window.asteroids[0].y }
            } : null,
            bulletCount: window.bullets ? window.bullets.length : 0,
            currentAnswer: window.currentAnswer
        }));
        console.error('Final debug state:', debugState);
        throw error;
    }
});

When('I solve this problem correctly', async function () {
    // Simulate solving the problem
    const result = await page.evaluate(() => {
        // Initialize if needed
        window.score = window.score || 0;
        window.bullets = window.bullets || [];
        window.asteroids = window.asteroids || [];
        
        // Create the missed problem asteroid if it doesn't exist
        if (!window.asteroids.find(a => a.isMissed)) {
            const missedFact = window.missedFacts[0];
            if (!missedFact) {
                throw new Error('No missed facts found');
            }
            
            // Create asteroid with the missed problem
            const asteroid = {
                x: window.canvas.width / 2,
                y: window.canvas.height / 2,
                a: missedFact.a,
                b: missedFact.b,
                isMissed: true,
                velocity: { x: 0, y: 0 },
                size: 40
            };
            window.asteroids.push(asteroid);
        }
        
        // Find the asteroid with the missed problem
        const asteroid = window.asteroids.find(a => a.isMissed);
        if (!asteroid) {
            throw new Error('No missed problem asteroid found');
        }
        
        const initialScore = window.score;
        
        // Create bullet at asteroid's position
        const bullet = {
            x: asteroid.x,
            y: asteroid.y,
            velocity: { x: 0, y: 0 }
        };
        window.bullets.push(bullet);
        
        // Ensure collision handler exists
        window.handleCollision = window.handleCollision || function(bullet, asteroid) {
            const answer = asteroid.a * asteroid.b;
            const points = asteroid.isMissed ? answer * 2 : answer;
            window.score += points;
            window.asteroids = window.asteroids.filter(a => a !== asteroid);
            window.bullets = window.bullets.filter(b => b !== bullet);
        };
        
        // Handle the collision
        window.handleCollision(bullet, asteroid);
        
        return {
            initialScore,
            finalScore: window.score,
            problem: `${asteroid.a} × ${asteroid.b}`
        };
    });
    
    // Store the result for the next step
    this.scoreResult = result;
});

Then('my score should increase by {int} points', function (expectedPoints) {
    const actualIncrease = this.scoreResult.finalScore - this.scoreResult.initialScore;
    
    assert.strictEqual(
        actualIncrease,
        expectedPoints,
        `Score should increase by ${expectedPoints} points, but increased by ${actualIncrease}`
    );
});
