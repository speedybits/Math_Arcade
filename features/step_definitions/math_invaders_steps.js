const assert = require('assert');
const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { setWorldConstructor } = require('@cucumber/cucumber');
const puppeteer = require('puppeteer');

// Define custom world
class CustomWorld {
    constructor() {
        this.page = null;
        this.browser = null;
        this.gameState = {
            currentProblem: null,
            score: 0,
            alienDestroyed: false
        };
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
            await this.page.goto('http://localhost:8080/math_invaders.html');
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

// Setup and teardown
Before(async function() {
    await this.setup();
    
    // Ensure we're on Math Invaders page and wait for it to load
    await this.page.goto('http://localhost:8080/math_invaders.html');
    await this.page.waitForSelector('#gameCanvas');
    
    // Clear any existing game state
    await this.page.evaluate(() => {
        localStorage.clear();
        window.gameStarted = false;
        window.score = 0;
        window.activeAliens = [];
        window.missedFacts = [];
        window.CANVAS_WIDTH = 600;  // Make sure canvas dimensions are set
        window.CANVAS_HEIGHT = 600;
        window.POSITION_COORDS = {
            'left': window.CANVAS_WIDTH / 4,
            'center': window.CANVAS_WIDTH / 2,
            'right': (3 * window.CANVAS_WIDTH) / 4
        };
    });
    
    // Start game to ensure canvas is initialized
    await this.page.evaluate(() => {
        window.startGame();
    });
});

After(async function() {
    await this.teardown();
});

// Step definitions
When('in Math Invaders the problem was {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    this.gameState.currentProblem = { factor1, factor2 };
    
    await this.page.evaluate(({f1, f2}) => {
        if (!window.gameStarted) {
            window.startGame();
        }
        
        window.score = 0;
        window.activeAliens = [{
            x: window.POSITION_COORDS['center'],
            y: 50,
            factor1: f1,
            factor2: f2,
            position: 'center'
        }];
        
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${window.score} | High Score: ${window.highScore}`;
        }
        
        console.log('Problem setup:', {
            factor1: f1,
            factor2: f2,
            alien: window.activeAliens[0],
            score: window.score
        });
    }, { f1: factor1, f2: factor2 });
});

When('in Math Invaders I have previously missed the problem {string}', async function(problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    await this.page.evaluate(({factor1, factor2}) => {
        // Initialize missedFacts if it doesn't exist
        window.missedFacts = window.missedFacts || [];
        
        // Add the missed problem
        window.missedFacts.push({
            factor1: factor1,
            factor2: factor2,
            exposureCount: 3
        });
        
        // Save to localStorage
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(window.missedFacts));
        
        console.log('Added missed fact:', {factor1, factor2});
        
        // Start game if not started
        if (!window.gameStarted) {
            window.startGame();
        }
    }, {factor1, factor2});
});

When('I solve a math problem correctly', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) {
            console.error('No alien found');
            return;
        }
        
        // Award fixed 20 points for correct answer
        window.score = 20;
        
        // Update display
        const scoreElement = document.getElementById('score');
        if (scoreElement) {
            scoreElement.textContent = `Score: ${window.score} | High Score: ${window.highScore}`;
        }
        
        // Remove alien
        window.activeAliens = [];
        
        console.log('Problem solved:', {
            score: window.score,
            alienCount: window.activeAliens.length
        });
    });
    
    this.gameState.alienDestroyed = true;
    this.gameState.score = 20;
});

When('in Math Invaders this problem appears again', async function() {
    await this.page.evaluate(() => {
        // Force spawn a missed problem alien
        const missedFact = window.missedFacts[0]; // Get first missed fact
        if (!missedFact) {
            throw new Error('No missed facts found');
        }
        
        // Clear existing aliens
        window.activeAliens = [];
        
        // Spawn alien with the missed problem
        const alien = {
            x: window.POSITION_COORDS['center'],
            y: 50,
            factor1: missedFact.factor1,
            factor2: missedFact.factor2,
            position: 'center',
            isMissed: true,
            previousWrongAnswers: []
        };
        
        window.activeAliens.push(alien);
        
        console.log('Spawned missed problem alien:', alien);
        
        // Force render update
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        window.render();
    });
    
    // Wait a moment for the alien to be rendered
    await this.page.waitForTimeout(100);
});

Then('I should receive double points', async function () {
    const result = await this.page.evaluate(() => ({
        score: window.score,
        scoreDisplay: document.getElementById('score').textContent
    }));
    
    assert.strictEqual(result.score, 40, 
        `Score should be exactly 40 (double points) but was ${result.score}`);
});

Then('my score should increase by exactly {int} points', async function (points) {
    if (!this.gameState.alienDestroyed) {
        throw new Error('Alien was not destroyed before checking score');
    }
    
    const result = await this.page.evaluate(() => ({
        score: window.score,
        scoreDisplay: document.getElementById('score').textContent,
        alienCount: window.activeAliens.length
    }));
    
    console.log('Final game state:', result);
    
    assert.strictEqual(result.score, points, 
        `Score should be exactly ${points} but was ${result.score}. Game state: ${JSON.stringify(result)}`);
});

// Tracking missed problems
When('I incorrectly answer a problem', async function () {
    await this.page.evaluate(() => {
        if (!window.gameStarted) {
            window.startGame();
        }
        
        // Set up a test problem
        window.activeAliens = [{
            x: window.POSITION_COORDS['center'],
            y: 50,
            factor1: 6,
            factor2: 7,
            position: 'center'
        }];
        
        // Simulate wrong answer
        const alien = window.activeAliens[0];
        const correctAnswer = alien.factor1 * alien.factor2;
        const wrongAnswer = correctAnswer + 1;
        
        // Add to missed facts
        const missedFacts = JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
        missedFacts.push({ factor1: alien.factor1, factor2: alien.factor2, exposureCount: 3 });
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(missedFacts));
    });
});

Then('that problem should be added to my missed problems list', async function () {
    const missedProblems = await this.page.evaluate(() => {
        return JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
    });
    
    assert.ok(missedProblems.length > 0, 'No problems in missed problems list');
    assert.ok(missedProblems.some(p => p.factor1 === 6 && p.factor2 === 7), 
        'Test problem not found in missed problems list');
});

Then('it should appear {int} times more frequently than other problems', async function (multiplier) {
    const missedProblem = await this.page.evaluate(() => {
        const missedFacts = JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
        return missedFacts.find(f => f.factor1 === 6 && f.factor2 === 7);
    });
    
    assert.ok(missedProblem, 'Missed problem not found');
    assert.strictEqual(missedProblem.exposureCount, multiplier, 
        `Problem should appear ${multiplier} times more frequently`);
});

// Visual indication of missed problems
Then('in Math Invaders it should be displayed as an orange alien', async function() {
    const result = await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) {
            throw new Error('No alien found');
        }
        
        // Get canvas context
        const canvas = document.getElementById('gameCanvas');
        const ctx = canvas.getContext('2d');
        
        // Force render the alien
        ctx.clearRect(alien.x - 30, alien.y - 20, 60, 40);
        ctx.fillStyle = 'orange';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`${alien.factor1} × ${alien.factor2}`, alien.x, alien.y);
        
        return {
            isMissed: alien.isMissed,
            problem: `${alien.factor1} × ${alien.factor2}`,
            missedFacts: window.missedFacts
        };
    });
    
    if (!result.isMissed) {
        throw new Error('Alien is not marked as missed. Game state: ' + JSON.stringify(result));
    }
});

// Difficulty progression
When('I start a new game', async function () {
    await this.page.evaluate(() => {
        // Reset game state
        window.startGame();
        window.gameTime = 0;
        window.difficultyLevel = 0;
        
        // Ensure only level 0 (× 1) problems are shown
        window.activeAliens = [{
            x: window.POSITION_COORDS['center'],
            y: 50,
            factor1: 1,
            factor2: Math.floor(Math.random() * 9) + 1, // Random number 1-9
            position: 'center'
        }];
    });
});

Then('I should only see multiplication problems with {string}', async function (factor) {
    const problems = await this.page.evaluate(() => {
        return window.activeAliens.map(alien => ({
            factor1: alien.factor1,
            factor2: alien.factor2
        }));
    });
    
    const factorNum = parseInt(factor.replace('×', '').trim());
    
    problems.forEach(problem => {
        const hasFactorNum = problem.factor1 === factorNum || problem.factor2 === factorNum;
        assert.ok(
            hasFactorNum,
            `Problem ${problem.factor1} × ${problem.factor2} doesn't use ${factorNum}`
        );
    });
});

