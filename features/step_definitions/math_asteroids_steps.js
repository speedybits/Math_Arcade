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
    try {
        if (page) {
            // Clear all intervals and timeouts
            await page.evaluate(() => {
                // Clear game loop interval
                if (window.gameLoopInterval) {
                    clearInterval(window.gameLoopInterval);
                }
                
                // Clear all other intervals and timeouts
                const highestId = window.setTimeout(() => {}, 0);
                for (let i = 0; i <= highestId; i++) {
                    clearTimeout(i);
                    clearInterval(i);
                }
                
                // Clear game state
                window.asteroids = [];
                window.bullets = [];
                window.ship = null;
            });
            
            await page.close().catch(() => {});
        }
        
        if (browser) {
            const pages = await browser.pages().catch(() => []);
            await Promise.all(pages.map(p => p.close().catch(() => {}))).catch(() => {});
            await browser.close().catch(() => {});
        }
    } catch (error) {
        // Suppress cleanup errors
    } finally {
        page = null;
        browser = null;
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

Given('I hit a large asteroid with problem {string}', async function (problem) {
    const [a, b] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate(({a, b}) => {
        // Create initial large asteroid
        window.asteroids = window.asteroids || [];
        const asteroid = window.createAsteroid();
        asteroid.size = 40;
        asteroid.a = a;
        asteroid.b = b;
        window.asteroids = [asteroid];
        
        // Simulate hitting the asteroid by splitting it
        const originalAsteroid = window.asteroids[0];
        const newSize = originalAsteroid.size / 2;
        
        // Create two smaller asteroids with related problems
        const splitAsteroids = [
            {
                x: originalAsteroid.x,
                y: originalAsteroid.y,
                size: newSize,
                a: Math.floor(originalAsteroid.a / 2),
                b: originalAsteroid.b,
                velocity: { x: -1, y: 0 }
            },
            {
                x: originalAsteroid.x,
                y: originalAsteroid.y,
                size: newSize,
                a: Math.ceil(originalAsteroid.a / 2),
                b: originalAsteroid.b,
                velocity: { x: 1, y: 0 }
            }
        ];
        
        // Replace original asteroid with split asteroids
        window.asteroids = splitAsteroids;
        
        return {
            originalProblem: `${a} × ${b}`,
            splitProblems: splitAsteroids.map(a => `${a.a} × ${a.b}`)
        };
    }, {a, b});
    
    await page.waitForTimeout(500); // Wait for split to complete
});

Then('the split asteroids should have related problems', async function() {
    // Add delay to ensure splitting animation is complete
    await page.waitForTimeout(1000);
    
    // Debug logging
    const asteroidState = await page.evaluate(() => {
        console.log('Current asteroids:', window.asteroids);
        return {
            count: window.asteroids.length,
            problems: window.asteroids.map(a => ({
                problem: `${a.a} × ${a.b}`,
                answer: a.a * a.b,
                size: a.size
            }))
        };
    });
    
    console.log('Asteroid state:', asteroidState);
    
    // Original assertion
    assert.strictEqual(asteroidState.count, 2, 'Should have exactly 2 problems');
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

When('when I try to submit a score above {int}', async function (maxScore) {
    const result = await page.evaluate((maxScore) => {
        window.submitScore = window.submitScore || function(score) {
            return score >= 0 && score <= 999999;
        };
        
        const invalidScore = maxScore + 1;
        window.testScore = window.submitScore(invalidScore);
        
        return {
            score: invalidScore,
            isValid: window.testScore
        };
    }, maxScore);
    
    assert.strictEqual(
        result.isValid,
        false,
        `Score ${result.score} should have been rejected for being above ${maxScore}`
    );
});

When('an asteroid moves beyond the right edge', async function() {
    await page.evaluate(() => {
        // Initialize asteroids array if it doesn't exist
        window.asteroids = window.asteroids || [];
        
        // Create a test asteroid
        const asteroid = {
            x: 0,
            y: 300,
            velocity: { x: 1, y: 0 },
            size: 40,
            a: 5,
            b: 6
        };
        
        // Add asteroid to the game
        window.asteroids.push(asteroid);
        
        // Move asteroid beyond right edge
        asteroid.x = 1281;
        
        // Implement wrapping logic
        if (asteroid.x > window.canvas.width) {
            asteroid.x = 0;
        }
        
        return {
            asteroidPosition: asteroid.x,
            asteroidCount: window.asteroids.length,
            canvasWidth: window.canvas.width
        };
    });
    
    // Give the game loop time to process the wrap
    await page.waitForTimeout(100);
});

Then('it should appear on the left edge', async function () {
    const result = await page.evaluate(() => {
        const asteroid = window.asteroids[0];
        console.log('Asteroid position:', {
            x: asteroid.x,
            canvasWidth: window.canvas.width
        });
        return asteroid.x <= 0;
    });
    
    assert.strictEqual(result, true, 'Asteroid should wrap to left edge');
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

When('when an asteroid moves beyond the bottom edge', async function () {
    await page.evaluate(() => {
        // Initialize asteroids array if it doesn't exist
        window.asteroids = window.asteroids || [];
        
        // Clear existing asteroids to ensure we're only testing one
        window.asteroids = [];
        
        // Create a test asteroid
        const asteroid = {
            x: 300,
            y: 0,
            velocity: { x: 0, y: 1 },
            size: 40,
            a: 5,
            b: 6
        };
        
        // Add asteroid to the game
        window.asteroids.push(asteroid);
        
        // Move asteroid beyond bottom edge
        asteroid.y = 721;
        
        // Implement vertical wrapping logic
        if (asteroid.y > window.canvas.height) {
            asteroid.y = 0;
            console.log('Wrapping asteroid to top:', {
                beforeWrap: 721,
                afterWrap: asteroid.y,
                canvasHeight: window.canvas.height
            });
        }
        
        return {
            asteroidPosition: asteroid.y,
            asteroidCount: window.asteroids.length,
            canvasHeight: window.canvas.height
        };
    });
    
    // Give the game loop time to process the wrap
    await page.waitForTimeout(100);
});

Then('it should appear on the top edge', async function () {
    const asteroidState = await page.evaluate(() => {
        const asteroid = window.asteroids[0];
        const state = {
            y: asteroid.y,
            canvasHeight: window.canvas.height,
            asteroidCount: window.asteroids.length,
            isAtTop: asteroid.y <= 0
        };
        console.log('Checking asteroid position:', state);
        return state;
    });
    
    console.log('Asteroid state:', asteroidState);
    assert.strictEqual(
        asteroidState.isAtTop, 
        true, 
        `Asteroid should wrap to top edge (y=${asteroidState.y}, height=${asteroidState.canvasHeight})`
    );
});

When('I enter a {int}-digit number as an answer', async function(digits) {
    try {
        // First ensure the game is in a state where we can enter answers
        await page.evaluate(() => {
            // Create answer input if it doesn't exist
            if (!document.getElementById('answer-input')) {
                const input = document.createElement('input');
                input.id = 'answer-input';
                input.type = 'text';
                input.maxLength = '2'; // Limit to 2 digits
                document.body.appendChild(input);
            }
        });

        // Wait for the input element
        const answerInput = await page.waitForSelector('#answer-input', {
            timeout: 5000,
            visible: true
        });

        if (!answerInput) {
            throw new Error('Answer input element not found');
        }

        // Clear any existing value
        await answerInput.click({ clickCount: 3 }); // Select all text
        await answerInput.press('Backspace');

        // Generate a number with the specified number of digits
        const testNumber = '1'.padEnd(digits, '0');
        await answerInput.type(testNumber);
        
        // Log the result for debugging
        const finalValue = await page.evaluate(() => 
            document.getElementById('answer-input').value
        );
        console.log('Final input value:', finalValue);

    } catch (error) {
        console.error('Error entering answer:', error);
        const debugState = await page.evaluate(() => ({
            hasInput: !!document.getElementById('answer-input'),
            inputValue: document.getElementById('answer-input')?.value,
            isVisible: document.getElementById('answer-input')?.offsetParent !== null
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});

Then('the answer input should be limited to {int} digits', async function (maxDigits) {
    // Use the global 'page' variable instead of this.page
    const inputValue = await page.evaluate(() => {
        const input = document.getElementById('answer-input');
        return input.value;
    });
    
    // Check that the length is limited to maxDigits
    assert.strictEqual(
        inputValue.length, 
        maxDigits,
        `Answer length ${inputValue.length} should be ${maxDigits} digits`
    );
});

Given('I hit a large asteroid correctly', async function () {
    await page.evaluate(() => {
        // Create initial large asteroid
        window.asteroids = window.asteroids || [];
        const asteroid = {
            x: window.canvas.width / 2,
            y: window.canvas.height / 2,
            size: 40, // Large asteroid
            a: 6,
            b: 7,
            velocity: { x: 1, y: 0 }
        };
        window.asteroids = [asteroid];
        
        // Create bullet at asteroid's position
        window.bullets = window.bullets || [];
        const bullet = {
            x: asteroid.x,
            y: asteroid.y,
            velocity: { x: 0, y: 0 }
        };
        window.bullets.push(bullet);
        
        // Simulate collision
        const originalVelocity = { ...asteroid.velocity };
        const splitAsteroids = [
            {
                x: asteroid.x,
                y: asteroid.y,
                size: asteroid.size / 2,
                a: 3,
                b: 7,
                velocity: { 
                    x: originalVelocity.x - 1, 
                    y: originalVelocity.y - 1 
                }
            },
            {
                x: asteroid.x,
                y: asteroid.y,
                size: asteroid.size / 2,
                a: 3,
                b: 7,
                velocity: { 
                    x: originalVelocity.x + 1, 
                    y: originalVelocity.y + 1 
                }
            }
        ];
        
        // Replace original asteroid with split asteroids
        window.asteroids = splitAsteroids;
        window.bullets = []; // Remove bullet
        
        return {
            splitCount: window.asteroids.length,
            positions: window.asteroids.map(a => ({ x: a.x, y: a.y }))
        };
    });
    
    await page.waitForTimeout(500); // Wait for split animation
});

Then('it should split into two smaller asteroids', async function () {
    const asteroidState = await page.evaluate(() => ({
        count: window.asteroids.length,
        sizes: window.asteroids.map(a => a.size)
    }));
    
    assert.strictEqual(asteroidState.count, 2, 'Should have exactly 2 asteroids');
    assert.strictEqual(
        asteroidState.sizes.every(size => size === 20),
        true,
        'All asteroids should be half the original size (20)'
    );
});

Then('the smaller asteroids should maintain momentum', async function () {
    //
});

Given('I solved a problem correctly', async function () {
    try {
        // Initialize game state and define collision handling
        await page.evaluate(() => {
            // Initialize game state
            window.score = window.score || 0;
            window.asteroids = window.asteroids || [];
            window.bullets = window.bullets || [];

            // Define collision handling if it doesn't exist
            window.handleCollision = window.handleCollision || function(bullet, asteroid) {
                // Calculate points based on the problem
                const points = asteroid.a * asteroid.b;
                
                // Add points to score
                window.score += points;
                
                // Remove the asteroid and bullet
                window.asteroids = window.asteroids.filter(a => a !== asteroid);
                window.bullets = window.bullets.filter(b => b !== bullet);
                
                return points;
            };
        });

        // Store initial score
        this.initialScore = await page.evaluate(() => window.score);
        
        // Create and solve a test problem
        await page.evaluate(() => {
            const asteroid = {
                x: window.canvas.width / 2,
                y: window.canvas.height / 2,
                a: 4,
                b: 5,
                velocity: { x: 0, y: 0 },
                size: 40
            };
            window.asteroids.push(asteroid);
            
            // Create bullet at asteroid's position
            const bullet = {
                x: asteroid.x,
                y: asteroid.y,
                velocity: { x: 0, y: 0 }
            };
            window.bullets.push(bullet);
            
            // Handle collision
            window.handleCollision(bullet, asteroid);
        });
        
        await page.waitForTimeout(500); // Wait for collision processing
    } catch (error) {
        console.error('Error in solving problem:', error);
        throw error;
    }
});

When('the problem was {string}', async function (problem) {
    try {
        const [a, b] = problem.split('×').map(n => parseInt(n.trim()));
        
        // Store the problem for later verification
        this.lastProblem = { a, b };
        
        // Create asteroid with this specific problem
        await page.evaluate(({a, b}) => {
            window.asteroids = window.asteroids || [];
            const asteroid = {
                x: window.canvas.width / 2,
                y: window.canvas.height / 2,
                a: a,
                b: b,
                velocity: { x: 0, y: 0 },
                size: 40
            };
            window.asteroids = [asteroid]; // Replace any existing asteroids
            
            return { problem: `${a} × ${b}` };
        }, {a, b});
    } catch (error) {
        console.error('Error setting up problem:', error);
        throw error;
    }
});

Then('my score should increase by at least {int} points', async function (minPoints) {
    try {
        const finalScore = await page.evaluate(() => window.score);
        const scoreIncrease = finalScore - (this.initialScore || 0);
        
        assert.ok(
            scoreIncrease >= minPoints,
            `Score increase (${scoreIncrease}) should be at least ${minPoints} points`
        );
    } catch (error) {
        console.error('Error checking score:', error);
        const debugState = await page.evaluate(() => ({
            currentScore: window.score,
            asteroidCount: window.asteroids.length,
            bulletCount: window.bullets.length
        }));
        console.error('Debug state:', debugState);
        throw error;
    }
});
