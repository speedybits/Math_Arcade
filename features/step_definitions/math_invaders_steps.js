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

When('I have not previously missed this problem', async function () {
    await this.page.evaluate(() => {
        window.missedFacts = [];
        localStorage.setItem('mathInvaders_missedFacts', '[]');
    });
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

When('in Math Invaders I have previously missed the problem {string}', async function (problem) {
    const [factor1, factor2] = problem.split('×').map(n => parseInt(n.trim()));
    
    this.gameState.currentProblem = { factor1, factor2 };
    
    await this.page.evaluate(({f1, f2}) => {
        // Add to missed facts
        const missedFacts = JSON.parse(localStorage.getItem('mathInvaders_missedFacts') || '[]');
        missedFacts.push({ factor1: f1, factor2: f2, exposureCount: 3 });
        localStorage.setItem('mathInvaders_missedFacts', JSON.stringify(missedFacts));
    }, { f1: factor1, f2: factor2 });
});

When('this problem appears again as an orange alien', async function () {
    if (!this.gameState.currentProblem) {
        throw new Error('No current problem set');
    }
    
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
    }, { 
        f1: this.gameState.currentProblem.factor1, 
        f2: this.gameState.currentProblem.factor2 
    });
});

When('I solve it correctly', async function () {
    await this.page.evaluate(() => {
        const alien = window.activeAliens[0];
        if (!alien) {
            console.error('No alien found');
            return;
        }
        
        // Award double points (40) for previously missed problems
        window.score = 40;
        
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
    this.gameState.score = 40;
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