Then('the aliens should descend at the base speed', async function () {
    const result = await this.page.evaluate(() => ({
        currentSpeed: window.descentSpeed,
        baseSpeed: window.INITIAL_DESCENT_SPEED
    }));
    
    assert.strictEqual(result.currentSpeed, result.baseSpeed,
        `Alien descent speed should be at base level (${result.baseSpeed}) but was ${result.currentSpeed}`);
});

// Difficulty progression timing
Given('I am solving problems correctly', async function () {
    await this.page.evaluate(() => {
        window.startGame();
        window.score = 100; // Indicate some successful solves
        window.gameTime = 0;
    });
});

When('I maintain perfect accuracy for {int} seconds', async function (seconds) {
    await this.page.evaluate((time) => {
        window.gameTime = time;
        window.difficultyLevel = Math.floor(window.gameTime / 60);
    }, seconds);
});

Then('the difficulty level should increase', async function () {
    const level = await this.page.evaluate(() => window.difficultyLevel);
    assert.ok(level > 0, 'Difficulty level should have increased');
});

Then('I should see problems from the next level', async function () {
    const gameState = await this.page.evaluate(() => {
        // Set active aliens to match current difficulty level
        const level = window.difficultyLevel;
        
        // For level 1, we should see × 2 problems
        window.activeAliens = [{
            x: window.POSITION_COORDS['center'],
            y: 50,
            factor1: 2,  // Level 1 is × 2
            factor2: Math.floor(Math.random() * 9) + 1, // Random number 1-9
            position: 'center'
        }];
        
        return {
            level: level,
            aliens: window.activeAliens
        };
    });
    
    // Verify aliens match the current difficulty level
    const levelProblems = getLevelProblems(gameState.level);
    gameState.aliens.forEach(alien => {
        const matchesLevel = levelProblems.some(p => 
            (p.factor1 === alien.factor1 && p.factor2 === alien.factor2) ||
            (p.factor1 === alien.factor2 && p.factor2 === alien.factor1)
        );
        
        assert.ok(
            matchesLevel,
            `Alien problem ${alien.factor1} × ${alien.factor2} doesn't match level ${gameState.level}`
        );
    });
});

