const { Given, When, Then, Before, After } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const assert = require('assert');

let browser;
let page;
let initialPosition;

Before(async function () {
    browser = await chromium.launch();
    page = await browser.newPage();
    await page.goto('http://localhost:8080/math_asteroids.html');
});

After(async function () {
    if (browser) {
        await browser.close();
    }
});

Given('I am playing Math Asteroids', async function () {
    await page.click('#startButton');
});

When('I generate a multiplication problem', async function () {
    // Wait for an asteroid to appear
    await page.waitForFunction(() => {
        return window.asteroids && window.asteroids.length > 0;
    });
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
    const [a, b] = problem.split('×').map(n => parseInt(n.trim()));
    await page.evaluate((a, b) => {
        window.missedFacts.push({ a, b, exposureCount: 3 });
        localStorage.setItem('mathAsteroids_missedFacts', JSON.stringify(window.missedFacts));
    }, a, b);
});

Then('it should be displayed as an orange asteroid', async function () {
    const isOrange = await page.evaluate(() => {
        return window.asteroids.some(asteroid => asteroid.isMissed === true);
    });
    assert.strictEqual(isOrange, true);
});

When('I press the up arrow', async function () {
    initialPosition = await page.evaluate(() => ({
        x: window.ship.x,
        y: window.ship.y
    }));
    await page.keyboard.press('ArrowUp');
});

Then('the ship should accelerate forward', async function () {
    await page.waitForTimeout(500); // Wait for acceleration
    const newPosition = await page.evaluate(() => ({
        x: window.ship.x,
        y: window.ship.y
    }));
    assert.notDeepStrictEqual(newPosition, initialPosition);
});

Then('maintain momentum when thrust is released', async function () {
    await page.keyboard.up('ArrowUp');
    await page.waitForTimeout(500);
    const momentumPosition = await page.evaluate(() => ({
        x: window.ship.x,
        y: window.ship.y
    }));
    assert.notDeepStrictEqual(momentumPosition, initialPosition);
});

When('a new asteroid is spawned', async function () {
    await page.evaluate(() => {
        window.createAsteroid();
    });
});

Then('it should appear outside the safe zone radius', async function () {
    const isOutsideSafeZone = await page.evaluate(() => {
        const asteroid = window.asteroids[window.asteroids.length - 1];
        const distance = Math.hypot(asteroid.x - window.ship.x, asteroid.y - window.ship.y);
        return distance >= window.SAFE_ZONE_RADIUS;
    });
    assert.strictEqual(isOutsideSafeZone, true);
});

Then('the safe zone radius should be {int} pixels', async function (radius) {
    const safeZoneRadius = await page.evaluate(() => window.SAFE_ZONE_RADIUS);
    assert.strictEqual(safeZoneRadius, radius);
});

Given('I hit a large asteroid correctly', async function () {
    await page.evaluate(() => {
        const asteroid = window.asteroids[0];
        asteroid.size = 40; // Large asteroid
        window.currentAnswer = (asteroid.a * asteroid.b).toString();
        window.fireBullet();
    });
});

Then('it should split into two smaller asteroids', async function () {
    await page.waitForTimeout(500);
    const asteroidCount = await page.evaluate(() => window.asteroids.length);
    assert.strictEqual(asteroidCount, 2);
});

Then('the smaller asteroids should maintain momentum', async function () {
    const hasVelocity = await page.evaluate(() => {
        return window.asteroids.every(asteroid => 
            asteroid.velocity.x !== 0 || asteroid.velocity.y !== 0
        );
    });
    assert.strictEqual(hasVelocity, true);
});