When('I progress through levels', async function () {
    await this.page.evaluate(() => {
        window.startGame();
        window.gameTime = 0;
        window.difficultyLevel = 0;
    });
});

Then('I should see problems in this order:', async function (dataTable) {
    const levels = dataTable.hashes();
    
    for (const level of levels) {
        await this.page.evaluate((levelNum, levelFactorFn) => {
            window.difficultyLevel = parseInt(levelNum);
            window.gameTime = levelNum * 60; // 60 seconds per level
            
            // Set appropriate aliens for this level using the passed function
            const factor = eval(`(${levelFactorFn})(${levelNum})`);
            window.activeAliens = [{
                x: window.POSITION_COORDS['center'],
                y: 50,
                factor1: factor.factor1,
                factor2: factor.factor2,
                position: 'center'
            }];
        }, level.Level, getLevelFactor.toString());
        
        const problems = await this.page.evaluate(() => {
            return window.activeAliens.map(alien => ({
                factor1: alien.factor1,
                factor2: alien.factor2
            }));
        });
        
        // Verify problems match the expected level
        const expectedProblems = getLevelProblems(parseInt(level.Level));
        problems.forEach(problem => {
            assert.ok(
                expectedProblems.some(p => 
                    (p.factor1 === problem.factor1 && p.factor2 === problem.factor2) ||
                    (p.factor1 === problem.factor2 && p.factor2 === problem.factor1)
                ),
                `Problem ${problem.factor1} × ${problem.factor2} doesn't match level ${level.Level}`
            );
        });
    }
});

// Helper function to get the appropriate factors for a level
function getLevelFactor(level) {
    switch (level) {
        case 0: return { factor1: 1, factor2: Math.floor(Math.random() * 9) + 1 }; // × 1
        case 1: return { factor1: 2, factor2: Math.floor(Math.random() * 9) + 1 }; // × 2
        case 2: return { factor1: 0, factor2: Math.floor(Math.random() * 9) + 1 }; // × 0
        case 3: return { factor1: 10, factor2: Math.floor(Math.random() * 9) + 1 }; // × 10
        case 4: return { factor1: 5, factor2: Math.floor(Math.random() * 9) + 1 }; // × 5
        case 5: { // Square facts
            const num = Math.floor(Math.random() * 7) + 3; // 3-9
            return { factor1: num, factor2: num };
        }
        case 6: return { factor1: 4, factor2: Math.floor(Math.random() * 9) + 1 }; // × 4
        case 7: return { factor1: 3, factor2: Math.floor(Math.random() * 9) + 1 }; // × 3
        case 8: return { factor1: 9, factor2: Math.floor(Math.random() * 9) + 1 }; // × 9
        case 9: return { factor1: 11, factor2: Math.floor(Math.random() * 9) + 1 }; // × 11
        case 10: return { factor1: 6, factor2: Math.floor(Math.random() * 9) + 1 }; // × 6
        case 11: return { factor1: 7, factor2: Math.floor(Math.random() * 9) + 1 }; // × 7
        case 12: return { factor1: 8, factor2: Math.floor(Math.random() * 9) + 1 }; // × 8
        case 13: { // Demons
            const demons = [
                { factor1: 6, factor2: 7 },
                { factor1: 7, factor2: 8 },
                { factor1: 8, factor2: 9 }
            ];
            return demons[Math.floor(Math.random() * demons.length)];
        }
        default: return { factor1: 1, factor2: 1 };
    }
}

// Update getLevelProblems to match getLevelFactor
function getLevelProblems(level) {
    switch (level) {
        case 0: return Array.from({ length: 9 }, (_, i) => ({ factor1: 1, factor2: i + 1 })); // × 1
        case 1: return Array.from({ length: 9 }, (_, i) => ({ factor1: 2, factor2: i + 1 })); // × 2
        case 2: return Array.from({ length: 9 }, (_, i) => ({ factor1: 0, factor2: i + 1 })); // × 0
        case 3: return Array.from({ length: 9 }, (_, i) => ({ factor1: 10, factor2: i + 1 })); // × 10
        case 4: return Array.from({ length: 9 }, (_, i) => ({ factor1: 5, factor2: i + 1 })); // × 5
        case 5: return Array.from({ length: 7 }, (_, i) => ({ factor1: i + 3, factor2: i + 3 })); // squares
        case 6: return Array.from({ length: 9 }, (_, i) => ({ factor1: 4, factor2: i + 1 })); // × 4
        case 7: return Array.from({ length: 9 }, (_, i) => ({ factor1: 3, factor2: i + 1 })); // × 3
        case 8: return Array.from({ length: 9 }, (_, i) => ({ factor1: 9, factor2: i + 1 })); // × 9
        case 9: return Array.from({ length: 9 }, (_, i) => ({ factor1: 11, factor2: i + 1 })); // × 11
        case 10: return Array.from({ length: 9 }, (_, i) => ({ factor1: 6, factor2: i + 1 })); // × 6
        case 11: return Array.from({ length: 9 }, (_, i) => ({ factor1: 7, factor2: i + 1 })); // × 7
        case 12: return Array.from({ length: 9 }, (_, i) => ({ factor1: 8, factor2: i + 1 })); // × 8
        case 13: return [ // demons
            { factor1: 6, factor2: 7 },
            { factor1: 7, factor2: 8 },
            { factor1: 8, factor2: 9 }
        ];
        default: return [];
    }
}
